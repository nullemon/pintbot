"""Budget-driven AI planning remains finite, scoped, cancellable and evidence-minimal."""

import json
from urllib.parse import urlsplit

import httpx
import pytest
from sqlalchemy import select
from test_pipeline import FixtureTransport, Stream, configure, seed

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.http import BudgetExceeded, ScanCancelled
from app.intelligence.dispatcher import SafeToolDispatcher
from app.intelligence.live import LiveAdvisor
from app.intelligence.providers import OpenAIProvider, ProviderRefused, ProviderUnavailable
from app.intelligence.summaries import observation_summary
from app.models import Finding, Scan, ScanEvent, ScanFinding
from app.scanners.base import Page
from app.scope.guard import ScopeDenied, ScopeGuard

OBSERVATIONS = [{"url": "https://example.test/", "signals": ["observed_media_parent"]}]


def directory(name):
    return {"tool": "check_directory", "url": f"https://example.test/{name}/"}


class BudgetHTTP:
    """Fake target transport sharing admission with the deterministic scan."""

    def __init__(self, ctx):
        self.ctx = ctx
        self.calls = []

    def event(self, kind, data):
        self.ctx.events.append((kind, data))

    async def get(self, url, **kwargs):
        self.ctx.check_cancelled()
        self.ctx.guard.check_url(url)
        if self.ctx.remaining_request_budget() <= 0:
            raise BudgetExceeded("Shared target budget exhausted")
        self.ctx.requests_sent += 1
        self.calls.append(url)
        return Page(url, 404, {"content-type": "text/html"}, b"Synthetic not found")


class BudgetContext:
    profile = "exposure"

    def __init__(self, *, budget=100, used=0, autopilot=True):
        self.autopilot = autopilot
        self.limits = {"request_budget": budget, "url_cap": 5000}
        self.requests_sent = used
        self.cancelled = False
        self.events = []
        self.visited = set(range(5))
        self.known = set()
        self.guard = ScopeGuard(
            [
                {"rule_type": "allow_domain", "value": "example.test"},
                {"rule_type": "allow_port", "value": "443"},
                {"rule_type": "deny_path", "value": "/excluded"},
            ]
        )
        self.http = BudgetHTTP(self)

    def remaining_request_budget(self):
        return max(0, self.limits["request_budget"] - self.requests_sent)

    def check_cancelled(self):
        if self.cancelled:
            raise ScanCancelled()

    def set_ai_round(self, value):
        self.round = value

    def event(self, kind, data):
        self.events.append((kind, data))
        if getattr(self, "ai", None):
            self.ai.observe_event(kind, data)

    async def remember_url(self, url, source):
        self.known.add(url)
        return True


class Planner:
    name = "synthetic"

    def __init__(self, plans):
        self.plans = plans
        self.calls = 0

    async def suggest_safe_next_checks(self, observations):
        self.calls += 1
        plan = self.plans[self.calls - 1] if self.calls <= len(self.plans) else []
        if isinstance(plan, Exception):
            raise plan
        return plan


def advisor_for(ctx, provider):
    advisor = LiveAdvisor(ctx, provider)

    async def no_findings_to_triage():
        pass

    advisor.triage = no_findings_to_triage
    ctx.ai = advisor
    return advisor


async def drain(advisor):
    for _ in range(100):
        if not advisor.can_continue():
            return
        previous = advisor.progress["round"]
        await advisor.review(OBSERVATIONS, force=True)
        assert advisor.progress["round"] > previous, "A continuing planner must advance its round"
    pytest.fail("Autopilot failed to stop within the bounded synthetic plan")


