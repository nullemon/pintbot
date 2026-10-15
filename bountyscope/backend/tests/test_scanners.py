"""Scanner observations, false-positive boundaries and guarded request behavior."""

from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest

from app.core.http import BudgetExceeded, ScanCancelled
from app.scanners import FindingCandidate, Page, finding_fingerprint
from app.scanners.active import (
    CORSScanner,
    DiscoveryScanner,
    ExposedFilesScanner,
    JavaScriptScanner,
)
from app.scanners.directory import DirectoryListingScanner, is_directory_listing
from app.scanners.disclosure import CacheScanner, InformationDisclosureScanner, RedirectScanner
from app.scanners.headers import CookieScanner, SecurityHeadersScanner, TLSScanner
from app.scanners.registry import analyze_page
from app.scope.guard import ScopeDenied


def page(body="<html></html>", url="https://example.com/", status=200, headers=None, **extra):
    return Page(
        url, status, {"content-type": "text/html", **(headers or {})}, body.encode(), **extra
    )


class Guard:
    def __init__(self, denied=()):
        self.denied = denied

    def check_url(self, url):
        if any(value in url for value in self.denied) or not url.startswith("https://example.com/"):
            raise ScopeDenied("test scope exclusion")
        return url


class HTTP:
    def __init__(self, handler=None):
        self.calls = []
        self.handler = handler
        self.scanner = ""

    async def _request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        if self.handler:
            result = self.handler(method, url, kwargs)
            if isinstance(result, Exception):
                raise result
            return result
        return page("", url=url, status=404, headers={"content-type": "text/plain"})

    async def get(self, url, **kwargs):
        return await self._request("GET", url, **kwargs)

    async def head(self, url, **kwargs):
        return await self._request("HEAD", url, **kwargs)

    async def options(self, url, **kwargs):
        return await self._request("OPTIONS", url, **kwargs)


class Context(SimpleNamespace):
    def __init__(self, profile="standard", handler=None, denied=()):
        super().__init__(
            profile=profile,
            http=HTTP(handler),
            guard=Guard(denied),
            scanner_state={},
            remembered=[],
            events=[],
            errors=[],
        )

    async def remember_url(self, url, source):
        self.remembered.append((url, source))
        return True

    def event(self, kind, data):
        self.events.append((kind, data))

    def error(self, scanner, error):
        self.errors.append((scanner, type(error).__name__))


@pytest.mark.asyncio
async def test_security_headers_are_document_specific_and_do_not_claim_exploit():
    scanner = SecurityHeadersScanner()
    findings = await scanner.scan(Context(), page())
    assert any("Content Security Policy" in item.title for item in findings)
    assert any("transport policy" in item.title for item in findings)
    assert all(item.severity in {"informational", "low"} for item in findings)
    assert (
        await scanner.scan(Context(), page("{}", headers={"content-type": "application/json"}))
        == []
    )
    assert await scanner.scan(Context(), page(status=404)) == []


@pytest.mark.asyncio
async def test_strong_headers_do_not_generate_missing_header_findings():
    findings = await SecurityHeadersScanner().scan(
        Context(),
        page(
            headers={
                "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
                "x-content-type-options": "nosniff",
                "referrer-policy": "no-referrer",
                "permissions-policy": "camera=(), microphone=()",
                "strict-transport-security": "max-age=31536000; includeSubDomains",
            }
        ),
    )
    assert findings == []


@pytest.mark.asyncio
async def test_invalid_xfo_and_hsts_are_not_treated_as_protection():
    findings = await SecurityHeadersScanner().scan(
        Context(),
        page(
            headers={
                "x-frame-options": "ALLOWALL",
                "strict-transport-security": "max-age=12notanumber",
            }
        ),
    )
    assert any("Framing" in item.title for item in findings)
    assert any("transport policy" in item.title for item in findings)


