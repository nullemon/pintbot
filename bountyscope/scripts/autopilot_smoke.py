#!/usr/bin/env python3
"""Exercise real Docker Autopilot against the synthetic fixture with AI disabled.

The only direct HTTP destination is the loopback BountyScope control-plane API.
The target is fixed fake data; worker traffic must still pass through ScopeGuard.
This check leaves its synthetic project, findings and automatic drafts for review.
"""

import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv

API_URL = "http://127.0.0.1:8000"
FIXTURE_URL = "http://example.test:8080"


class LocalAPI:
    def __init__(self) -> None:
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        self.client = httpx.Client(
            base_url=API_URL,
            headers={"Authorization": "Bearer " + os.getenv("API_TOKEN", "")},
            timeout=20,
            trust_env=False,
        )

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.client.request(method, "/api" + path, **kwargs)
        response.raise_for_status()
        return response.json()

    def pages(
        self, path: str, *, limit: int = 200, **filters: Any
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        while True:
            result = self.request(
                "GET", path, params={**filters, "limit": limit, "offset": len(items)}
            )
            batch = result["items"]
            assert batch or len(items) >= result["total"], (
                "Pagination returned an empty page"
            )
            items.extend(batch)
            if len(items) >= result["total"]:
                return items

    def wait_for_scan(self, scan_id: str) -> dict[str, Any]:
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            scan = self.request("GET", "/scans/" + scan_id)
            if scan["status"] in {"complete", "cancelled", "failed"}:
                assert scan["status"] == "complete", (
                    "Autopilot did not complete",
                    scan["status"],
                    scan.get("errors"),
                )
                return scan
            time.sleep(1)
        self.request("POST", f"/scans/{scan_id}/cancel")
        raise AssertionError("Timed-out synthetic Autopilot scan was cancelled")


def main() -> None:
    api = LocalAPI()
    try:
        api.request("GET", "/health")
        if api.request("GET", "/settings")["ai_enabled"] is not False:
            raise SystemExit(
                "AI is enabled. This synthetic smoke check requires AI disabled in api and worker; "
                "no project or scan was created and configuration was not changed."
            )
        project = api.request(
            "POST",
            "/projects",
            json={
                "name": "Synthetic budget-based Autopilot validation",
                "organization": "Local fake-data fixture",
                "authorization_type": "owned",
                "authorization_confirmed": True,
                "root_domains": ["example.test"],
                "max_rps": 2,
                "max_concurrency": 3,
                "max_depth": 4,
                "url_cap": 100,
                "request_budget": 200,
                "scope": [
                    {"rule_type": "allow_domain", "value": "example.test"},
                    {"rule_type": "allow_port", "value": "8080"},
                    {"rule_type": "deny_path", "value": "/excluded"},
                    {"rule_type": "allow_private_network", "value": "true"},
                ],
            },
        )
        created = api.request(
            "POST",
            "/autopilot",
            json={
                "project_id": project["id"],
                "target": FIXTURE_URL,
                "scan_profile": "exposure",
            },
        )
        assert created["autopilot"] is True
        scan = api.wait_for_scan(created["id"])
        assert scan["autopilot"] is True and scan["page_review"] is None
        completion = scan["completion"]
        assert completion["autopilot"] is True
        assert completion["ai_round_limit"] is None
        assert completion["ai_round_policy"] == "budget"
        assert completion["pending_urls"] == 0, "Queued work remained after completion"
        assert 0 < scan["requests_sent"] <= scan["limits"]["request_budget"] == 200
        assert completion["requests_sent"] == scan["requests_sent"]
        assert scan["endpoints_found"] <= scan["limits"]["url_cap"] == 100
        assert scan["ai_progress"]["status"] == "disabled"
        assert scan["ai_progress"]["max_rounds"] is None
        assert scan["ai_progress"]["round_policy"] == "budget"

        events = api.pages(f"/scans/{scan['id']}/events", limit=500)
        assert sum(event["kind"] == "autopilot_requested" for event in events) == 1
        assert not any(event["kind"] == "ai_provider_started" for event in events)
        sent = [event["data"] for event in events if event["kind"] == "request_sent"]
        assert len(sent) == scan["requests_sent"]
        for request in sent:
            parts = urlsplit(request["path"])
            assert request["hostname"] == parts.hostname == "example.test"
            assert parts.port == 8080
            assert not parts.path.startswith(("/excluded", "/delete/"))
            assert "image_" not in parts.path, "Directory children were downloaded"
            assert request["method"] in {"GET", "HEAD"}
            if parts.path.endswith((".jpg", ".png", ".map")):
                assert request["method"] == "HEAD", (
                    "Media/source-map body was requested"
                )
        assert any(
            event["kind"] == "discovered_out_of_scope"
            and "out-of-scope.test" in str(event["data"])
            for event in events
        )
        for event in events:
            if event["kind"] != "response_received":
                continue
            response = event["data"]
            if urlsplit(response["path"]).path in {"/.env", "/.git/HEAD"}:
                assert response["bytes_sampled"] <= 512

        findings = api.pages("/findings", project_id=project["id"])
        scanners = {finding["scanner"] for finding in findings}
        assert {"directory_listing", "exposed_files"} <= scanners
        assert scanners <= {"directory_listing", "exposed_files", "javascript"}
        assert all(
            finding["status"] in {"new", "needs_verification"} for finding in findings
        )
        details = {
            finding["id"]: api.request("GET", "/findings/" + finding["id"])
            for finding in findings
        }
        for detail in details.values():
            assert detail["evidence"], "A finding has no retained evidence"
            assert "FAKE_TEST_KEY_DO_NOT_USE" not in str(detail)
            assert "FAKE_TEST_PASSWORD" not in str(detail)
            for evidence in detail["evidence"]:
                assert evidence["type"] == "http"
                assert evidence["request_metadata"]["scan_id"] == scan["id"]
                assert evidence["request_metadata"]["method"] in {"GET", "HEAD"}
                assert len(evidence["body_sha256"]) == 64
                assert len(evidence["redacted_excerpt"]) <= 512
        directory = next(
            detail
            for detail in details.values()
            if detail["scanner"] == "directory_listing"
        )
        assert directory["confidence"] >= 90
        assert any(
            evidence["response_metadata"]["details"].get("visible_entry_count") == 42
            and len(evidence["response_metadata"]["details"].get("sample", [])) <= 10
            and evidence["response_metadata"]["details"].get("files_downloaded")
            is False
            for evidence in directory["evidence"]
        )

        # No POST /reports is made: these must be the worker's automatic drafts.
        reports = [
            report
            for report in api.pages("/reports")
            if report["project_id"] == project["id"]
        ]
        eligible = {
            finding["id"]
            for finding in findings
            if finding["confidence"] >= 75 and finding["severity"] != "informational"
        }
        pairs = {(report["finding_id"], report["format"]) for report in reports}
        assert pairs == {
            (finding_id, format_name)
            for finding_id in eligible
            for format_name in ("markdown", "html")
        }, "Eligible findings did not receive both automatic report formats"
        assert reports and all(report["finding_id"] in details for report in reports)
        for report in reports:
            saved = api.request("GET", "/reports/" + report["id"])
            assert saved["content"] == report["content"]
            assert "Reproduction" in saved["content"]
            assert "FAKE_TEST_KEY_DO_NOT_USE" not in saved["content"]
            assert "FAKE_TEST_PASSWORD" not in saved["content"]
        report_events = [
            event["data"]
            for event in events
            if event["kind"] == "autopilot_reports_created"
        ]
        assert len(report_events) == 1 and report_events[0]["count"] == len(reports)
        assert report_events[0]["requires_manual_verification"] is True
        print(
            f"PASS: real budget-based Autopilot; {len(sent)} guarded requests, "
            f"{len(findings)} findings, {len(reports)} automatic Markdown/HTML drafts; "
            "scope, redaction, sampled directory evidence, no media downloads and empty queue verified."
        )
    finally:
        api.client.close()


if __name__ == "__main__":
    main()
