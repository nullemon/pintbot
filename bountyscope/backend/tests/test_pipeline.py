"""Exercise full deterministic orchestration against the synthetic ASGI target."""

import importlib.util
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.http import RateLimiter
from app.models import Evidence, Finding, Project, Scan, ScanEvent
from app.scope.guard import ScopeGuard
from app.workers.pipeline import run_scan

spec = importlib.util.spec_from_file_location(
    "synthetic_target", Path(__file__).parents[2] / "fixture" / "app.py"
)
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
target = TestClient(fixture.app, follow_redirects=False)


class Stream:
    def __init__(self, response):
        self.status_code = response.status_code
        self.headers = response.headers
        self.body = response.content
        self.extensions = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def aiter_raw(self, chunk_size=8192):
        for i in range(0, len(self.body), chunk_size):
            yield self.body[i : i + chunk_size]


class FixtureTransport:
    calls = []

    def __init__(self, **kwargs):
        assert kwargs["trust_env"] is False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def stream(self, method, url, headers, **kwargs):
        parts = urlsplit(url)
        assert parts.hostname == "93.184.216.34"  # Actual transport pin, not host DNS.
        assert headers["Host"] == "example.test:8080"
        self.calls.append((method, parts.path))
        return Stream(
            target.request(
                method,
                "http://example.test:8080"
                + parts.path
                + ("?" + parts.query if parts.query else ""),
                headers=headers,
            )
        )


async def dns(host):
    return ["93.184.216.34"]


async def no_wait(*args):
    pass


def seed(profile="standard", budget=300):
    with SessionLocal() as db:
        p = Project(name="Pipeline lab", authorization_confirmed=True)
        db.add(p)
        db.flush()
        scan = Scan(
            project_id=p.id,
            target="http://example.test:8080/",
            scan_profile=profile,
            scope_snapshot=[
                {"rule_type": "allow_domain", "value": "example.test"},
                {"rule_type": "allow_port", "value": "8080"},
                {"rule_type": "deny_path", "value": "/excluded"},
            ],
            limits={
                "max_rps": 10,
                "max_concurrency": 3,
                "max_depth": 4,
                "url_cap": 100,
                "request_budget": budget,
            },
        )
        db.add(scan)
        db.commit()
        return scan.id


def configure(monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", FixtureTransport)
    monkeypatch.setattr("app.workers.pipeline.ScopeGuard", lambda rules: ScopeGuard(rules, dns))
    monkeypatch.setattr(RateLimiter, "pace", no_wait)
    FixtureTransport.calls = []


async def test_complete_pipeline_redaction_scope_and_reports(monkeypatch):
    configure(monkeypatch)
    scan_id = seed()
    await run_scan(scan_id)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        assert scan.finished_at and scan.requests_sent <= 100
        findings = list(db.scalars(select(Finding)))
        assert {
            "directory_listing",
            "security_headers",
            "cookies",
            "cors",
            "exposed_files",
            "javascript",
            "information_disclosure",
        } <= {f.scanner for f in findings}
        evidence = list(db.scalars(select(Evidence)))
        assert "FAKE_TEST_KEY_DO_NOT_USE" not in str([e.__dict__ for e in evidence])
        assert "FAKE_TEST_PASSWORD" not in str([e.__dict__ for e in evidence])
        assert any(e.request_metadata.get("headers", {}).get("Origin") for e in evidence)
        assert any(e.request_metadata["method"] == "HEAD" for e in evidence)
        events = list(db.scalars(select(ScanEvent).where(ScanEvent.scan_id == scan_id)))
        assert any(e.kind == "redirect_blocked" for e in events)
        assert any(e.kind == "scope_check" and e.data.get("allowed") is False for e in events)
        assert not any(e.kind == "scanner_error" for e in events)
        assert not scan.errors
        from app.reports.generator import generate_report

        directory = next(f for f in findings if f.scanner == "directory_listing")
        proof = [e for e in evidence if e.finding_id == directory.id]
        assert "42" in generate_report(directory, proof, "html")
    assert not any(
        "image_" in path or "/excluded" in path or "/delete/" in path
        for _, path in FixtureTransport.calls
    )


async def test_passive_catalogs_but_never_crawls(monkeypatch):
    configure(monkeypatch)
    scan_id = seed("passive")
    await run_scan(scan_id)
    assert {path for _, path in FixtureTransport.calls} == {"/", "/robots.txt", "/sitemap.xml"}
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete" and scan.endpoints_found >= 5


async def test_budget_finishes_with_explicit_partial_event(monkeypatch):
    configure(monkeypatch)
    scan_id = seed(budget=2)
    await run_scan(scan_id)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete" and scan.requests_sent == 2
        assert db.scalars(select(ScanEvent).where(ScanEvent.kind == "budget_exhausted")).first()


async def test_rescan_keeps_dedup_and_fresh_scan_associations(monkeypatch):
    from app.models import ScanFinding

    configure(monkeypatch)
    first = seed()
    await run_scan(first)
    with SessionLocal() as db:
        scan = db.get(Scan, first)
        first_count = scan.findings_found
        old_evidence = len(list(db.scalars(select(Evidence))))
        second = Scan(
            project_id=scan.project_id,
            target=scan.target,
            scope_snapshot=scan.scope_snapshot,
            limits=scan.limits,
            scan_profile=scan.scan_profile,
        )
        db.add(second)
        db.commit()
        second_id = second.id
    await run_scan(second_id)
    with SessionLocal() as db:
        assert db.get(Scan, second_id).status == "complete"
        assert db.get(Scan, second_id).findings_found == first_count
        assert len(list(db.scalars(select(Finding)))) == first_count
        assert (
            len(list(db.scalars(select(ScanFinding).where(ScanFinding.scan_id == second_id))))
            == first_count
        )
        assert len(list(db.scalars(select(Evidence)))) > old_evidence
        directory = db.scalars(
            select(Finding).where(Finding.scanner == "directory_listing")
        ).first()
        evidence = list(db.scalars(select(Evidence).where(Evidence.finding_id == directory.id)))
        assert len({e.request_metadata["url"] for e in evidence}) >= 2
        assert {e.request_metadata["scan_id"] for e in evidence} == {first, second_id}
