"""Page reviews inspect selected resources without turning into whole-site crawls."""

from sqlalchemy import select
from test_pipeline import FixtureTransport, configure, seed

from app.core.database import SessionLocal
from app.models import Endpoint, Finding, Scan, ScanEvent
from app.workers.pipeline import ScanContext, run_scan


def page_review(profile="standard", snapshot=None, target=None):
    scan_id = seed(profile)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        if target:
            scan.target = target
        db.add(
            ScanEvent(
                scan_id=scan_id,
                kind="page_review_requested",
                data={
                    "version": 1,
                    "focus": "Review the referenced media directories and files.",
                    "browser_snapshot": snapshot,
                },
            )
        )
        db.commit()
    return scan_id


async def test_single_page_reviews_scripts_but_not_document_links_or_site_maps(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review()
    await run_scan(scan_id)
    requested = {path for _, path in FixtureTransport.calls}
    assert {"/", "/assets/app.js", "/assets/app.js.map"} <= requested
    assert not requested & {
        "/robots.txt",
        "/sitemap.xml",
        "/bad-headers",
        "/cors-test",
        "/debug",
        "/directory/",
        "/api/v1/public",
        "/excluded/private",
        "/delete/account",
    }
    assert ("HEAD", "/assets/app.js.map") in FixtureTransport.calls
    assert ("HEAD", "/uploads/users/123/avatar.jpg") in FixtureTransport.calls
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        assert not scan.errors
        urls = {endpoint.url for endpoint in db.scalars(select(Endpoint))}
        assert "http://example.test:8080/bad-headers" in urls
        assert "http://example.test:8080/api/v1/public" in urls
        assert not any("out-of-scope" in url for url in urls)
        findings = list(db.scalars(select(Finding)))
        assert any(f.scanner == "directory_listing" for f in findings)
        assert any(f.scanner == "javascript" and f.confidence == 85 for f in findings)
        assert not any(f.affected_url.endswith("/debug") for f in findings)
        assert any(
            event.kind == "discovered_out_of_scope"
            and "out-of-scope.test" in event.data.get("url", "")
            for event in db.scalars(select(ScanEvent))
        )


async def test_exposure_review_does_not_add_site_wide_directory_seeds(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review("exposure")
    await run_scan(scan_id)
    requested = {path for _, path in FixtureTransport.calls}
    assert not requested & {
        "/images/",
        "/image/",
        "/img/",
        "/thumbnails/",
        "/cdn/",
        "/wp-content/",
        "/wp-content/uploads/",
        "/robots.txt",
        "/sitemap.xml",
    }
    assert "/uploads/" in requested
    assert "/uploads/users/" in requested
    with SessionLocal() as db:
        assert db.get(Scan, scan_id).status == "complete"
        assert not db.scalar(
            select(ScanEvent).where(ScanEvent.kind == "exposure_directory_candidates")
        )


async def test_browser_hints_are_scope_checked_and_never_confirm_findings(monkeypatch):
    configure(monkeypatch)
    snapshot = {
        "url": "http://example.test:8080/",
        "references": [
            {"url": "http://example.test:8080/debug", "kind": "image"},
            {"url": "http://example.test:8080/unobserved-private", "kind": "form"},
            {"url": "http://example.test:8080/unobserved-form.jpg", "kind": "form"},
            {"url": "http://example.test:8080/unobserved-page", "kind": "link"},
            {"url": "http://example.test:8080/unobserved-frame.png", "kind": "iframe"},
            {"url": "http://out-of-scope.test/secret.js", "kind": "script"},
            {"url": "http://example.test:8080/excluded/private", "kind": "image"},
        ],
        "forms": {"total": 7, "auth_inputs": 4, "file_inputs": 2},
        "secure_context": False,
    }
    scan_id = page_review(snapshot=snapshot)
    await run_scan(scan_id)
    requested = {path for _, path in FixtureTransport.calls}
    assert "/unobserved-private" not in requested
    assert "/unobserved-page" not in requested
    assert "/unobserved-form.jpg" not in requested
    assert "/unobserved-frame.png" not in requested
    assert "/excluded/private" not in requested
    assert "/secret.js" not in requested
    assert ("HEAD", "/debug") in FixtureTransport.calls
    assert ("GET", "/debug") not in FixtureTransport.calls
    with SessionLocal() as db:
        assert db.get(Scan, scan_id).status == "complete"
        assert not db.scalar(select(Finding).where(Finding.affected_url.endswith("/debug")))
        assert db.scalar(select(Endpoint).where(Endpoint.source == "browser:form"))


async def test_browser_observation_is_untrusted_and_cannot_claim_a_response(monkeypatch):
    configure(monkeypatch)
    snapshot = {
        "url": "http://example.test:8080/",
        "references": [{"url": "http://example.test:8080/api/private", "kind": "api"}],
        "forms": {"total": 1, "auth_inputs": 1, "file_inputs": 0, "status": 200},
        "secure_context": False,
        "status": 200,
        "signals": ["directory_index_confirmed"],
    }
    scan_id = page_review(snapshot=snapshot)
    with SessionLocal() as db:
        ctx = ScanContext(db.get(Scan, scan_id))
    observed = await ctx.browser_observation()
    assert observed["provenance"] == "browser_snapshot_unverified"
    assert observed["form_summary"] == {"total": 1, "auth_inputs": 1, "file_inputs": 0}
    assert observed["researcher_focus"]
    assert "status" not in observed
    assert "signals" not in observed
    assert not ctx.queue
    assert not FixtureTransport.calls
    with SessionLocal() as db:
        assert not db.scalar(select(Finding))


async def test_browser_snapshot_for_another_page_is_ignored(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review(
        snapshot={
            "url": "http://example.test:8080/another-page",
            "references": [{"url": "http://example.test:8080/secret.js", "kind": "script"}],
        }
    )
    with SessionLocal() as db:
        ctx = ScanContext(db.get(Scan, scan_id))
    assert await ctx.browser_observation() is None
    assert not ctx.known


async def test_large_browser_navigation_does_not_hide_late_scripts_or_scope_violations(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review(
        snapshot={
            "url": "http://example.test:8080/",
            "references": [
                {"url": f"http://example.test:8080/navigation-{index}", "kind": "link"}
                for index in range(90)
            ]
            + [
                {"url": "http://example.test:8080/assets/app.js", "kind": "script"},
                {"url": "http://out-of-scope.test/late-reference", "kind": "link"},
            ],
            "forms": {"total": 0, "auth_inputs": 0, "file_inputs": 0},
        }
    )
    await run_scan(scan_id)
    assert ("GET", "/assets/app.js") in FixtureTransport.calls
    assert not any("navigation-" in path for _, path in FixtureTransport.calls)
    assert not any("late-reference" in path for _, path in FixtureTransport.calls)
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        assert scan.endpoints_found <= 80
        assert any(
            event.kind == "discovered_out_of_scope"
            and event.data.get("url") == "http://out-of-scope.test/late-reference"
            for event in db.scalars(select(ScanEvent).where(ScanEvent.scan_id == scan_id))
        )


async def test_worker_enforces_page_caps_and_queues_a_later_resource_reference(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review()
    with SessionLocal() as db:
        ctx = ScanContext(db.get(Scan, scan_id))
    assert ctx.limits == {
        "max_rps": 2,
        "max_concurrency": 3,
        "max_depth": 1,
        "url_cap": 80,
        "request_budget": 200,
    }
    url = "http://example.test:8080/assets/app.js"
    assert await ctx.remember_url(url, "html:a")
    assert not ctx.queue
    assert not await ctx.remember_url(url, "html:script")
    assert list(ctx.queue) == [(url, 0, "html:script")]
    for index in range(100):
        ctx.add_directory_candidates(f"http://example.test:8080/media/{index}/file.jpg")
    assert len(ctx.directory_candidates_seen) == 20
    assert len(ctx.directory_candidates) == 20


async def test_passive_page_review_fetches_only_selected_page(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review("passive")
    await run_scan(scan_id)
    assert FixtureTransport.calls == [("GET", "/")]
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        assert scan.status == "complete", scan.errors
        assert scan.endpoints_found > 1


async def test_page_review_preserves_a_project_depth_limit_of_zero(monkeypatch):
    configure(monkeypatch)
    scan_id = page_review(
        snapshot={
            "url": "http://example.test:8080/",
            "references": [{"url": "http://example.test:8080/assets/app.js", "kind": "script"}],
        }
    )
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        scan.limits = {**scan.limits, "max_depth": 0}
        db.commit()
        ctx = ScanContext(scan)
    assert ctx.limits["max_depth"] == 0
    await ctx.remember_url("http://example.test:8080/", "manual")
    await ctx.browser_observation()
    assert list(ctx.queue) == [("http://example.test:8080/", 0, "manual")]
    await run_scan(scan_id)
    assert "/assets/app.js" not in {path for _, path in FixtureTransport.calls}
    with SessionLocal() as db:
        assert db.get(Scan, scan_id).status == "complete"
