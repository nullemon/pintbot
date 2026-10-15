#!/usr/bin/env python3
"""Exercise the real Compose API/worker/DB/fixture end to end. Fake target only."""

import argparse
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
client = httpx.Client(
    base_url=os.getenv("BOUNTYSCOPE_API_URL", "http://127.0.0.1:8000"),
    headers={"Authorization": "Bearer " + os.getenv("API_TOKEN", "")},
    timeout=20,
)


def api(method, path, **kwargs):
    response = client.request(method, "/api" + path, **kwargs)
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=["standard", "exposure"], default="standard")
    profile = parser.parse_args().profile
    api("GET", "/health")
    project = api(
        "POST",
        "/projects",
        json={
            "name": "Synthetic end-to-end validation",
            "organization": "Local fixture",
            "authorization_type": "owned",
            "authorization_confirmed": True,
            "root_domains": ["example.test"],
            "max_rps": 2,
            "max_depth": 4,
            "url_cap": 100,
            "request_budget": 300,
            "scope": [
                {"rule_type": "allow_domain", "value": "example.test"},
                {"rule_type": "allow_port", "value": "8080"},
                {"rule_type": "deny_path", "value": "/excluded"},
                {"rule_type": "allow_private_network", "value": "true"},
            ],
        },
    )
    scan = api(
        "POST",
        "/scans",
        json={
            "project_id": project["id"],
            "target": "http://example.test:8080",
            "scan_profile": profile,
        },
    )
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        scan = api("GET", "/scans/" + scan["id"])
        if scan["status"] in {"complete", "failed", "cancelled"}:
            break
        time.sleep(1)
    assert scan["status"] == "complete", scan
    findings = api("GET", "/findings", params={"project_id": project["id"], "limit": 200})["items"]
    scanners = {f["scanner"] for f in findings}
    required = {"directory_listing", "exposed_files", "javascript"}
    if profile == "standard":
        required |= {"security_headers", "cookies", "cors"}
    else:
        assert scanners <= required, scanners
    assert required <= scanners, scanners
    directory = next(f for f in findings if f["scanner"] == "directory_listing")
    detail = api("GET", "/findings/" + directory["id"])
    assert detail["evidence"] and detail["confidence"] >= 90
    assert any(
        e["response_metadata"]["details"].get("visible_entry_count") == 42
        for e in detail["evidence"]
    )
    updated = api(
        "PATCH",
        "/findings/" + directory["id"],
        json={"status": "verified", "researcher_notes": "Verified only against synthetic fixture."},
    )
    assert updated["status"] == "verified"
    analyzed = api("POST", "/findings/" + directory["id"] + "/analyze")
    assert analyzed["ai_analysis"]["available"] is False  # default AI-disabled smoke
    for format_name in ("markdown", "html"):
        report = api(
            "POST", "/reports", json={"finding_id": directory["id"], "format": format_name}
        )
        assert "42" in report["content"] and "Reproduction" in report["content"]
        assert api("GET", "/reports/" + report["id"])["content"] == report["content"]
    events = []
    offset = 0
    while True:
        result = api(
            "GET", "/scans/" + scan["id"] + "/events", params={"limit": 500, "offset": offset}
        )
        events.extend(result["items"])
        offset += len(result["items"])
        if offset >= result["total"]:
            break
    sent = [e["data"] for e in events if e["kind"] == "request_sent"]
    assert sent and all(e["hostname"] == "example.test" for e in sent)
    assert not any(
        "/excluded" in e["path"] or "/delete/" in e["path"] or "image_" in e["path"] for e in sent
    )
    assert any(
        e["kind"] == "discovered_out_of_scope" and "out-of-scope.test" in str(e["data"])
        for e in events
    )
    for finding in findings:
        detail = api("GET", "/findings/" + finding["id"])
        text = str(detail)
        assert "FAKE_TEST_KEY_DO_NOT_USE" not in text and "FAKE_TEST_PASSWORD" not in text
    assert api("GET", f"/projects/{project['id']}/assets")["total"] >= 1
    assert api("GET", f"/projects/{project['id']}/endpoints")["total"] >= 5
    # Create another scan and immediately cancel; no worker may admit a later request.
    cancelled = api(
        "POST",
        "/scans",
        json={
            "project_id": project["id"],
            "target": "http://example.test:8080",
            "scan_profile": profile,
        },
    )
    api("POST", "/scans/" + cancelled["id"] + "/cancel")
    count = api("GET", "/scans/" + cancelled["id"])["requests_sent"]
    time.sleep(2)
    assert api("GET", "/scans/" + cancelled["id"])["requests_sent"] == count
    print(
        f"PASS: real {profile} worker scan completed; {len(findings)} findings, {len(sent)} guarded requests, scope exclusions/redaction/reports/triage/cancellation verified."
    )


if __name__ == "__main__":
    main()
