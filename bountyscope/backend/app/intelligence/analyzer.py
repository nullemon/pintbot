"""Deterministic fallbacks and bounded optional AI enrichment."""

import inspect

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.intelligence.dispatcher import (
    MAX_ACTIONS_PER_ROUND,
    MAX_ROUNDS,
    SafeToolDispatcher,
    check_cancelled,
    event,
)
from app.intelligence.providers import ProviderUnavailable, get_provider
from app.intelligence.schemas import FindingAnalysis, PrioritizedFinding
from app.intelligence.summaries import bounded, read
from app.scope.guard import ScopeDenied
from app.utils.redaction import sanitize


def _confidence(finding):
    try:
        return min(100, max(0, int(read(finding, "confidence", 0) or 0)))
    except (ValueError, TypeError):
        return 0


def _fallback(finding, reason="disabled"):
    return {
        "provider": "deterministic",
        "available": False,
        "reason": reason,
        "explanation": bounded(read(finding, "evidence_summary", "")),
        "business_impact": "Potential impact requires researcher verification in the application's context.",
        "false_positive_likelihood": "unknown",
        "false_positive_reasoning": "Automated observations alone do not establish exploitability.",
        "recommended_verification": [],
        "confidence_adjustment": 0,
        "confidence": _confidence(finding),
        "severity": bounded(read(finding, "severity", "info"), 20),
    }


async def analyze_finding(finding, evidence, provider=None):
    """Return advisory text; scanner severity is immutable and confidence moves at most 5."""
    provider = provider or get_provider()
    if provider is None:
        return _fallback(finding)
    try:
        result = await provider.analyze_finding(finding, evidence)
        result = FindingAnalysis.model_validate(result)
        output = sanitize(result.model_dump())
    except (ProviderUnavailable, ValidationError, httpx.HTTPError, ValueError, TypeError):
        return _fallback(finding, "provider_unavailable")
    output.update(
        {
            "provider": getattr(provider, "name", "configured"),
            "available": True,
            "confidence": min(100, max(0, _confidence(finding) + result.confidence_adjustment)),
            "severity": bounded(read(finding, "severity", "info"), 20),
        }
    )
    return output


async def prioritize_findings(findings, provider=None):
    findings = list(findings)
    severity = {"critical": 5, "high": 4, "medium": 3, "low": 2, "info": 1, "informational": 1}
    baseline = [
        {
            "finding_id": str(read(item, "id", "")),
            "score": min(
                100,
                severity.get(str(read(item, "severity", "info")), 1) * 16 + _confidence(item) // 5,
            ),
            "reason": "Ordered by observed scanner severity and confidence; impact requires verification.",
        }
        for item in findings
    ]
    provider = provider or get_provider()
    if provider:
        try:
            proposed = await provider.prioritize_findings(findings)
            valid_ids = {entry["finding_id"] for entry in baseline}
            seen = set()
            accepted = []
            for item in list(proposed)[:100]:
                item = PrioritizedFinding.model_validate(item)
                if item.finding_id in valid_ids and item.finding_id not in seen:
                    accepted.append(sanitize(item.model_dump()))
                    seen.add(item.finding_id)
            baseline = accepted + [item for item in baseline if item["finding_id"] not in seen]
        except (ProviderUnavailable, ValidationError, httpx.HTTPError, ValueError, TypeError):
            pass
    return sorted(baseline, key=lambda item: item["score"], reverse=True)


async def run_followups(ctx, observations, provider=None):
    """Return observed Pages; the existing scanner pipeline analyzes and persists them."""
    if getattr(ctx, "profile", "standard") == "passive":
        return []
    provider = provider or get_provider()
    if provider is None:
        return []
    rounds = min(MAX_ROUNDS, max(0, settings.ai_max_rounds))
    actions = min(MAX_ACTIONS_PER_ROUND, max(0, settings.ai_max_actions_per_round))
    if not rounds or not actions:
        return []
    observations = list(observations)
    observed_urls = {str(read(page, "url", "")) for page in observations}
    dispatcher = SafeToolDispatcher(ctx, max_actions=rounds * actions, observed_urls=observed_urls)
    pages = []
    for current_round in range(1, rounds + 1):
        await check_cancelled(ctx)
        callback = getattr(ctx, "set_ai_round", None)
        if callback:
            result = callback(current_round)
            if inspect.isawaitable(result):
                await result
        event(ctx, "ai_round", {"round": current_round, "action_limit": actions})
        try:
            planned = await provider.suggest_safe_next_checks(observations)
            if not isinstance(planned, (list, tuple)):
                raise ValueError("Provider must return a list of safe checks")
            checks = list(planned)[:actions]
        except (ProviderUnavailable, ValidationError, httpx.HTTPError, ValueError, TypeError):
            event(ctx, "ai_unavailable", {"reason": "provider_request_or_output_invalid"})
            break
        if not checks:
            break
        fresh = []
        for check in checks:
            await check_cancelled(ctx)
            try:
                page = await dispatcher.dispatch(check)
            except (ScopeDenied, ValidationError, httpx.HTTPError, OSError, ValueError, TypeError):
                # The dispatcher records a redacted denial for validation and target failures.
                continue
            if page is not None:
                fresh.append(page)
                dispatcher.observed_urls.add(str(page.url))
        if not fresh:
            break
        pages.extend(fresh)
        observations.extend(fresh)
    return pages
