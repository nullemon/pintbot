"""Autopilot retains scope, finishes final discoveries and drafts real evidence only."""

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from test_live_ai import Provider
from test_page_review_api import project
from test_pipeline import FixtureTransport, Stream, configure, seed

from app.core.config import settings
from app.core.database import SessionLocal
from app.intelligence.live import LiveAdvisor
from app.main import app
from app.models import Finding, Report, Scan, ScanEvent
from app.scope.guard import ScopeGuard
from app.workers.pipeline import run_scan

client = TestClient(app, headers={"Authorization": "Bearer test-api-token"})


@pytest.fixture
def admission(monkeypatch):
    from types import SimpleNamespace

    state = SimpleNamespace(dispatched=[])

    async def dns(host):
        return ["93.184.216.34"]

    monkeypatch.setattr("app.api.routes.ScopeGuard", lambda rules: ScopeGuard(rules, dns))
    monkeypatch.setattr(
        "app.workers.scan_tasks.dispatch_scan.delay", lambda key: state.dispatched.append(key)
    )
    return state


def test_url_only_autopilot_uses_existing_scope_and_commits_mode_before_dispatch(admission):
    p = project()
    response = client.post("/api/autopilot", json={"target": "https://example.com/"})
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["project_id"] == p["id"] and data["autopilot"] is True
    assert admission.dispatched == [data["id"]]
    with SessionLocal() as db:
        assert db.scalar(
            select(ScanEvent).where(
                ScanEvent.scan_id == data["id"], ScanEvent.kind == "autopilot_requested"
            )
        )
    assert client.get(f"/api/scans/{data['id']}").json()["autopilot"] is True


def test_autopilot_never_invents_authorization_and_rejects_ambiguous_projects(admission):
    assert client.post("/api/autopilot", json={"target": "https://example.com/"}).status_code == 422
    project(authorization_confirmed=False)
    assert client.post("/api/autopilot", json={"target": "https://example.com/"}).status_code == 422
    p = project()
    project()
    assert client.post("/api/autopilot", json={"target": "https://example.com/"}).status_code == 409
    assert not admission.dispatched
    assert (
        client.post(
            "/api/autopilot", json={"project_id": p["id"], "target": "https://evil.invalid/"}
        ).status_code
        == 422
    )
    assert not admission.dispatched
    assert (
        TestClient(app).post("/api/autopilot", json={"target": "https://example.com/"}).status_code
        == 401
    )


async def test_autopilot_generates_local_drafts_without_verifying_findings(monkeypatch):
    configure(monkeypatch)
    scan_id = seed("exposure")
    with SessionLocal() as db:
        db.add(ScanEvent(scan_id=scan_id, kind="autopilot_requested", data={"version": 1}))
        db.commit()
    await run_scan(scan_id)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete" and not scan.errors
        reports = list(db.scalars(select(Report)))
        assert reports and len(reports) <= 40
        assert {r.format for r in reports} == {"html", "markdown"}
        assert all("FAKE_TEST_KEY_DO_NOT_USE" not in r.content for r in reports)
        assert all(db.get(Finding, r.finding_id).status == "needs_verification" for r in reports)
        completion = db.scalar(select(ScanEvent).where(ScanEvent.kind == "scan_completed")).data
        assert completion["autopilot"] is True and completion["pending_urls"] == 0
        assert completion["response_status_counts"]["200"] > 0
        event = db.scalar(select(ScanEvent).where(ScanEvent.kind == "autopilot_reports_created"))
        assert event.data["count"] == len(reports) and event.data["requires_manual_verification"]


async def test_final_ai_discoveries_are_drained_before_scan_completes(monkeypatch):
    configure(monkeypatch)
    original_stream = FixtureTransport.stream

    def stream(self, method, url, headers, **kwargs):
        if url.endswith("/ai-seed"):
            self.calls.append((method, "/ai-seed"))
            return Stream(
                httpx.Response(
                    200,
                    headers={"content-type": "text/html"},
                    content=b'<script src="/ai-child.js"></script><a href="https://outside.invalid/">Third party</a>',
                )
            )
        if url.endswith("/ai-child.js"):
            self.calls.append((method, "/ai-child.js"))
            return Stream(
                httpx.Response(
                    200,
                    headers={"content-type": "application/javascript"},
                    content=b"const safe = true;",
                )
            )
        return original_stream(self, method, url, headers, **kwargs)

    class FinalProvider(Provider):
        async def suggest_safe_next_checks(self, observations):
            self.plans += 1
            return (
                [
                    {
                        "tool": "inspect_endpoint",
                        "url": "http://example.test:8080/ai-seed",
                        "reason": "Inspect an authorized candidate",
                    }
                ]
                if self.plans == 1
                else []
            )

    original_review = LiveAdvisor.review

    async def only_final(self, observations, *, force=False):
        return await original_review(self, observations, force=True) if force else []

    provider = FinalProvider()
    monkeypatch.setattr(FixtureTransport, "stream", stream)
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr("app.intelligence.live.get_provider", lambda: provider)
    monkeypatch.setattr(LiveAdvisor, "review", only_final)
    scan_id = seed("exposure")
    await run_scan(scan_id)
    assert ("GET", "/ai-child.js") in FixtureTransport.calls
    assert provider.plans <= 3
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete" and not scan.errors
        events = list(
            db.scalars(
                select(ScanEvent).where(ScanEvent.scan_id == scan_id).order_by(ScanEvent.created_at)
            )
        )
        child = next(
            i
            for i, e in enumerate(events)
            if e.kind == "request_sent" and e.data["path"].endswith("/ai-child.js")
        )
        finished = next(i for i, e in enumerate(events) if e.kind == "scan_completed")
        assert child < finished
        assert any(
            e.kind == "discovered_out_of_scope" and "outside.invalid" in str(e.data) for e in events
        )
        assert events[finished].data["pending_urls"] == 0


@pytest.mark.parametrize(
    "budget,url_cap,reason", [(2, 100, "request_budget_reached"), (300, 1, "url_limit_reached")]
)
async def test_completion_distinguishes_limits(monkeypatch, budget, url_cap, reason):
    configure(monkeypatch)
    scan_id = seed("exposure", budget=budget)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        scan.limits = {**scan.limits, "url_cap": url_cap}
        db.commit()
    await run_scan(scan_id)
    response = client.get(f"/api/scans/{scan_id}").json()
    assert response["status"] == "complete"
    assert response["completion"]["reason"] == reason
    assert response["requests_sent"] <= budget