@pytest.mark.asyncio
async def test_csp_strict_dynamic_nonce_ignores_wildcard_fallback():
    findings = await SecurityHeadersScanner().scan(
        Context(),
        page(
            headers={
                "content-security-policy": "script-src 'nonce-sample' 'strict-dynamic' *; frame-ancestors 'none'",
            }
        ),
    )
    assert all("broad script" not in item.title for item in findings)


@pytest.mark.asyncio
async def test_cookie_values_are_never_in_candidate_and_analytics_are_not_session():
    response = page()
    response.headers = httpx.Headers(
        [
            ("set-cookie", "sessionid=SECRET_VALUE; Path=/"),
            ("set-cookie", "analytics=OTHER_VALUE; Path=/"),
            ("set-cookie", "auth_removed=old; Max-Age=0"),
        ]
    )
    findings = await CookieScanner().scan(Context(), response)
    assert len(findings) == 1
    assert findings[0].parameter == "sessionid"
    assert set(findings[0].metadata["attributes"]) == {"Secure", "HttpOnly", "SameSite"}
    assert "SECRET_VALUE" not in str(asdict(findings[0]))


@pytest.mark.asyncio
async def test_samesite_none_without_secure_and_host_prefix_are_detected():
    findings = await CookieScanner().scan(
        Context(),
        page(
            headers={
                "set-cookie": "__Host-preference=value; SameSite=None; Domain=example.com; Path=/sub",
            }
        ),
    )
    assert len(findings) == 1
    assert "__Host- prefix requirements" in findings[0].metadata["attributes"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "expiry",
    [
        (datetime.now(UTC) - timedelta(days=1)).isoformat(),
        (datetime.now(UTC) - timedelta(days=1)).strftime("%b %d %H:%M:%S %Y GMT"),
    ],
)
async def test_tls_metadata_uses_observed_protocol_and_certificate_formats(expiry):
    findings = await TLSScanner().scan(
        Context(),
        page(
            tls={
                "protocol": "TLSv1.0",
                "cipher": "RC4-SHA",
                "not_after": expiry,
                "verified": True,
            }
        ),
    )
    assert len(findings) == 3
    assert any("expired" in item.title for item in findings)
    assert all("single observed" in item.description for item in findings)


@pytest.mark.asyncio
async def test_tls_missing_metadata_does_not_invent_certificate_failures():
    assert await TLSScanner().scan(Context(), page(tls={"not_after": "not a date"})) == []
    findings = await TLSScanner().scan(Context(), page(url="http://example.com/"))
    assert len(findings) == 1 and "unencrypted" in findings[0].title


@pytest.mark.asyncio
async def test_diagnostic_signatures_do_not_capture_stack_contents():
    findings = await InformationDisclosureScanner().scan(
        Context(),
        page(
            'Traceback (most recent call last):\n  File "/private/path/secret.py", line 2\n',
            status=500,
            headers={"server": "nginx/1.25.3"},
        ),
    )
    assert len(findings) == 2
    assert "secret.py" not in str([asdict(item) for item in findings])
    assert (
        await InformationDisclosureScanner().scan(
            Context(), page("The word error appears in ordinary text")
        )
        == []
    )
    assert (
        await InformationDisclosureScanner().scan(
            Context(),
            page(
                '<title>Python tutorial</title><pre>Traceback (most recent call last):\n File "example.py", line 1</pre>',
            ),
        )
        == []
    )


@pytest.mark.asyncio
async def test_directory_media_metadata_is_bounded_and_no_files_downloaded():
    body = '<html><title>Index of /uploads/</title><pre><a href="../">Parent Directory</a>'
    body += "".join(f'<a href="image{i}.jpg">image{i}.jpg</a>\n' for i in range(25))
    body += '<a href="video.mp4">video.mp4</a><a href="backup.sql">backup.sql</a></pre></html>'
    ctx = Context()
    findings = await DirectoryListingScanner().scan(
        ctx, page(body, url="https://example.com/uploads/")
    )
    assert len(findings) == 1
    meta = findings[0].metadata
    assert meta["visible_entry_count"] == 27
    assert meta["counts"] == {"image": 25, "video": 1, "database": 1}
    assert len(meta["sample"]) == 10
    assert meta["sample"][0]["extension"] == ".jpg"
    assert meta["sample"][0]["content_type"] is None
    assert meta["sample"][0]["content_length"] is None
    assert meta["files_downloaded"] is False
    assert ctx.http.calls == []


