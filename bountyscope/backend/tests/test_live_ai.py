from types import SimpleNamespace

import pytest
from sqlalchemy import select
from test_intelligence import ANALYSIS
from test_pipeline import FixtureTransport, configure, seed

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.http import ScanCancelled
from app.intelligence.live import LiveAdvisor
from app.intelligence.providers import ProviderRefused, ProviderUnavailable
from app.models import Finding, Scan, ScanEvent


class Provider:
    name = "anthropic"

    def __init__(self):
        self.plans = 0
        self.analysis_calls = 0

    async def suggest_safe_next_checks(self, observations):
        self.plans += 1
        return [
            {
                "tool": "check_directory",
                "url": "http://example.test:8080/uploads/users/",
                "reason": "Observed media parent: check whether filenames are enumerable",
            },
            {
                "tool": "inspect_endpoint",
                "url": "https://third-party.invalid/",
                "reason": "Must be denied",
            },
        ]

    async def prioritize_findings(self, findings):
        return [
            {
                "finding_id": f["id"],
                "score": 95 if f["scanner"] == "directory_listing" else 25,
                "reason": "Directory-index evidence has more research value than a missing header",
            }
            for f in findings
        ]

    async def analyze_finding(self, finding, evidence):
        self.analysis_calls += 1
        return ANALYSIS


async def test_live_pipeline_reviews_before_crawl_finishes_and_persists_priority(monkeypatch):
    configure(monkeypatch)
    provider = Provider()
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr("app.intelligence.live.get_provider", lambda: provider)
    scan_id = seed()
    await __import__("app.workers.pipeline", fromlist=["run_scan"]).run_scan(scan_id)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        events = list(
            db.scalars(
                select(ScanEvent).where(ScanEvent.scan_id == scan_id).order_by(ScanEvent.created_at)
            )
        )
        first = next(i for i, e in enumerate(events) if e.kind == "ai_batch_started")
        assert events[first].data["during_scan"] is True
        assert any(e.kind == "request_sent" for e in events[first + 1 :])
        assert any(e.kind == "ai_action_executed" for e in events)
        assert any(e.kind == "ai_action_denied" for e in events)
        assert provider.plans <= 3 and provider.analysis_calls <= 20
        findings = list(db.scalars(select(Finding)))
        assert any(f.ai_analysis.get("available") for f in findings)
        assert all(
            f.ai_analysis["priority"]["source"] == "anthropic"
            for f in findings
            if f.ai_analysis.get("priority")
        )
        assert events[-2].kind == "ai_progress" or any(
            e.kind == "ai_progress" and e.data["status"] == "complete" for e in events
        )
    assert all("third-party" not in path for _, path in FixtureTransport.calls)


class Context:
    profile = "standard"
    visited = set(range(5))

    def __init__(self):
        self.events = []
        self.http = SimpleNamespace(event=lambda kind, data: self.events.append((kind, data)))
        self.cancelled = False

    def check_cancelled(self):
        if self.cancelled:
            raise ScanCancelled()

    def set_ai_round(self, value):
        self.round = value

    def event(self, kind, data):
        self.events.append((kind, data))


async def test_provider_failure_visible_no_retry_loop(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)

    class Failing(Provider):
        async def suggest_safe_next_checks(self, observations):
            self.plans += 1
            raise ProviderUnavailable("Provider HTTP 400: unsupported model option")

    provider = Failing()
    ctx = Context()
    advisor = LiveAdvisor(ctx, provider)
    assert await advisor.review([{"url": "https://example.com/"}]) == []
    assert advisor.progress["status"] == "unavailable"
    assert "HTTP 400" in advisor.progress["message"]
    await advisor.review([{"url": "https://example.com/"}], force=True)
    assert provider.plans == 1


async def test_provider_refusal_stops_automatic_reviews_and_survives_finish(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)

    class Refusing(Provider):
        async def suggest_safe_next_checks(self, observations):
            self.plans += 1
            raise ProviderRefused("AI provider refused this review")

    provider = Refusing()
    ctx = Context()
    advisor = LiveAdvisor(ctx, provider)

    async def unexpected_triage():
        pytest.fail("A refused plan must not be followed by more provider reviews")

    advisor.triage = unexpected_triage
    assert await advisor.review([{"url": "https://example.test/"}]) == []
    assert advisor.stopped and advisor.progress["status"] == "refused"
    assert "deterministic" in advisor.progress["message"].lower()
    assert "stopped" in advisor.progress["message"].lower()
    assert await advisor.review([{"url": "https://example.test/new/"}], force=True) == []
    advisor.finish()
    assert provider.plans == 1 and provider.analysis_calls == 0
    assert advisor.progress["status"] == "refused"
    assert sum(kind == "ai_review_refused" for kind, _ in ctx.events) == 1
    assert not any(kind == "ai_unavailable" for kind, _ in ctx.events)