@pytest.fixture(autouse=True)
def ai_configuration(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ai_max_rounds", 3)
    monkeypatch.setattr(settings, "ai_max_actions_per_round", 20)
    monkeypatch.setattr(settings, "ai_autopilot_no_progress_rounds", 3)


async def test_autopilot_can_plan_more_than_three_rounds_with_scope_and_budget_enforced():
    outside = {"tool": "check_directory", "url": "https://unrelated.invalid/private/"}
    planner = Planner([[directory(f"observed-{i}"), outside] for i in range(5)])
    ctx = BudgetContext()
    advisor = advisor_for(ctx, planner)

    await drain(advisor)

    assert advisor.budget_mode is True
    assert advisor.progress["round_policy"] == "budget"
    assert advisor.progress["max_rounds"] is None
    assert 5 <= advisor.progress["round"] == planner.calls <= 8
    assert advisor.dispatcher.actions == 5
    assert len(ctx.http.calls) == ctx.requests_sent == 5
    assert all(url.startswith("https://example.test/observed-") for url in ctx.http.calls)
    assert advisor.progress["action_budget"] <= ctx.limits["request_budget"]
    assert advisor.progress["stop_reason"] == "no_new_checks"


async def test_ordinary_scan_keeps_three_round_ceiling():
    planner = Planner([[directory(f"observed-{i}")] for i in range(10)])
    ctx = BudgetContext(autopilot=False)
    advisor = advisor_for(ctx, planner)
    for _ in range(8):
        await advisor.review(OBSERVATIONS, force=True)
    assert advisor.budget_mode is False
    assert advisor.progress["max_rounds"] == 3
    assert planner.calls == advisor.progress["round"] == 3
    assert len(ctx.http.calls) == 3


async def test_duplicate_rounds_stop_without_repeated_target_requests():
    planner = Planner([[directory("observed")]] * 20)
    ctx = BudgetContext()
    advisor = advisor_for(ctx, planner)
    await drain(advisor)
    assert planner.calls == 4  # One useful round, then three duplicate-only rounds.
    assert ctx.http.calls == ["https://example.test/observed/"]
    assert advisor.progress["stop_reason"] == "no_new_checks"
    await advisor.review(OBSERVATIONS, force=True)
    assert planner.calls == 4


async def test_new_unique_check_resets_consecutive_no_progress_count():
    planner = Planner(
        [[directory("first")]] * 3 + [[directory("second")]] + [[directory("second")]] * 3
    )
    ctx = BudgetContext()
    advisor = advisor_for(ctx, planner)
    await drain(advisor)
    assert planner.calls == 7
    assert ctx.http.calls == ["https://example.test/first/", "https://example.test/second/"]
    assert advisor.progress["stop_reason"] == "no_new_checks"


async def test_denied_only_rounds_stop_and_never_send_out_of_scope_or_generated_queries():
    denied = [
        {"tool": "check_directory", "url": "https://unrelated.invalid/"},
        {"tool": "check_directory", "url": "https://example.test/excluded/"},
        {"tool": "inspect_endpoint", "url": "https://example.test/?new=unobserved"},
    ]
    planner = Planner([denied] * 10)
    ctx = BudgetContext()
    advisor = advisor_for(ctx, planner)
    await drain(advisor)
    assert planner.calls == 3
    assert ctx.http.calls == [] and ctx.requests_sent == 0
    assert advisor.dispatcher.actions == 0
    assert advisor.progress["stop_reason"] == "no_new_checks"


@pytest.mark.parametrize("failure", ["dns_or_redirect_denied", "network_error"])
async def test_post_approval_failures_and_failed_visits_do_not_reset_no_progress(
    monkeypatch, failure
):
    ctx = BudgetContext()
    planner = Planner([[directory(f"unreachable-{i}")] for i in range(20)])
    advisor = advisor_for(ctx, planner)
    attempted = []

    async def failing_get(url, **kwargs):
        attempted.append(url)
        # Failed queued visits grow this set in the real pipeline, without yielding evidence.
        ctx.visited.add(url)
        if failure == "network_error":
            ctx.requests_sent += 1
            raise httpx.ConnectError("Synthetic connection failure")
        raise ScopeDenied("Resolved address or redirect destination was denied")

    monkeypatch.setattr(ctx.http, "get", failing_get)
    await drain(advisor)

    assert planner.calls == len(attempted) == 3
    assert advisor.dispatcher.actions == 3  # Approval alone is not completed reconnaissance.
    assert advisor.progress["no_progress_rounds"] == 3
    assert advisor.progress["stop_reason"] == "no_new_checks"
    assert not any(kind == "ai_action_executed" for kind, _ in ctx.events)
    await advisor.review(OBSERVATIONS, force=True)
    assert planner.calls == 3


async def test_action_budget_stops_planning_without_exceeding_project_request_budget():
    ctx = BudgetContext(budget=4)
    planner = Planner([[directory(f"item-{i}") for i in range(20)]] * 10)
    advisor = advisor_for(ctx, planner)
    await drain(advisor)
    assert advisor.dispatcher.actions == ctx.requests_sent == 4
    assert advisor.progress["action_budget"] == 4
    assert advisor.progress["stop_reason"] == "action_budget_reached"
    assert planner.calls == 1


async def test_deterministic_and_ai_requests_share_the_same_remaining_budget():
    ctx = BudgetContext(budget=6, used=4)
    planner = Planner([[directory(f"observed-{i}")] for i in range(10)])
    advisor = advisor_for(ctx, planner)
    await drain(advisor)
    assert len(ctx.http.calls) == 2
    assert ctx.requests_sent == 6 and ctx.remaining_request_budget() == 0
    assert planner.calls == 2
    assert advisor.can_continue() is False


async def test_cancellation_after_four_rounds_blocks_the_next_approved_request():
    ctx = BudgetContext()

    class Cancels(Planner):
        async def suggest_safe_next_checks(self, observations):
            result = await super().suggest_safe_next_checks(observations)
            if self.calls == 5:
                ctx.cancelled = True
            return result

    planner = Cancels([[directory(f"observed-{i}")] for i in range(10)])
    advisor = advisor_for(ctx, planner)
    for _ in range(4):
        await advisor.review(OBSERVATIONS, force=True)
    with pytest.raises(ScanCancelled):
        await advisor.review(OBSERVATIONS, force=True)
    assert len(ctx.http.calls) == 4 and planner.calls == 5
    with pytest.raises(ScanCancelled):
        await advisor.review(OBSERVATIONS, force=True)
    assert len(ctx.http.calls) == 4 and planner.calls == 5


async def test_cancellation_between_invalid_output_and_format_repair_blocks_second_provider_call():
    ctx = BudgetContext()
    requests = []

    def respond(request):
        requests.append(request)
        ctx.cancelled = True
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Synthetic invalid JSON"}}]},
        )

    provider = OpenAIProvider(
        "synthetic-key", "configured-model", transport=httpx.MockTransport(respond)
    )
    advisor = advisor_for(ctx, provider)
    with pytest.raises(ScanCancelled):
        await advisor.review(OBSERVATIONS, force=True)
    assert len(requests) == 1
    assert str(requests[0].url) == "https://api.openai.com/v1/chat/completions"
    assert ctx.http.calls == []
    with pytest.raises(ScanCancelled):
        await advisor.review(OBSERVATIONS, force=True)
    assert len(requests) == 1 and ctx.http.calls == []


