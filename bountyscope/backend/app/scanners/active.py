import re
from urllib.parse import urljoin, urlsplit

import httpx

from app.recon import discover_html, discover_javascript, parse_robots, parse_sitemap
from app.scanners.base import FindingCandidate, document, once, origin, passive, permitted
from app.scanners.directory import is_directory_listing


class DiscoveryScanner:
    name = "discovery"
    category = "Endpoint discovery"

    async def scan(self, ctx, page):
        path = urlsplit(page.url).path.lower()
        kind = page.headers.get("content-type", "").lower()
        hints = []
        if document(page) and not is_directory_listing(page):
            hints.extend(discover_html(page))
        if path.endswith((".js", ".mjs")) or "javascript" in kind or "ecmascript" in kind:
            hints.extend(discover_javascript(page.body, page.url))
        if path.endswith("/robots.txt") and page.status == 200:
            hints.extend(parse_robots(page.body, page.url))
        if ("xml" in kind or path.endswith(".xml")) and page.status == 200:
            hints.extend(parse_sitemap(page.body, page.url))
        for url, source in hints:
            await ctx.remember_url(url, source)
        if passive(ctx) or not once(ctx, "discovery:" + origin(page.url)):
            return []
        for path, size, parser in (
            ("/robots.txt", 32768, parse_robots),
            ("/sitemap.xml", 131072, parse_sitemap),
        ):
            url = origin(page.url) + path
            if not permitted(ctx, url):
                continue
            try:
                response = await ctx.http.get(url, max_bytes=size)
            except httpx.HTTPError as exc:
                report_error(ctx, self.name, exc)
                continue
            if response.status == 200:
                await ctx.remember_url(response.url, "discovery")
                for hint, source in parser(response.body, response.url):
                    await ctx.remember_url(hint, source)
        return []


def report_error(ctx, scanner, error):
    handler = getattr(ctx, "error", None)
    if handler:
        handler(scanner, error)