@pytest.mark.parametrize("phase", ["plan", "prioritize", "analyze"])
async def test_refusal_at_any_ai_phase_keeps_scan_running_without_more_provider_calls(
    monkeypatch, phase
):
    configure(monkeypatch)

    class Refusing(Provider):
        def __init__(self):
            super().__init__()
            self.priority_calls = 0
            self.refused = False

        def record(self, method):
            assert not self.refused, "No subsequent provider task is allowed after refusal"
            if method == phase:
                self.refused = True
                raise ProviderRefused("AI provider refused this review")

        async def suggest_safe_next_checks(self, observations):
            self.plans += 1
            self.record("plan")
            return []

        async def prioritize_findings(self, findings):
            self.priority_calls += 1
            self.record("prioritize")
            return await super().prioritize_findings(findings)

        async def analyze_finding(self, finding, evidence):
            self.analysis_calls += 1
            self.record("analyze")
            return ANALYSIS

    provider = Refusing()
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr("app.intelligence.live.get_provider", lambda: provider)
    scan_id = seed("exposure")
    await __import__("app.workers.pipeline", fromlist=["run_scan"]).run_scan(scan_id)

    assert provider.refused
    assert provider.plans == 1
    assert provider.priority_calls == (0 if phase == "plan" else 1)
    assert provider.analysis_calls == (1 if phase == "analyze" else 0)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        assert scan.findings_found > 0 and scan.requests_sent > 0
        events = list(
            db.scalars(
                select(ScanEvent).where(ScanEvent.scan_id == scan_id).order_by(ScanEvent.created_at)
            )
        )
        refusal = next(i for i, event in enumerate(events) if event.kind == "ai_review_refused")
        assert any(event.kind == "request_sent" for event in events[refusal + 1 :])
        progress = [event.data for event in events if event.kind == "ai_progress"]
        assert progress[-1]["status"] == "refused"
        assert not any(event.kind == "ai_unavailable" for event in events)
        assert not any(event.kind == "ai_batch_completed" for event in events)


async def test_cancellation_stops_live_review_before_provider_call(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    provider = Provider()
    ctx = Context()
    ctx.cancelled = True
    advisor = LiveAdvisor(ctx, provider)
    with pytest.raises(ScanCancelled):
        await advisor.review([{"url": "https://example.com/"}])
    assert provider.plans == 0


async def test_passive_analysis_never_plans_target_actions(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    ctx = Context()
    ctx.profile = "passive"
    provider = Provider()
    advisor = LiveAdvisor(ctx, provider)

    async def triage():
        pass

    advisor.triage = triage
    await advisor.review([{"url": "https://example.com/"}], force=True)
    assert provider.plans == 0


async def test_exposure_profile_limits_findings_and_seeds_no_media_downloads(monkeypatch):
    configure(monkeypatch)
    scan_id = seed("exposure")
    from app.workers.pipeline import run_scan

    await run_scan(scan_id)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        findings = list(db.scalars(select(Finding)))
        assert findings
        assert {f.scanner for f in findings} <= {"directory_listing", "exposed_files", "javascript"}
        assert any(e.kind == "exposure_directory_candidates" for e in db.scalars(select(ScanEvent)))
    paths = [path for _, path in FixtureTransport.calls]
    assert "/images/" in paths and "/thumbnails/" in paths and "/wp-content/uploads/" in paths
    assert not any("image_" in path for path in paths)


async def test_exposure_profile_rejects_ai_cors_and_unknown_tools(monkeypatch):
    from test_intelligence import FakeHTTP

    from app.intelligence.dispatcher import SafeToolDispatcher
    from app.scope.guard import ScopeDenied, ScopeGuard

    ctx = Context()
    ctx.profile = "exposure"
    ctx.http = FakeHTTP()
    ctx.guard = ScopeGuard(
        [
            {"rule_type": "allow_domain", "value": "example.com"},
            {"rule_type": "allow_port", "value": "443"},
        ]
    )
    dispatcher = SafeToolDispatcher(ctx)
    for tool in ("check_cors", "check_cookie"):
        with pytest.raises(ScopeDenied):
            await dispatcher.dispatch({"tool": tool, "url": "https://example.com/"})
    assert ctx.http.calls == []


async def test_live_global_round_and_action_ceilings(monkeypatch):
    from test_intelligence import FakeHTTP

    from app.intelligence.dispatcher import SafeToolDispatcher
    from app.scope.guard import ScopeGuard

    monkeypatch.setattr(settings, "ai_max_rounds", 99)
    monkeypatch.setattr(settings, "ai_max_actions_per_round", 99)

    class Many(Provider):
        async def suggest_safe_next_checks(self, observations):
            self.plans += 1
            return [
                {
                    "tool": "check_directory",
                    "url": f"https://example.com/observed-{self.plans}-{i}/",
                }
                for i in range(100)
            ]

    ctx = Context()
    ctx.http = FakeHTTP()
    ctx.http.event = lambda kind, data: ctx.events.append((kind, data))
    ctx.guard = ScopeGuard(
        [
            {"rule_type": "allow_domain", "value": "example.com"},
            {"rule_type": "allow_port", "value": "443"},
        ]
    )
    provider = Many()
    advisor = LiveAdvisor(ctx, provider)

    async def triage():
        pass

    advisor.triage = triage
    for _ in range(5):
        await advisor.review([{"url": "https://example.com/"}], force=True)
    assert provider.plans == 3
    assert len(ctx.http.calls) == 60
    assert isinstance(advisor.dispatcher, SafeToolDispatcher)


async def test_cancel_during_provider_request_blocks_every_followup(monkeypatch):
    ctx = Context()

    class Cancels(Provider):
        async def suggest_safe_next_checks(self, observations):
            ctx.cancelled = True
            return [{"tool": "check_directory", "url": "https://example.com/"}]

    advisor = LiveAdvisor(ctx, Cancels())
    with pytest.raises(ScanCancelled):
        await advisor.review([{"url": "https://example.com/"}], force=True)
    assert not any(kind == "ai_action_proposed" for kind, _ in ctx.events)