@pytest.mark.asyncio
async def test_directory_heading_without_listing_is_not_a_directory_finding():
    findings = await DirectoryListingScanner().scan(
        Context(),
        page(
            '<html><h1>Index of /howto/</h1><a href="article">Article</a></html>',
        ),
    )
    assert findings == []


@pytest.mark.asyncio
async def test_directory_children_are_not_queued_or_probed_even_when_configuration_or_media():
    response = page(
        '<h1>Index of /uploads/</h1><pre><a href="../">../</a>'
        '<a href="backup.sql">dump</a><a href="one.jpg">image</a>'
        '<a href="settings.txt">settings</a></pre>',
        url="https://example.com/uploads/",
    )
    ctx = Context(profile="passive")
    await DiscoveryScanner().scan(ctx, response)
    assert ctx.remembered == []
    assert ctx.http.calls == []
    ctx.profile = "standard"
    ctx.scanner_state["probes"] = {"exposed_files:https://example.com"}
    await ExposedFilesScanner().scan(ctx, response)
    assert ctx.http.calls == []


@pytest.mark.asyncio
async def test_iis_listing_is_metadata_only_and_does_not_schedule_children():
    response = page(
        "<title>example.com - /uploads/</title><h1>example.com - /uploads/</h1>"
        '<pre><a href="/">[To Parent Directory]</a>'
        '<a href="/uploads/settings.txt">settings.txt</a></pre>',
        url="https://example.com/uploads/",
    )
    ctx = Context(profile="passive")
    assert is_directory_listing(response)
    await DiscoveryScanner().scan(ctx, response)
    assert ctx.remembered == []
    findings = await DirectoryListingScanner().scan(ctx, response)
    assert findings[0].metadata["visible_entry_count"] == 1


@pytest.mark.asyncio
async def test_curated_exposed_file_requests_are_small_and_once_per_origin():
    def handler(method, url, options):
        body = (
            "APP_ENV=production\nDB_PASSWORD=private-value\n"
            if url.endswith("/.env")
            else "ref: refs/heads/main\n"
        )
        return page(body, url=url, headers={"content-type": "text/plain"})

    ctx = Context(handler=handler)
    scanner = ExposedFilesScanner()
    findings = await scanner.scan(ctx, page())
    assert {item.severity for item in findings} == {"high", "medium"}
    assert all(item.evidence_page is not None for item in findings)
    assert all(call[0] == "GET" and call[2]["max_bytes"] == 512 for call in ctx.http.calls)
    assert len(ctx.http.calls) == 2
    assert all(
        item.excerpt == "" and item.metadata["content_retained"] is False for item in findings
    )
    assert await scanner.scan(ctx, page(url="https://example.com/other")) == []
    assert len(ctx.http.calls) == 2


@pytest.mark.asyncio
async def test_soft_404_html_is_not_exposed_configuration():
    ctx = Context(handler=lambda method, url, options: page("<html>Not found</html>", url=url))
    assert await ExposedFilesScanner().scan(ctx, page()) == []


@pytest.mark.asyncio
async def test_excluded_curated_path_is_logged_and_never_requested():
    ctx = Context(denied=("/.env",))
    await ExposedFilesScanner().scan(ctx, page())
    assert all(not call[1].endswith("/.env") for call in ctx.http.calls)
    assert ctx.events[0][0] == "discovered_out_of_scope"


