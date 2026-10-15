"""Interleave bounded AI reviews with crawling; all target actions remain guarded."""

import time
from datetime import UTC, datetime

import httpx
from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.http import BudgetExceeded, ScanCancelled
from app.intelligence.analyzer import analyze_finding, prioritize_findings
from app.intelligence.dispatcher import SafeToolDispatcher
from app.intelligence.providers import ProviderUnavailable, get_provider
from app.models import Finding, ScanFinding
from app.scope.guard import ScopeDenied
from app.utils.redaction import sanitize


class LiveAdvisor:
    def __init__(self, ctx, provider=None, clock=time.monotonic):
        self.ctx = ctx
        self.provider = provider if provider is not None else get_provider()
        if self.provider and ctx.profile == "exposure":
            self.provider.focus = "Only directory indexing, exposed files, source disclosures and enumerable media. Prioritize confirmed index signatures and sensitive-file indicators. Do not propose header, cookie or CORS checks. Plain public image availability alone is not a vulnerability."
        self.clock = clock
        self.round_limit = min(3, max(0, settings.ai_max_rounds))
        self.action_limit = min(20, max(0, settings.ai_max_actions_per_round))
        self.analyzed = set()
        self.last_count = 0
        self.last_at = clock()
        self.stopped = False
        self.dispatcher = SafeToolDispatcher(ctx, max_actions=self.round_limit * self.action_limit)
        self.progress = {
            "enabled": settings.ai_enabled,
            "status": "waiting" if self.provider else "disabled",
            "round": 0,
            "max_rounds": self.round_limit,
            "actions_proposed": 0,
            "actions_approved": 0,
            "actions_denied": 0,
            "actions_executed": 0,
            "findings_analyzed": 0,
            "findings_prioritized": 0,
            "message": "Waiting for an observation batch"
            if self.provider
            else "AI disabled or provider key/model missing",
            "last_updated": None,
        }
        if settings.ai_enabled and not self.provider:
            self.progress.update(
                status="unavailable",
                message="AI enabled, but selected provider key or model is missing",
            )

    def publish(self, **values):
        self.progress.update(values, last_updated=datetime.now(UTC).isoformat())
        self.ctx.http.event("ai_progress", dict(self.progress))

    def observe_event(self, kind, data):
        field = {
            "ai_action_proposed": "actions_proposed",
            "ai_action_approved": "actions_approved",
            "ai_action_denied": "actions_denied",
            "ai_action_executed": "actions_executed",
        }.get(kind)
        if field:
            self.publish(**{field: self.progress[field] + 1})

    async def review(self, observations, *, force=False):
        """At most three batches per scan, reserving the final batch for remaining evidence."""
        if not self.provider or self.stopped or self.progress["round"] >= self.round_limit:
            return []
        count = len(self.ctx.visited)
        if not force:
            if self.progress["round"] >= max(0, self.round_limit - 1):
                return []
            threshold = 5 if self.progress["round"] == 0 else 10
            if count - self.last_count < threshold and self.clock() - self.last_at < max(
                5, settings.ai_live_interval_seconds
            ):
                return []
        if not observations:
            return []
        self.ctx.check_cancelled()
        self.last_count, self.last_at = count, self.clock()
        current = self.progress["round"] + 1
        self.ctx.set_ai_round(current)
        self.publish(
            status="analyzing",
            round=current,
            message="Reviewing current discoveries and prioritizing findings",
        )
        self.ctx.event(
            "ai_batch_started",
            {
                "round": current,
                "observations": min(len(observations), 20),
                "during_scan": not force,
            },
        )
        pages = []
        try:
            if self.ctx.profile != "passive" and self.action_limit:
                self.dispatcher.observed_urls.update(
                    o["url"] for o in observations if isinstance(o, dict) and o.get("url")
                )
                self.ctx.check_cancelled()
                planned = await self.provider.suggest_safe_next_checks(observations[-20:])
                self.ctx.check_cancelled()
                if not isinstance(planned, (list, tuple)):
                    raise ProviderUnavailable("Provider returned an invalid follow-up plan")
                for action in list(planned)[: self.action_limit]:
                    self.ctx.check_cancelled()
                    try:
                        page = await self.dispatcher.dispatch(action)
                    except (
                        ScopeDenied,
                        ValidationError,
                        httpx.HTTPError,
                        OSError,
                        ValueError,
                        TypeError,
                    ):
                        continue
                    if page is not None:
                        pages.append(page)
                        if getattr(self.ctx, "process_ai_page", None):
                            await self.ctx.process_ai_page(page)
                        self.dispatcher.observed_urls.add(page.url)
            await self.triage()
            self.ctx.event("ai_batch_completed", {"round": current, "followup_pages": len(pages)})
            self.publish(status="waiting", message="Review complete; continuing discovery")
        except (ScanCancelled, BudgetExceeded):
            raise
        except (
            ProviderUnavailable,
            httpx.HTTPError,
            ValidationError,
            ValueError,
            TypeError,
        ) as exc:
            self.stopped = True
            reason = str(exc) if isinstance(exc, ProviderUnavailable) else type(exc).__name__
            self.ctx.event("ai_unavailable", {"reason": reason})
            self.publish(status="unavailable", message="AI review failed: " + reason)
        return pages

    async def triage(self):
        from app.api.routes import evidence_for, record

        with SessionLocal() as db:
            findings = list(
                db.scalars(
                    select(Finding)
                    .join(ScanFinding)
                    .where(ScanFinding.scan_id == self.ctx.scan_id)
                    .order_by(Finding.confidence.desc())
                    .limit(100)
                )
            )
            snapshots = [record(f) for f in findings]
        if not snapshots:
            return
        self.ctx.check_cancelled()
        # Direct provider validation through the helper retains deterministic fallback priorities.
        priorities = await prioritize_findings(snapshots, self.provider)
        self.ctx.check_cancelled()
        with SessionLocal() as db:
            for item in priorities:
                finding = db.get(Finding, item["finding_id"])
                if finding:
                    finding.ai_analysis = {
                        **finding.ai_analysis,
                        "priority": {
                            "score": item["score"],
                            "reason": item["reason"],
                            "source": item.get("source", "deterministic"),
                        },
                    }
            db.commit()
        self.progress["findings_prioritized"] = len(priorities)
        fallback_count = sum(p.get("source") == "deterministic" for p in priorities)
        if fallback_count:
            self.ctx.event(
                "ai_priority_fallback",
                {
                    "findings": fallback_count,
                    "message": "Some priorities use deterministic scoring; AI did not return valid scores for those findings",
                },
            )
        remaining = max(0, min(20, settings.ai_live_max_findings) - len(self.analyzed))
        # Bound paid per-finding calls across all batches, not per page or round.
        snapshot_by_id = {f["id"]: f for f in snapshots}
        pending = [
            snapshot_by_id[p["finding_id"]]
            for p in priorities
            if p["finding_id"] in snapshot_by_id and p["finding_id"] not in self.analyzed
        ][: min(5, remaining)]
        for snapshot in pending:
            self.ctx.check_cancelled()
            with SessionLocal() as db:
                evidence = evidence_for(db, snapshot["id"])
            result = await analyze_finding(snapshot, evidence, self.provider)
            self.ctx.check_cancelled()
            if not result.get("available"):
                raise ProviderUnavailable(
                    result.get(
                        "error",
                        "Finding analysis failed; check provider connectivity or structured output",
                    )
                )
            with SessionLocal() as db:
                finding = db.get(Finding, snapshot["id"])
                finding.ai_analysis = sanitize({**finding.ai_analysis, **result})
                db.commit()
            self.analyzed.add(snapshot["id"])
            self.progress["findings_analyzed"] = len(self.analyzed)
            self.ctx.event(
                "ai_finding_analyzed",
                {"finding_id": snapshot["id"], "round": self.progress["round"]},
            )
            self.publish()
        self.publish()

    def finish(self):
        if self.progress["status"] not in {"disabled", "unavailable"}:
            self.publish(
                status="complete",
                message="Bounded AI review complete; remaining findings may require manual analysis",
            )
