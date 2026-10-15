"""Single-page reviews require authorization and accept only bounded browser metadata."""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.intelligence.summaries import observation_summary
from app.main import app
from app.models import Scan, ScanEvent
from app.scope.guard import ScopeGuard

client = TestClient(app, headers={"Authorization": "Bearer test-api-token"})


@pytest.fixture
def admission(monkeypatch):
    state = SimpleNamespace(resolved=[], dispatched=[], addresses=["93.184.216.34"])

    async def resolve(host):
        state.resolved.append(host)
        return state.addresses

    monkeypatch.setattr(
        "app.api.routes.ScopeGuard", lambda rules: ScopeGuard(rules, resolver=resolve)
    )
    monkeypatch.setattr(
        "app.workers.scan_tasks.dispatch_scan.delay",
        lambda scan_id: state.dispatched.append(scan_id),
    )
    return state


def project(**overrides):
    body = {
        "name": "Authorized page review",
        "authorization_confirmed": True,
        "scope": [
            {"rule_type": "allow_domain", "value": "example.com"},
            {"rule_type": "allow_port", "value": "443"},
            {"rule_type": "deny_path", "value": "/excluded"},
        ],
        **overrides,
    }
    response = client.post("/api/projects", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def body(project_id, **overrides):
    return {
        "project_id": project_id,
        "target": "https://example.com/page",
        "authorization_confirmed": True,
        **overrides,
    }


def review_event(scan_id):
    with SessionLocal() as db:
        return db.scalar(
            select(ScanEvent).where(
                ScanEvent.scan_id == scan_id, ScanEvent.kind == "page_review_requested"
            )
        ).data


@pytest.mark.parametrize("confirmed,review_confirmed", [(False, True), (True, False)])
def test_page_review_requires_project_and_separate_review_authorization(
    admission, confirmed, review_confirmed
):
    p = project(authorization_confirmed=confirmed)
    response = client.post(
        "/api/page-reviews", json=body(p["id"], authorization_confirmed=review_confirmed)
    )
    assert response.status_code == 403
    assert not admission.resolved and not admission.dispatched
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Scan)) == 0


def test_page_review_requires_api_authentication(admission):
    p = project()
    assert TestClient(app).post("/api/page-reviews", json=body(p["id"])).status_code == 401
    assert not admission.resolved and not admission.dispatched


@pytest.mark.parametrize(
    "target",
    [
        "https://example.com.attacker.invalid/page",
        "https://example.com:8443/page",
        "https://example.com/excluded/private",
        "https://user:synthetic-password@example.com/page",
        "https://example.com/logout",
    ],
)
def test_page_review_checks_scope_before_dns_or_queue(admission, target):
    p = project()
    response = client.post("/api/page-reviews", json=body(p["id"], target=target))
    assert response.status_code == 422
    assert "synthetic-password" not in response.text
    assert not admission.resolved and not admission.dispatched
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Scan)) == 0


@pytest.mark.parametrize("addresses", [["127.0.0.1"], ["10.0.0.5"], ["169.254.169.254"]])
def test_page_review_validates_resolved_addresses_before_queue(admission, addresses):
    p = project()
    admission.addresses = addresses
    response = client.post("/api/page-reviews", json=body(p["id"]))
    assert response.status_code == 422
    assert admission.resolved == ["example.com"]
    assert not admission.dispatched


def test_page_review_rejects_secret_query_target(admission):
    p = project()
    response = client.post(
        "/api/page-reviews",
        json=body(p["id"], target="https://example.com/page?token=synthetic-secret"),
    )
    assert response.status_code == 422
    assert "synthetic-secret" not in response.text
    assert admission.resolved == ["example.com"]
    assert not admission.dispatched


@pytest.mark.parametrize(
    "project_limits,expected",
    [
        ({}, {"request_budget": 200, "url_cap": 80, "max_depth": 1, "max_rps": 2}),
        (
            {"request_budget": 7, "url_cap": 3, "max_depth": 0, "max_rps": 0.5},
            {"request_budget": 7, "url_cap": 3, "max_depth": 0, "max_rps": 0.5},
        ),
    ],
)
def test_review_snapshots_scope_and_respects_lower_project_limits(
    admission, project_limits, expected
):
    p = project(**project_limits)
    response = client.post("/api/page-reviews", json=body(p["id"]))
    assert response.status_code == 201, response.text
    result = response.json()
    assert result["target"] == "https://example.com/page"
    assert result["status"] == "queued"
    assert result["limits"] == {**expected, "max_concurrency": 3}
    assert result["scope_snapshot"] == p["scope"]
    assert admission.resolved == ["example.com"]
    assert admission.dispatched == [result["id"]]
    assert client.post(f"/api/projects/{p['id']}/scope", json=[]).status_code == 200
    assert client.get(f"/api/scans/{result['id']}").json()["scope_snapshot"] == p["scope"]