@pytest.mark.asyncio
async def test_observed_backup_reference_is_head_only_and_not_media():
    ctx = Context(
        handler=lambda method, url, options: page(
            "", url=url, headers={"content-type": "application/octet-stream"}
        )
    )
    ctx.scanner_state["probes"] = {"exposed_files:https://example.com"}
    findings = await ExposedFilesScanner().scan(
        ctx,
        page(
            '<a href="/backup.zip">archive</a><a href="/movie.mp4">video</a>',
        ),
    )
    assert len(findings) == 1
    assert ctx.http.calls == [("HEAD", "https://example.com/backup.zip", {"max_bytes": 0})]
    assert findings[0].metadata["body_downloaded"] is False


@pytest.mark.asyncio
async def test_javascript_discovers_map_by_head_without_validating_credentials():
    ctx = Context(
        handler=lambda method, url, options: page(
            "", url=url, headers={"content-type": "application/json"}
        )
    )
    response = page(
        'const key="AKIAABCDEFGHIJKLMNOP";\n//# sourceMappingURL=app.js.map',
        url="https://example.com/app.js",
        headers={"content-type": "application/javascript"},
    )
    findings = await JavaScriptScanner().scan(ctx, response)
    assert len(findings) == 2
    assert "AKIAABCDEFGHIJKLMNOP" not in str([item.excerpt for item in findings])
    assert ctx.http.calls == [("HEAD", "https://example.com/app.js.map", {"max_bytes": 0})]
    assert findings[-1].evidence_page.url == "https://example.com/app.js.map"
    assert await JavaScriptScanner().scan(ctx, response) == [findings[0]]


@pytest.mark.asyncio
async def test_passive_mode_issues_no_active_requests_but_discovers_observed_links():
    ctx = Context(profile="passive")
    response = page('<a href="/api/public">API</a><script src="/app.js"></script>')
    findings = await analyze_page(ctx, response)
    assert ctx.http.calls == []
    assert ("https://example.com/api/public", "html:a") in ctx.remembered
    assert any(item.scanner == "security_headers" for item in findings)


@pytest.mark.asyncio
async def test_discovery_robots_and_sitemap_requests_use_bounded_bodies():
    def handler(method, url, options):
        if url.endswith("robots.txt"):
            return page(
                "Disallow: /private-readonly\nSitemap: /index.xml",
                url=url,
                headers={"content-type": "text/plain"},
            )
        return page(
            "<urlset><url><loc>https://example.com/item</loc></url></urlset>",
            url=url,
            headers={"content-type": "application/xml"},
        )

    ctx = Context(handler=handler)
    await DiscoveryScanner().scan(ctx, page())
    assert [call[2]["max_bytes"] for call in ctx.http.calls] == [32768, 131072]
    assert ("https://example.com/item", "sitemap") in ctx.remembered
    assert ("https://example.com/private-readonly", "robots:disallow") in ctx.remembered


@pytest.mark.asyncio
async def test_cors_requires_matching_origin_and_credentials_and_keeps_probe_evidence():
    def handler(method, url, options):
        return page(
            "{}",
            url=url,
            headers={
                "content-type": "application/json",
                "access-control-allow-origin": options["headers"]["Origin"],
                "access-control-allow-credentials": "true",
            },
        )

    ctx = Context(handler=handler)
    findings = await CORSScanner().scan(ctx, page())
    assert len(findings) == 2
    assert {call[2]["headers"]["Origin"] for call in ctx.http.calls} == {
        "https://bountyscope.invalid",
        "null",
    }
    assert all(call[2]["follow_redirects"] is False for call in ctx.http.calls)
    assert all(item.evidence_page.body == b"{}" for item in findings)
    assert all(item.metadata["authenticated_impact_verified"] is False for item in findings)


@pytest.mark.asyncio
async def test_wildcard_cors_is_not_a_credential_exploit_finding():
    ctx = Context(
        handler=lambda method, url, options: page(
            "",
            url=url,
            headers={
                "access-control-allow-origin": "*",
                "access-control-allow-credentials": "true",
            },
        )
    )
    assert await CORSScanner().scan(ctx, page()) == []


@pytest.mark.asyncio
async def test_cors_credentials_true_is_case_sensitive_per_browser_behavior():
    ctx = Context(
        handler=lambda method, url, options: page(
            "",
            url=url,
            headers={
                "access-control-allow-origin": options["headers"]["Origin"],
                "access-control-allow-credentials": "TRUE",
            },
        )
    )
    assert await CORSScanner().scan(ctx, page()) == []


