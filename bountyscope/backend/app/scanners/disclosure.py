import re
from urllib.parse import parse_qsl, urljoin, urlsplit

from app.scanners.base import FindingCandidate, Page


class InformationDisclosureScanner:
    name = "information_disclosure"
    category = "Information disclosure"

    async def scan(self, ctx, page):
        findings = []
        versioned = [
            name
            for name in ("server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version")
            if re.search(r"\d+\.\d+", page.headers.get(name, ""))
        ]
        if versioned:
            findings.append(
                FindingCandidate(
                    self.name,
                    "Response headers expose software version information",
                    self.category,
                    "Version banners may help identify the serving stack. A version banner does not establish that a vulnerable component is installed.",
                    "informational",
                    95,
                    "Version-like values were observed in: " + ", ".join(versioned) + ".",
                    "Remove unnecessary software version banners and keep deployed components patched.",
                    page.url,
                    cwe="CWE-200",
                    signals=["version_header:" + key for key in versioned],
                    metadata={"headers": versioned},
                )
            )
        # Match distinctive diagnostic output, not an isolated word such as error.
        text = page.text[: 256 * 1024]
        patterns = {
            "python_traceback": r"Traceback \(most recent call last\):[\s\S]{0,1000}File [\"']",
            "django_debug": r"(?:You're seeing this error because you have <code>DEBUG = True|DEBUG\s*=\s*True[\s\S]{0,1000}Django)",
            "werkzeug_debugger": r"(?:Werkzeug Debugger|The debugger caught an exception in your WSGI application)",
            "php_diagnostic": r"(?:Fatal error|Warning):.{0,250}(?: on line \d+|Stack trace:)",
            "aspnet_diagnostic": r"(?:Server Error in ['\"]/|\[\w+Exception:[\s\S]{0,1000}Stack Trace:)",
            "java_traceback": r"(?:Exception in thread|(?:java|org|com)\.[\w.]+Exception:)[\s\S]{0,1000}\bat (?:[\w$]+\.){2,}",
            "phpinfo": r"(?:<title>phpinfo\(\)</title>|PHP Version[\s\S]{0,1000}Configuration File \(php.ini\))",
            "laravel_ignition": r"(?:ignition-error-page|Spatie\\LaravelIgnition|Whoops! There was an error)",
        }
        signals = [label for label, pattern in patterns.items() if re.search(pattern, text, re.I)]
        if page.status < 400 and not re.search(
            r"<title>[^<]*(?:debugger|server error|exception)", text, re.I
        ):
            # A code sample on a successful documentation page is insufficient
            # evidence of an application error leaking its current stack.
            signals = [
                signal
                for signal in signals
                if signal not in {"python_traceback", "java_traceback", "php_diagnostic"}
            ]
        if signals:
            findings.append(
                FindingCandidate(
                    self.name,
                    "Diagnostic or debug output is publicly visible",
                    self.category,
                    "The response contains distinctive diagnostic output that can disclose implementation details. No debugger interaction or code execution was attempted.",
                    "medium",
                    95,
                    "Diagnostic signatures observed: " + ", ".join(signals) + ".",
                    "Disable production debug output, return generic errors, and retain detailed diagnostics in access-controlled logs.",
                    page.url,
                    cwe="CWE-209",
                    signals=signals,
                    metadata={"signatures": signals},
                )
            )
        return findings