def test_page_review_event_is_committed_before_worker_dispatch(admission, monkeypatch):
    p = project()
    captured = []

    def dispatch(scan_id):
        # A worker owns a different session and must see the mode before execution begins.
        with SessionLocal() as db:
            scan = db.get(Scan, scan_id)
            assert scan is not None and scan.status == "queued"
            event = db.scalar(
                select(ScanEvent).where(
                    ScanEvent.scan_id == scan_id, ScanEvent.kind == "page_review_requested"
                )
            )
            assert event is not None and event.data["version"] == 1
            captured.append(scan_id)

    monkeypatch.setattr("app.workers.scan_tasks.dispatch_scan.delay", dispatch)
    response = client.post("/api/page-reviews", json=body(p["id"]))
    assert response.status_code == 201
    assert captured == [response.json()["id"]]


def test_broker_failure_preserves_durable_page_review(admission, monkeypatch):
    p = project()

    def broker_unavailable(scan_id):
        raise ConnectionError("synthetic broker outage")

    monkeypatch.setattr("app.workers.scan_tasks.dispatch_scan.delay", broker_unavailable)
    response = client.post("/api/page-reviews", json=body(p["id"]))
    assert response.status_code == 201
    scan_id = response.json()["id"]
    assert response.json()["status"] == "queued"
    assert review_event(scan_id)["provenance"] == "manual_url"
    events = client.get(f"/api/scans/{scan_id}/events").json()["items"]
    assert {event["kind"] for event in events} == {"page_review_requested", "queue_pending"}


def test_context_must_match_the_selected_page(admission):
    p = project()
    response = client.post(
        "/api/page-reviews",
        json=body(p["id"], page_context={"url": "https://example.com/other"}),
    )
    assert response.status_code == 422
    assert "capture the tab again" in response.text
    assert not admission.dispatched


@pytest.mark.parametrize(
    "extra",
    [
        {"raw_html": "<p>synthetic-secret-value</p>"},
        {"page_context": {"url": "https://example.com/page", "cookies": "synthetic-secret-value"}},
        {
            "page_context": {
                "url": "https://example.com/page",
                "forms": {"values": {"password": "synthetic-secret-value"}},
            }
        },
        {
            "page_context": {
                "url": "https://example.com/page",
                "references": [
                    {"url": "/image.png", "kind": "image", "headers": "synthetic-secret-value"}
                ],
            }
        },
    ],
)
def test_page_review_rejects_raw_html_cookies_headers_and_form_values(admission, extra):
    p = project()
    response = client.post("/api/page-reviews", json=body(p["id"], **extra))
    assert response.status_code == 422
    assert "synthetic-secret-value" not in response.text
    assert not admission.resolved and not admission.dispatched


@pytest.mark.parametrize("value", [True, "1", -1, 10001, 1.5])
def test_form_counts_are_strict_bounded_integers(admission, value):
    p = project()
    response = client.post(
        "/api/page-reviews",
        json=body(
            p["id"],
            page_context={"url": "https://example.com/page", "forms": {"password_fields": value}},
        ),
    )
    assert response.status_code == 422
    assert not admission.resolved and not admission.dispatched


@pytest.mark.parametrize(
    "references",
    [
        [{"url": f"/image-{i}.png", "kind": "image"} for i in range(201)],
        [{"url": "/" + str(i) + "a" * 2970, "kind": "image"} for i in range(23)],
    ],
)
def test_browser_snapshot_reference_count_and_total_size_are_bounded(admission, references):
    p = project()
    response = client.post(
        "/api/page-reviews",
        json=body(
            p["id"], page_context={"url": "https://example.com/page", "references": references}
        ),
    )
    assert response.status_code == 422
    assert not admission.resolved and not admission.dispatched