@pytest.mark.parametrize("error", [ProviderRefused("Declined"), ProviderUnavailable("Offline")])
async def test_provider_failure_after_four_rounds_does_not_restart_or_retry(error):
    ctx = BudgetContext()
    planner = Planner([[directory(f"observed-{i}")] for i in range(4)] + [error])
    advisor = advisor_for(ctx, planner)
    await drain(advisor)
    assert planner.calls == 5 and len(ctx.http.calls) == 4
    assert advisor.progress["status"] == (
        "refused" if isinstance(error, ProviderRefused) else "unavailable"
    )
    assert advisor.can_continue() is False
    await advisor.review(OBSERVATIONS, force=True)
    advisor.finish()
    assert planner.calls == 5
    assert advisor.progress["status"] in {"refused", "unavailable"}


async def test_zero_action_limit_cannot_create_an_empty_planning_loop(monkeypatch):
    monkeypatch.setattr(settings, "ai_max_actions_per_round", 0)
    ctx = BudgetContext()
    planner = Planner([[directory("observed")]] * 10)
    advisor = advisor_for(ctx, planner)
    assert advisor.can_continue() is False
    await advisor.review(OBSERVATIONS, force=True)
    assert planner.calls == 0 and ctx.http.calls == []


async def test_dispatcher_raises_ceiling_only_for_budget_driven_autopilot():
    large = BudgetContext(budget=50000)
    assert SafeToolDispatcher(large, max_actions=100000).max_actions == 10000
    ctx = BudgetContext(budget=100)
    dispatcher = SafeToolDispatcher(ctx, max_actions=10000)
    assert dispatcher.max_actions == 100
    for i in range(81):
        await dispatcher.dispatch(directory(f"observed-{i}"))
    assert len(ctx.http.calls) == 81
    assert len(dispatcher.history) <= 80
    assert "observed-80" in json.dumps(list(dispatcher.history))

    ordinary = BudgetContext(budget=100, autopilot=False)
    ordinary_dispatcher = SafeToolDispatcher(ordinary, max_actions=10000)
    assert ordinary_dispatcher.max_actions == 60
    for i in range(60):
        await ordinary_dispatcher.dispatch(directory(f"observed-{i}"))
    with pytest.raises(ScopeDenied, match="ceiling"):
        await ordinary_dispatcher.dispatch(directory("one-too-many"))
    assert len(ordinary.http.calls) == 60