class ExposedFilesScanner:
    name = "exposed_files"
    category = "Exposed files"

    async def scan(self, ctx, page):
        if passive(ctx):
            return []
        findings = []
        if once(ctx, "exposed_files:" + origin(page.url)):
            for path in ("/.env", "/.git/HEAD"):
                url = origin(page.url) + path
                if not permitted(ctx, url):
                    continue
                try:
                    response = await ctx.http.get(url, max_bytes=512)
                except httpx.HTTPError as exc:
                    report_error(ctx, self.name, exc)
                    continue
                if response.status != 200 or document(response):
                    continue
                text = response.text
                if path == "/.git/HEAD":
                    valid = bool(
                        re.fullmatch(
                            r"\s*(?:ref: refs/(?:heads|tags)/[\w./-]{1,200}|[0-9a-fA-F]{40,64})\s*",
                            text,
                        )
                    )
                    if valid:
                        findings.append(
                            FindingCandidate(
                                self.name,
                                "Git repository metadata is publicly reachable",
                                self.category,
                                "The small .git/HEAD response matches Git metadata. Repository objects and source files were not requested.",
                                "medium",
                                95,
                                "HTTP 200 with a syntactically valid Git HEAD reference; at most 512 response bytes inspected.",
                                "Block web access to version-control directories and deploy only intended public artifacts.",
                                url,
                                cwe="CWE-552",
                                signals=["git_head_signature"],
                                metadata={
                                    "bytes_sampled": len(response.body),
                                    "content_retained": False,
                                },
                                evidence_page=response,
                            )
                        )
                else:
                    keys = re.findall(
                        r"(?m)^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]{0,100})\s*=", text
                    )
                    sensitive_count = sum(
                        bool(
                            re.search(
                                r"secret|password|passwd|token|api_?key|database_url|db_(?:pass|password)|private_?key",
                                key,
                                re.I,
                            )
                        )
                        for key in keys
                    )
                    if len(keys) >= 2 and sensitive_count:
                        findings.append(
                            FindingCandidate(
                                self.name,
                                "Environment configuration file is publicly reachable",
                                self.category,
                                "The sampled response contains environment-assignment syntax including credential-related key names. Values were not retained, validated, or used.",
                                "high",
                                90,
                                f"HTTP 200; {len(keys)} assignment keys and {sensitive_count} credential-related key indicators in a sample capped at 512 bytes.",
                                "Deny web access to environment files, move configuration outside the document root, and investigate whether exposed credentials require rotation.",
                                url,
                                cwe="CWE-538",
                                signals=[
                                    "environment_assignment_format",
                                    "credential_key_indicator",
                                ],
                                metadata={
                                    "bytes_sampled": len(response.body),
                                    "assignment_count": len(keys),
                                    "sensitive_key_count": sensitive_count,
                                    "content_retained": False,
                                },
                                evidence_page=response,
                            )
                        )
        # Only inspect already observed backup/dump references. Media are never
        # downloaded, and archive bodies are never requested by this scanner.
        if document(page) and not is_directory_listing(page):
            probes = 0
            for url, _ in discover_html(page):
                path = urlsplit(url).path
                if not re.search(
                    r"(?:\.sql(?:\.gz)?|\.dump|\.bak|\.backup|(?:backup|dump)[^/]*\.(?:zip|tar|tgz|gz))$",
                    path,
                    re.I,
                ):
                    continue
                if probes >= 3:
                    break
                if not permitted(ctx, url) or not once(ctx, "backup_head:" + url):
                    continue
                probes += 1
                try:
                    response = await ctx.http.head(url, max_bytes=0)
                except httpx.HTTPError as exc:
                    report_error(ctx, self.name, exc)
                    continue
                if response.status == 200 and not document(response):
                    findings.append(
                        FindingCandidate(
                            self.name,
                            "Referenced backup or dump file is reachable",
                            self.category,
                            "An existing page references a backup-like resource that answered HEAD successfully. Its contents and sensitivity remain unverified; the body was not downloaded.",
                            "low",
                            70,
                            "An observed backup/dump reference returned HTTP 200 to HEAD. No body bytes were requested.",
                            "Confirm the resource is intended for public distribution and remove or protect operational backups.",
                            url,
                            cwe="CWE-552",
                            signals=["observed_backup_reference", "head_success"],
                            metadata={"method": "HEAD", "body_downloaded": False},
                            evidence_page=response,
                        )
                    )
        return findings