def test_browser_snapshot_canonicalizes_redacts_and_keeps_third_party_as_unverified_clue(admission):
    p = project()
    secret_key = "sk-proj-" + "x" * 28
    response = client.post(
        "/api/page-reviews",
        json=body(
            p["id"],
            focus="Check public media; password=synthetic-secret-value",
            page_context={
                "url": "https://EXAMPLE.com:443/page#section",
                "secure_context": True,
                "forms": {"total": 3, "password_fields": 2, "file_inputs": 1},
                "references": [
                    {"url": "/media/a.png?token=synthetic-url-secret#part", "kind": "image"},
                    {"url": "/media/a.png?size=small", "kind": "image"},
                    {"url": "scripts/app.js#code", "kind": "script"},
                    {
                        "url": "https://third-party.invalid/lib.js?key=synthetic-cdn-secret",
                        "kind": "script",
                    },
                    {"url": "javascript:alert(1)", "kind": "link"},
                    {"url": "ftp://example.com/media/image.png", "kind": "image"},
                    {
                        "url": "https://user:synthetic-userinfo@example.com/image.png",
                        "kind": "image",
                    },
                    {"url": "/media/" + secret_key + ".png", "kind": "image"},
                ],
            },
        ),
    )
    assert response.status_code == 201, response.text
    result = response.json()
    event = review_event(result["id"])
    assert event["provenance"] == "browser_snapshot_unverified"
    assert event["invalid_references_skipped"] == 4
    assert event["browser_snapshot"]["forms"] == {"total": 3, "auth_inputs": 2, "file_inputs": 1}
    assert event["browser_snapshot"]["references"] == [
        {"url": "https://example.com/media/a.png", "kind": "image"},
        {"url": "https://example.com/scripts/app.js", "kind": "script"},
        {"url": "https://third-party.invalid/lib.js", "kind": "script"},
    ]
    assert event["focus"] == "Check public media; password=[REDACTED]"
    stored = json.dumps(event)
    for secret in (
        "synthetic-secret-value",
        "synthetic-url-secret",
        "synthetic-cdn-secret",
        "synthetic-userinfo",
        secret_key,
    ):
        assert secret not in stored
    # Browser observations are persisted as clues; only the selected target gets DNS admission.
    assert admission.resolved == ["example.com"]
    expected_summary = {
        "mode": "single_page",
        "focus": "Check public media; password=[REDACTED]",
        "context_summary": {
            "browser_snapshot": True,
            "references": 3,
            "forms": 3,
            "password_fields": 2,
            "file_inputs": 1,
        },
    }
    assert result["page_review"] == expected_summary
    assert client.get(f"/api/scans/{result['id']}").json()["page_review"] == expected_summary


def test_model_observation_summary_allowlists_browser_metadata_and_redacts_focus():
    observation = {
        "url": "https://example.com/page?token=synthetic-url-secret",
        "provenance": "browser_snapshot_unverified",
        "researcher_focus": "Check media; password=synthetic-focus-secret",
        "form_summary": {
            "total": 4,
            "auth_inputs": 2,
            "file_inputs": 1,
            "password": "synthetic-form-secret",
            "values": ["synthetic-form-value"],
        },
        "secure_context": True,
        "headers": {
            "content-security-policy": "default-src 'none'",
            "authorization": "Bearer synthetic-header-secret",
            "set-cookie": "sid=synthetic-cookie-secret",
        },
        "body": "<html>synthetic-body-secret</html>",
        "raw_html": "synthetic-dom-secret",
        "cookies": "synthetic-cookie-secret",
    }
    result = observation_summary([observation])[0]
    assert result["provenance"] == "browser_snapshot_unverified"
    assert result["researcher_focus"] == "Check media; password=[REDACTED]"
    assert result["form_summary"] == {"total": 4, "auth_inputs": 2, "file_inputs": 1}
    assert result["secure_context"] is True
    assert result["observed_security_headers"] == ["content-security-policy"]
    serialized = json.dumps(result)
    assert "synthetic-" not in serialized
    assert not {"body", "raw_html", "cookies", "headers", "values", "password"} & result.keys()


def test_observation_summary_ignores_invalid_provenance_and_non_count_form_values():
    result = observation_summary(
        [
            {
                "url": "https://example.com/page",
                "provenance": "browser_snapshot_verified_admin",
                "form_summary": {"total": True, "auth_inputs": "1", "file_inputs": -1},
                "secure_context": "yes",
            }
        ]
    )[0]
    assert "provenance" not in result
    assert "secure_context" not in result
    assert result["form_summary"] == {}