async def test_pipeline_keeps_planning_after_three_rounds_and_drains_new_work(monkeypatch):
    configure(monkeypatch)

    class PipelinePlanner(Planner):
        async def prioritize_findings(self, findings):
            return []

        async def analyze_finding(self, finding, evidence):
            from test_intelligence import ANALYSIS

            return ANALYSIS

    planner = PipelinePlanner(
        [
            [{"tool": "check_directory", "url": f"http://example.test:8080/ai-observed-{i}/"}]
            for i in range(5)
        ]
    )
    monkeypatch.setattr("app.intelligence.live.get_provider", lambda: planner)
    scan_id = seed("exposure")
    with SessionLocal() as db:
        db.add(ScanEvent(scan_id=scan_id, kind="autopilot_requested", data={"version": 1}))
        db.commit()
    from app.workers.pipeline import run_scan

    await run_scan(scan_id)

    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        assert scan.requests_sent <= scan.limits["request_budget"]
        progress = list(
            db.scalars(
                select(ScanEvent)
                .where(ScanEvent.scan_id == scan_id, ScanEvent.kind == "ai_progress")
                .order_by(ScanEvent.created_at)
            )
        )[-1].data
        assert progress["round"] >= 5 and progress["max_rounds"] is None
    paths = [path for _, path in FixtureTransport.calls]
    assert all(f"/ai-observed-{i}/" in paths for i in range(5))
    assert 5 <= planner.calls <= 8