class RedirectScanner:
    name = "redirects"
    category = "Redirect behavior"
    redirect_names = {
        "next",
        "url",
        "redirect",
        "redirect_uri",
        "redirect_url",
        "return",
        "returnurl",
        "return_url",
        "continue",
        "destination",
        "dest",
        "to",
        "callback",
    }

    async def scan(self, ctx, page):
        observations = [page]
        for hop in page.redirects:
            if all(key in hop for key in ("url", "status", "location")):
                observations.append(
                    Page(hop["url"], hop["status"], {"location": hop["location"]}, b"")
                )
        findings = []
        seen = set()
        for observation in observations:
            key = (observation.url, observation.status, observation.headers.get("location"))
            if key in seen:
                continue
            seen.add(key)
            findings.extend(self._analyze(observation))
        return findings

    def _analyze(self, page):
        if page.status not in {301, 302, 303, 307, 308} or not page.headers.get("location"):
            return []
        try:
            destination = urlsplit(urljoin(page.url, page.headers["location"]))
            current = urlsplit(page.url)
        except ValueError:
            return []
        if destination.scheme not in {"http", "https"} or not destination.hostname:
            return []
        findings = []
        for key, value in parse_qsl(current.query, keep_blank_values=True):
            if key.lower() not in self.redirect_names:
                continue
            try:
                reflected = urlsplit(urljoin(page.url, value))
                matches = (
                    reflected.hostname == destination.hostname
                    and reflected.path == destination.path
                )
                external = destination.hostname.lower() != (current.hostname or "").lower()
            except ValueError:
                continue
            if matches and external:
                findings.append(
                    FindingCandidate(
                        self.name,
                        "Redirect destination corresponds to an observed URL parameter",
                        self.category,
                        "An observed redirect points to another hostname and corresponds to an existing URL parameter. The parameter was not modified; arbitrary redirect acceptance remains unverified.",
                        "low",
                        60,
                        "An observed 3xx Location and an existing redirect-related parameter share the destination hostname and path.",
                        "Validate redirect destinations against a strict allowlist or use server-side destination identifiers.",
                        page.url,
                        cwe="CWE-601",
                        parameter=key,
                        signals=[
                            "observed_external_redirect",
                            "destination_parameter_correspondence",
                        ],
                        metadata={"verification": "observed_only"},
                        evidence_page=page,
                    )
                )
        return findings


class CacheScanner:
    name = "cache"
    category = "Cache policy"

    async def scan(self, ctx, page):
        control = page.headers.get("cache-control", "").lower()
        directives = {
            part.strip().split("=", 1)[0]: part.strip().partition("=")[2].strip('"')
            for part in control.split(",")
            if part.strip()
        }
        findings = []
        has_session_cookie = any(
            re.search(r"(?:^|[;\s])(session\w*|auth\w*|token\w*|sid)=", value, re.I)
            for value in page.headers.get_list("set-cookie")
        )
        shared_age = directives.get("s-maxage", "")
        shared = "public" in directives or (
            bool(re.fullmatch(r"[0-9]+", shared_age)) and bool(shared_age.strip("0"))
        )
        if (
            has_session_cookie
            and shared
            and "no-store" not in directives
            and "private" not in directives
        ):
            findings.append(
                FindingCandidate(
                    self.name,
                    "Session-like cookie response permits shared caching",
                    self.category,
                    "A response setting a session-like cookie advertises shared caching. Sensitive content and a shared-cache disclosure were not demonstrated.",
                    "medium",
                    75,
                    "Set-Cookie includes a session-like name and Cache-Control permits public or positive s-maxage caching.",
                    "Apply Cache-Control: private, no-store to personalized responses and verify intermediary cache behavior.",
                    page.url,
                    cwe="CWE-525",
                    signals=["session_cookie", "shared_cache_directive"],
                )
            )
        acao = page.headers.get("access-control-allow-origin", "")
        vary = {value.strip().lower() for value in page.headers.get("vary", "").split(",")}
        if acao and acao != "*" and "origin" not in vary and "*" not in vary and shared:
            findings.append(
                FindingCandidate(
                    self.name,
                    "Origin-specific CORS response lacks Vary: Origin",
                    self.category,
                    "An explicitly shared-cacheable response advertises a specific CORS origin without varying on Origin. This can produce incorrect cross-origin cache reuse.",
                    "low",
                    85,
                    "A specific Access-Control-Allow-Origin and shared-cache directive were observed without Vary: Origin.",
                    "Include Vary: Origin when Access-Control-Allow-Origin depends on the request Origin, or avoid shared caching.",
                    page.url,
                    cwe="CWE-524",
                    signals=[
                        "specific_cors_origin",
                        "shared_cache_directive",
                        "missing_vary_origin",
                    ],
                )
            )
        return findings
