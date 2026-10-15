#!/usr/bin/env python3
"""Verify page reviews against the real Compose fixture, with AI disabled.

This control-plane client talks only to a loopback BountyScope API. All fixture
traffic is performed by the worker through ScopeGuard, never by this script.
"""

import argparse
import os
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv

FIXTURE = "http://example.test:8080"
TARGET = FIXTURE + "/directory/"
TERMINAL = {"complete", "failed", "cancelled"}


class LocalAPI:
    def __init__(self) -> None:
        load_dotenv(Path(__file__).resolve().parents[1] / ".env")
        base = os.getenv("BOUNTYSCOPE_API_URL", "http://127.0.0.1:8000")
        parsed = urlsplit(base)
        if (
            parsed.scheme not in {"http", "https"}
            or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
            or parsed.username is not None
            or parsed.password is not None
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("This synthetic smoke check requires a loopback API URL")
        self.client = httpx.Client(
            base_url=base.rstrip("/"),
            headers={"Authorization": "Bearer " + os.getenv("API_TOKEN", "")},
            timeout=20,
            trust_env=False,
        )

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.client.request(method, "/api" + path, **kwargs)
        response.raise_for_status()
        return response.json()

    def events(self, scan_id: str) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        while True:
            result = self.request(
                "GET",
                f"/scans/{scan_id}/events",
                params={"limit": 500, "offset": len(events)},
            )
            events.extend(result["items"])
            if len(events) >= result["total"]:
                return events

    def wait(self, scan_id: str) -> dict[str, Any]:
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            scan = self.request("GET", f"/scans/{scan_id}")
            if scan["status"] in TERMINAL:
                assert scan["status"] == "complete", (
                    "Page review did not complete",
                    scan["status"],
                    scan.get("errors"),
                )
                return scan
            time.sleep(1)
        self.request("POST", f"/scans/{scan_id}/cancel")
        raise AssertionError("Timed-out synthetic page review was cancelled")


def page_request(project_id: str, profile: str) -> dict[str, Any]:
    return {
        "project_id": project_id,
        "target": TARGET,
        "scan_profile": profile,
        "authorization_confirmed": True,
        "focus": "Synthetic page review; verify only observed HTTP exposure evidence.",
        "page_context": {
            "url": TARGET,
            "references": [
                {"url": FIXTURE + "/assets/app.js", "kind": "script"},
                {"url": FIXTURE + "/uploads/users/123/avatar.jpg", "kind": "image"},
                {"url": FIXTURE + "/bad-headers", "kind": "link"},
                {"url": FIXTURE + "/api/v1/public", "kind": "form"},
                {"url": FIXTURE + "/api/v1/public", "kind": "api"},
                {"url": FIXTURE + "/debug", "kind": "iframe"},
                {"url": FIXTURE + "/excluded/private", "kind": "link"},
                {"url": "http://out-of-scope.test/forbidden.jpg", "kind": "image"},
            ],
            "forms": {"total": 2, "password_fields": 1, "file_inputs": 1},
            "secure_context": False,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--profile", choices=["standard", "exposure"], default="exposure"
    )
    profile = parser.parse_args().profile
    api = LocalAPI()
    try:
        api.request("GET", "/health")
        assert api.request("GET", "/settings")["ai_enabled"] is False, (
            "Disable AI in api and worker for this deterministic, no-provider-charge check"
        )
        project = api.request(
            "POST",
            "/projects",
            json={
                "name": "Synthetic single-page review validation",
                "organization": "Local fake-data fixture",
                "authorization_type": "owned",
                "authorization_confirmed": True,
                "root_domains": ["example.test"],
                "max_rps": 2,
                "max_concurrency": 3,
                "max_depth": 4,
                "url_cap": 120,
                "request_budget": 300,
                "scope": [
                    {"rule_type": "allow_domain", "value": "example.test"},
                    {"rule_type": "allow_port", "value": "8080"},
                    {"rule_type": "deny_path", "value": "/excluded"},
                    {"rule_type": "allow_private_network", "value": "true"},
                ],
            },
        )
        body = page_request(project["id"], profile)
        unconfirmed = api.client.post(
            "/api/page-reviews", json={**body, "authorization_confirmed": False}
        )
        assert unconfirmed.status_code in {403, 422}, (
            "Explicit review consent was not enforced"
        )
        created = api.request("POST", "/page-reviews", json=body)
        scan = api.wait(created["id"])
        assert scan["page_review"]["mode"] == "single_page"
        assert scan["page_review"]["context_summary"]["browser_snapshot"] is True
        limits = scan["limits"]
        assert limits["request_budget"] <= 200 and limits["url_cap"] <= 80
        assert limits["max_depth"] == 1 and limits["max_rps"] <= 2
        assert scan["requests_sent"] <= limits["request_budget"]
        assert scan["endpoints_found"] <= limits["url_cap"]
        assert scan["ai_progress"]["status"] == "disabled"

        events = api.events(scan["id"])
        requested = [
            event for event in events if event["kind"] == "page_review_requested"
        ]
        assert len(requested) == 1, "Missing immutable page-review admission event"
        sent = [event["data"] for event in events if event["kind"] == "request_sent"]
        assert sent and len(sent) == scan["requests_sent"]
        assert all(request["hostname"] == "example.test" for request in sent)
        paths = {urlsplit(request["path"]).path for request in sent}
        assert "/directory/" in paths and "/assets/app.js" in paths
        assert not paths.intersection(
            {
                "/robots.txt",
                "/sitemap.xml",
                "/bad-headers",
                "/api/v1/public",
                "/debug",
                "/excluded/private",
                "/images/",
                "/wp-content/",
                "/wp-content/uploads/",
            }
        ), "Page review unexpectedly crawled ordinary links or common directory seeds"
        assert not any("image_" in path for path in paths), (
            "Directory children were fetched"
        )
        for request in sent:
            path = urlsplit(request["path"]).path
            if path.endswith((".jpg", ".map")):
                assert request["method"] == "HEAD", (
                    "Media or source-map body was fetched"
                )
        assert any(
            request["method"] == "HEAD"
            and urlsplit(request["path"]).path == "/assets/app.js.map"
            for request in sent
        ), "Observed source-map metadata was not checked"
        assert any(
            event["kind"] == "discovered_out_of_scope"
            and "out-of-scope.test" in str(event["data"])
            for event in events
        ), "The third-party browser reference was not recorded as skipped"
        assert not any(event["kind"] == "ai_provider_started" for event in events)

        findings = api.request(
            "GET", "/findings", params={"project_id": project["id"], "limit": 200}
        )["items"]
        directory = next(
            finding for finding in findings if finding["scanner"] == "directory_listing"
        )
        detail = api.request("GET", "/findings/" + directory["id"])
        assert detail["confidence"] >= 90 and detail["evidence"]
        assert any(
            evidence["response_metadata"]["details"].get("visible_entry_count") == 42
            for evidence in detail["evidence"]
        ), "The synthetic directory's observed entry count was not retained"
        for finding in findings:
            detail = api.request("GET", "/findings/" + finding["id"])
            serialized = str(detail)
            assert "FAKE_TEST_KEY_DO_NOT_USE" not in serialized
            assert "FAKE_TEST_PASSWORD" not in serialized
            assert all(
                evidence["request_metadata"].get("method") in {"GET", "HEAD", "OPTIONS"}
                for evidence in detail["evidence"]
            ), "Unverified browser metadata was persisted as HTTP evidence"
        for format_name in ("markdown", "html"):
            report = api.request(
                "POST",
                "/reports",
                json={"finding_id": directory["id"], "format": format_name},
            )
            assert "42" in report["content"] and "Reproduction" in report["content"]

        endpoints = api.request(
            "GET", f"/projects/{project['id']}/endpoints", params={"limit": 200}
        )
        assert any(
            endpoint["source"].startswith("browser:") for endpoint in endpoints["items"]
        )
        print(
            f"PASS: real {profile} page review; {len(sent)} guarded requests, "
            f"{len(findings)} findings; consent, bounded inventory, excluded references, "
            "no ordinary-link crawling/media downloads, redacted HTTP evidence and reports verified."
        )
    finally:
        api.client.close()


if __name__ == "__main__":
    main()