@pytest.mark.asyncio
async def test_cors_redirect_is_observed_without_following_or_reporting_credential_access():
    ctx = Context(
        handler=lambda method, url, options: page(
            "",
            url=url,
            status=302,
            headers={
                "location": "https://external.test/",
                "access-control-allow-origin": options["headers"]["Origin"],
                "access-control-allow-credentials": "true",
            },
        )
    )
    assert await CORSScanner().scan(ctx, page()) == []
    assert len(ctx.http.calls) == 2
    assert all(
        call[1] == "https://example.com/" and call[2]["follow_redirects"] is False
        for call in ctx.http.calls
    )


@pytest.mark.asyncio
async def test_redirect_only_reports_observed_correspondence_and_hops():
    response = page(
        url="https://example.com/finished",
        redirects=[
            {
                "url": "https://example.com/redirect?next=https%3A%2F%2Fexternal.test%2Fwelcome",
                "status": 302,
                "location": "https://external.test/welcome",
            }
        ],
    )
    ctx = Context()
    findings = await RedirectScanner().scan(ctx, response)
    assert len(findings) == 1
    assert findings[0].confidence == 60
    assert findings[0].parameter == "next"
    assert findings[0].metadata["verification"] == "observed_only"
    assert ctx.http.calls == []


@pytest.mark.asyncio
async def test_cache_concern_requires_session_cookie_plus_shared_policy():
    scanner = CacheScanner()
    assert (
        await scanner.scan(Context(), page(headers={"cache-control": "public, max-age=3600"})) == []
    )
    findings = await scanner.scan(
        Context(),
        page(headers={"cache-control": "public, max-age=3600", "set-cookie": "session=private"}),
    )
    assert len(findings) == 1
    assert "not demonstrated" in findings[0].description
    assert (
        await scanner.scan(
            Context(),
            page(headers={"cache-control": "private, no-store", "set-cookie": "session=private"}),
        )
        == []
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("stop", [BudgetExceeded("budget"), ScanCancelled()])
async def test_registry_does_not_swallow_cancellation_or_budget(stop):
    ctx = Context(handler=lambda method, url, options: stop)
    with pytest.raises(type(stop)):
        await analyze_page(ctx, page())


@pytest.mark.asyncio
async def test_registry_records_network_errors_and_continues_passive_analysis():
    ctx = Context(handler=lambda method, url, options: httpx.ConnectError("unavailable"))
    findings = await analyze_page(ctx, page())
    assert any(item.scanner == "security_headers" for item in findings)
    assert ctx.errors and all(kind == "ConnectError" for _, kind in ctx.errors)


def test_fingerprint_groups_host_wide_headers_but_preserves_distinct_findings():
    finding = FindingCandidate(
        "security_headers",
        "Missing CSP",
        "Security headers",
        "",
        "low",
        90,
        "",
        "",
        "https://EXAMPLE.com/one?secret=ignored",
    )
    assert finding_fingerprint(finding) == finding_fingerprint(
        replace(finding, url="https://example.com/two")
    )
    assert finding_fingerprint(finding) != finding_fingerprint(
        replace(finding, title="Missing HSTS")
    )
    assert len(finding_fingerprint(finding)) == 64
    assert finding_fingerprint(finding) == finding_fingerprint(asdict(finding))


def test_fingerprint_normalizes_dynamic_ids_without_query_values():
    finding = FindingCandidate(
        "cache",
        "Public",
        "Cache policy",
        "",
        "low",
        70,
        "",
        "",
        "https://example.com/items/123?token=one",
    )
    assert finding_fingerprint(finding) == finding_fingerprint(
        replace(finding, url="https://example.com/items/789?token=two")
    )
    assert finding_fingerprint(finding) != finding_fingerprint(
        replace(finding, url="https://other.example/items/789")
    )
