from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models import Scan, ScanEvent

client = TestClient(app, headers={"Authorization": "Bearer test-api-token"})


def project(confirmed=True):
    return client.post(
        "/api/projects",
        json={
            "name": "Owned example",
            "authorization_confirmed": confirmed,
            "scope": [
                {"rule_type": "allow_domain", "value": "example.com"},
                {"rule_type": "allow_port", "value": "443"},
            ],
        },
    ).json()


def test_auth():
    assert TestClient(app).get("/api/projects").status_code == 401


def test_project_scope_pagination_validation():
    p = project()
    assert p["name"] == "Owned example" and len(p["scope"]) == 2
    assert client.get("/api/projects?limit=1").json()["total"] == 1
    assert (
        client.post(
            f"/api/projects/{p['id']}/scope", json=[{"rule_type": "allow_port", "value": "999999"}]
        ).status_code
        == 422
    )
    assert client.patch(f"/api/projects/{p['id']}", json={"max_rps": 10000}).status_code == 422


def test_requires_authorization():
    p = project(False)
    response = client.post(
        "/api/scans", json={"project_id": p["id"], "target": "https://example.com"}
    )
    assert response.status_code == 403


def test_out_of_scope_and_extended_optin():
    p = project()
    assert (
        client.post(
            "/api/scans", json={"project_id": p["id"], "target": "https://evil.org"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/scans",
            json={
                "project_id": p["id"],
                "target": "https://example.com",
                "scan_profile": "extended",
            },
        ).status_code
        == 422
    )


def test_queue_cancel_and_append_only_event():
    p = project()
    with SessionLocal() as db:
        scan = Scan(project_id=p["id"], target="https://example.com")
        db.add(scan)
        db.commit()
        scan_id = scan.id
    response = client.post(f"/api/scans/{scan_id}/cancel")
    assert response.json()["status"] == "cancelled"
    events = client.get(f"/api/scans/{scan_id}/events").json()
    assert events["items"][0]["kind"] == "scan_cancelled"
    with SessionLocal() as db:
        event = db.scalar(select(ScanEvent))
        event.kind = "tamper"
        try:
            db.commit()
            raise AssertionError("Event mutation should fail")
        except ValueError:
            db.rollback()


def test_priority_sort_exposure_filter_and_live_progress():
    from app.models import Finding

    p = project()
    with SessionLocal() as db:
        scan = Scan(project_id=p["id"], target="https://example.com/", status="crawling")
        db.add(scan)
        db.flush()
        scan_id = scan.id
        for title, scanner, score in [
            ("Headers", "security_headers", 99),
            ("Directory", "directory_listing", 80),
            ("Config", "exposed_files", 95),
        ]:
            db.add(
                Finding(
                    project_id=p["id"],
                    scan_id=scan.id,
                    scanner=scanner,
                    title=title,
                    category="test",
                    description="test",
                    severity="low",
                    confidence=95,
                    affected_url="https://example.com/",
                    evidence_summary="observed",
                    recommendation="review",
                    fingerprint=title,
                    ai_analysis={
                        "priority": {
                            "score": score,
                            "reason": "observed evidence",
                            "source": "anthropic",
                        }
                    },
                )
            )
        db.add(
            ScanEvent(
                scan_id=scan_id,
                kind="ai_progress",
                data={"status": "analyzing", "round": 1, "actions_executed": 2},
            )
        )
        db.commit()
    response = client.get("/api/findings?focus=exposure&sort=priority").json()
    assert [f["title"] for f in response["items"]] == ["Config", "Directory"]
    assert client.get(f"/api/scans/{scan_id}").json()["ai_progress"]["actions_executed"] == 2
    events = client.get(f"/api/scans/{scan_id}/events?newest_first=true").json()
    assert events["items"][0]["kind"] == "ai_progress"
    assert client.get("/api/findings?sort=unsupported").status_code == 422


def test_live_log_filters_paginate_authorize_and_isolate_scans():
    p = project()
    kinds = [
        "ai_provider_started",
        "ai_provider_refused",
        "ai_review_refused",
        "request_sent",
        "response_received",
        "request_error",
        "discovered_out_of_scope",
        "scope_check",
        "scanner_error",
    ]
    with SessionLocal() as db:
        scan = Scan(project_id=p["id"], target="https://example.com/", status="complete")
        other = Scan(project_id=p["id"], target="https://example.com/", status="complete")
        db.add_all([scan, other])
        db.flush()
        scan_id = scan.id
        for kind in kinds:
            db.add(ScanEvent(scan_id=scan.id, kind=kind, data={"message": "Synthetic metadata"}))
        db.add(ScanEvent(scan_id=other.id, kind="ai_provider_failed", data={}))
        db.add(
            ScanEvent(
                scan_id=scan.id,
                kind="ai_progress",
                data={"status": "refused", "enabled": True, "round": 1},
            )
        )
        db.commit()
    url = f"/api/scans/{scan_id}/events"
    assert TestClient(app).get(url).status_code == 401
    assert client.get(url + "?category=unknown").status_code == 422
    assert client.get(url + "?category=ai").json()["total"] == 4
    assert client.get(url + "?category=errors").json()["total"] == 5
    requests = client.get(url + "?category=requests").json()
    assert {e["kind"] for e in requests["items"]} == {
        "request_sent",
        "response_received",
        "request_error",
    }
    scope = client.get(url + "?category=scope").json()
    assert {e["kind"] for e in scope["items"]} == {"scope_check", "discovered_out_of_scope"}
    first = client.get(url + "?category=ai&newest_first=true&limit=2").json()
    second = client.get(url + "?category=ai&newest_first=true&limit=2&offset=2").json()
    assert first["total"] == second["total"] == 4
    assert not {e["id"] for e in first["items"]} & {e["id"] for e in second["items"]}
    assert all(e["scan_id"] == scan_id for e in first["items"] + second["items"])
    assert client.get(f"/api/scans/{scan_id}").json()["ai_progress"]["status"] == "refused"