class JavaScriptScanner:
    name = "javascript"
    category = "JavaScript exposure"

    async def scan(self, ctx, page):
        path = urlsplit(page.url).path.lower()
        kind = page.headers.get("content-type", "").lower()
        if not (path.endswith((".js", ".mjs")) or "javascript" in kind or "ecmascript" in kind):
            return []
        if page.status != 200:
            return []
        findings = []
        text = page.text[: 2 * 1024 * 1024]
        signatures = {
            "aws_access_key_identifier": r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
            "private_key_material": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
            "github_token_pattern": r"\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,})\b",
        }
        counts = {name: len(re.findall(pattern, text)) for name, pattern in signatures.items()}
        counts = {name: count for name, count in counts.items() if count}
        if counts:
            findings.append(
                FindingCandidate(
                    self.name,
                    "JavaScript contains credential-like material",
                    self.category,
                    "A published JavaScript response contains recognizable credential or private-key patterns. Values were not retained or tested; examples and revoked identifiers can produce false positives.",
                    "medium",
                    80,
                    "Credential-like pattern types: " + ", ".join(counts) + ".",
                    "Review the indicated build artifact, remove private credentials from client bundles, and rotate confirmed exposed credentials.",
                    page.url,
                    cwe="CWE-798",
                    signals=list(counts),
                    excerpt="[Credential-like values omitted]",
                    metadata={"pattern_counts": counts, "credentials_tested": False},
                )
            )
        maps = [
            url
            for url, source in discover_javascript(text, page.url)
            if source == "javascript:sourcemap"
        ]
        for name in ("sourcemap", "x-sourcemap"):
            if page.headers.get(name):
                maps.append(urljoin(page.url, page.headers[name]))
        for url in dict.fromkeys(maps):
            if not permitted(ctx, url):
                continue
            await ctx.remember_url(url, "javascript:sourcemap")
            reachable = False
            evidence_page = page
            if not passive(ctx):
                if not once(ctx, "sourcemap_head:" + url):
                    continue
                try:
                    response = await ctx.http.head(url, max_bytes=0)
                except httpx.HTTPError as exc:
                    report_error(ctx, self.name, exc)
                else:
                    content_type = response.headers.get("content-type", "").lower()
                    reachable = (
                        response.status == 200
                        and not document(response)
                        and (
                            "json" in content_type
                            or "octet-stream" in content_type
                            or urlsplit(response.url).path.endswith(".map")
                        )
                    )
                    if reachable:
                        evidence_page = response
            findings.append(
                FindingCandidate(
                    self.name,
                    "JavaScript source map is reachable"
                    if reachable
                    else "JavaScript references a source map",
                    self.category,
                    "A source-map reference may disclose original source structure. Map bodies and embedded sources were not downloaded; embedded source content is unverified.",
                    "low" if reachable else "informational",
                    85 if reachable else 65,
                    "An observed source-map reference"
                    + (
                        " returned HTTP 200 to HEAD."
                        if reachable
                        else " was found in JavaScript or response headers."
                    ),
                    "Publish source maps only when intended, and keep private source material and secrets out of distributed artifacts.",
                    url,
                    cwe="CWE-540",
                    signals=["source_map_reference"] + (["head_success"] if reachable else []),
                    metadata={"body_downloaded": False, "embedded_sources_verified": False},
                    evidence_page=evidence_page,
                )
            )
        return findings


class CORSScanner:
    name = "cors"
    category = "Cross-origin policy"

    async def scan(self, ctx, page):
        if (
            passive(ctx)
            or not (200 <= page.status < 300)
            or not (document(page) or "json" in page.headers.get("content-type", "").lower())
        ):
            return []
        if not once(ctx, "cors:" + page.url):
            return []
        findings = []
        for test_origin in ("https://bountyscope.invalid", "null"):
            try:
                response = await ctx.http.get(
                    page.url,
                    headers={"Origin": test_origin},
                    max_bytes=512,
                    follow_redirects=False,
                )
            except httpx.HTTPError as exc:
                report_error(ctx, self.name, exc)
                continue
            if origin(response.url) != origin(page.url) or not (200 <= response.status < 300):
                continue
            allowed = response.headers.get("access-control-allow-origin", "").strip()
            credentials = (
                response.headers.get("access-control-allow-credentials", "").strip() == "true"
            )
            if allowed == test_origin and credentials:
                null_origin = test_origin == "null"
                findings.append(
                    FindingCandidate(
                        self.name,
                        "CORS allows credentialed null-origin requests"
                        if null_origin
                        else "CORS allows a credentialed arbitrary test origin",
                        self.category,
                        "A safe unauthenticated Origin probe received a matching allow-origin plus allow-credentials policy. Sensitive cross-origin data access and authenticated impact remain unverified.",
                        "medium",
                        85 if null_origin else 90,
                        f"Origin {test_origin} received matching Access-Control-Allow-Origin and Access-Control-Allow-Credentials: true.",
                        "Use an explicit trusted-origin allowlist, reject untrusted/null origins, and enable credentialed cross-origin access only where necessary.",
                        page.url,
                        cwe="CWE-942",
                        signals=[
                            "null_origin_allowed" if null_origin else "test_origin_allowed",
                            "credentials_allowed",
                        ],
                        metadata={
                            "test_origin": test_origin,
                            "authenticated_impact_verified": False,
                        },
                        evidence_page=response,
                    )
                )
        return findings