async def test_budget_exhausted_during_ai_redirect_has_terminal_ai_and_scan_progress(monkeypatch):
    configure(monkeypatch)
    original_stream = FixtureTransport.stream

    def stream(self, method, url, headers, **kwargs):
        parts = urlsplit(url)
        if parts.path in {"/", "/ai-redirect/", "/ai-final/"}:
            assert parts.hostname == "93.184.216.34"
            assert headers["Host"] == "example.test:8080"
            self.calls.append((method, parts.path))
            assert parts.path != "/ai-final/", "No request may exceed the shared budget"
            return Stream(
                httpx.Response(
                    302 if parts.path == "/ai-redirect/" else 200,
                    headers={"content-type": "text/plain", "location": "/ai-final/"},
                    content=b"Synthetic local target",
                )
            )
        return original_stream(self, method, url, headers, **kwargs)

    async def no_findings(ctx, page):
        return []

    original_review = LiveAdvisor.review

    async def first_page_review(self, observations, *, force=False):
        return await original_review(self, observations, force=True)

    planner = Planner(
        [[{"tool": "check_directory", "url": "http://example.test:8080/ai-redirect/"}]]
    )
    monkeypatch.setattr(FixtureTransport, "stream", stream)
    monkeypatch.setattr("app.scanners.analyze_page", no_findings)
    monkeypatch.setattr("app.intelligence.live.get_provider", lambda: planner)
    monkeypatch.setattr(LiveAdvisor, "review", first_page_review)
    scan_id = seed("exposure", budget=2)
    with SessionLocal() as db:
        db.add(ScanEvent(scan_id=scan_id, kind="autopilot_requested", data={"version": 1}))
        db.commit()
    from app.workers.pipeline import run_scan

    await run_scan(scan_id)

    assert FixtureTransport.calls == [("GET", "/"), ("GET", "/ai-redirect/")]
    assert planner.calls == 1
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete" and scan.finished_at and scan.requests_sent == 2
        assert not scan.errors
        events = list(
            db.scalars(
                select(ScanEvent).where(ScanEvent.scan_id == scan_id).order_by(ScanEvent.created_at)
            )
        )
        progress = [event.data for event in events if event.kind == "ai_progress"][-1]
        assert progress["status"] == "complete"
        assert progress["stop_reason"] == "request_budget_reached"
        completion = next(event.data for event in events if event.kind == "scan_completed")
        assert completion["reason"] == "request_budget_reached"
        assert any(event.kind == "budget_exhausted" for event in events)


async def test_unchanged_findings_reuse_priorities_until_saved_observations_change():
    scan_id = seed("exposure")
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        finding = Finding(
            project_id=scan.project_id,
            scan_id=scan_id,
            scanner="directory_listing",
            title="Synthetic directory index",
            category="exposure",
            description="Synthetic index evidence for an authorized local test.",
            severity="low",
            confidence=95,
            affected_url="http://example.test:8080/uploads/",
            evidence_summary="Synthetic directory index observed with two listed entries.",
            recommendation="Disable directory indexing when unnecessary.",
            fingerprint="a" * 64,
        )
        db.add(finding)
        db.flush()
        finding_id = finding.id
        db.add(ScanFinding(scan_id=scan_id, finding_id=finding_id))
        db.commit()

    class PriorityCounter(Planner):
        def __init__(self):
            super().__init__([])
            self.priority_calls = 0
            self.analysis_calls = 0

        async def prioritize_findings(self, findings):
            self.priority_calls += 1
            return [
                {"finding_id": item["id"], "score": 80, "reason": "Review saved index evidence"}
                for item in findings
            ]

        async def analyze_finding(self, finding, evidence):
            from test_intelligence import ANALYSIS

            self.analysis_calls += 1
            return ANALYSIS

    ctx = BudgetContext()
    ctx.scan_id = scan_id
    provider = PriorityCounter()
    advisor = LiveAdvisor(ctx, provider)
    ctx.ai = advisor
    await advisor.triage()
    await advisor.triage()
    assert provider.priority_calls == provider.analysis_calls == 1
    assert ctx.http.calls == []

    with SessionLocal() as db:
        finding = db.get(Finding, finding_id)
        finding.evidence_summary = "Synthetic directory index observed with three listed entries."
        db.commit()
    await advisor.triage()
    assert provider.priority_calls == 2


def test_check_history_and_remaining_budget_are_sanitized_before_provider_analysis():
    secret = "synthetic-history-secret-never-send"
    summaries = observation_summary(
        [
            {
                "url": "https://example.test/",
                "remaining_request_budget": 42,
                "check_history": [
                    {
                        "tool": "check_directory",
                        "url": "https://example.test/uploads/?token=" + secret,
                        "status": 404,
                        "reason": "Authorization: Bearer " + secret,
                    }
                ],
                "headers": {"authorization": "Bearer " + secret},
                "body": secret,
            }
        ]
    )
    assert summaries[0]["remaining_request_budget"] == 42
    assert summaries[0]["check_history"]
    assert secret not in json.dumps(summaries)
