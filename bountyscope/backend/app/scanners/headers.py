import re
import ssl
from datetime import UTC, datetime
from http.cookies import CookieError, SimpleCookie
from urllib.parse import urlsplit

from app.scanners.base import FindingCandidate, document


class SecurityHeadersScanner:
    name = "security_headers"
    category = "Security headers"

    async def scan(self, ctx, page):
        if not (200 <= page.status < 400) or not document(page):
            return []
        headers = page.headers
        findings = []
        specs = [
            (
                "content-security-policy",
                "Content Security Policy is absent",
                "CWE-693",
                "Define a restrictive Content-Security-Policy for executable content and frame ancestors.",
            ),
            (
                "x-content-type-options",
                "MIME sniffing protection is absent",
                "CWE-693",
                "Send X-Content-Type-Options: nosniff with appropriate Content-Type values.",
            ),
            (
                "referrer-policy",
                "Explicit referrer policy is absent",
                "CWE-200",
                "Set Referrer-Policy to strict-origin-when-cross-origin or a stricter policy.",
            ),
        ]
        specs.append(
            (
                "permissions-policy",
                "Explicit browser permissions policy is absent",
                "CWE-693",
                "Set Permissions-Policy to restrict browser capabilities that the application does not need.",
            )
        )
        for header, title, cwe, recommendation in specs:
            if not headers.get(header):
                findings.append(
                    FindingCandidate(
                        self.name,
                        title,
                        self.category,
                        "A defense-in-depth browser response header is missing. This observation alone does not establish an exploitable vulnerability.",
                        "informational",
                        95,
                        f"The HTML response did not include {header}.",
                        recommendation,
                        page.url,
                        cwe=cwe,
                        signals=[f"missing:{header}"],
                    )
                )
        csp = headers.get("content-security-policy", "")
        csp_directives = {
            part.strip().split()[0].lower(): part.strip().split()[1:]
            for part in csp.split(";")
            if part.strip()
        }
        valid_xfo = headers.get("x-frame-options", "").strip().upper() in {"DENY", "SAMEORIGIN"}
        if not valid_xfo and "frame-ancestors" not in csp_directives:
            findings.append(
                FindingCandidate(
                    self.name,
                    "Framing policy is absent",
                    self.category,
                    "The document does not advertise a framing restriction. Clickjacking impact requires an actionable interface and separate verification.",
                    "low",
                    85,
                    "Neither a supported X-Frame-Options value nor a CSP frame-ancestors directive was observed.",
                    "Use CSP frame-ancestors to restrict which sites may embed this document.",
                    page.url,
                    cwe="CWE-1021",
                    signals=["no_frame_policy"],
                )
            )
        if urlsplit(page.url).scheme == "https":
            hsts = headers.get("strict-transport-security", "")
            age = re.search(r'(?:^|;)\s*max-age\s*=\s*"?([0-9]+)"?\s*(?:;|$)', hsts, re.I)
            if not age or not age.group(1).strip("0"):
                findings.append(
                    FindingCandidate(
                        self.name,
                        "HTTPS transport policy is absent or disabled",
                        self.category,
                        "This HTTPS response does not establish a positive HSTS lifetime. Browsers may still permit initial HTTP navigation.",
                        "low",
                        95,
                        "No valid positive Strict-Transport-Security max-age was observed.",
                        "After confirming HTTPS coverage, deploy HSTS with a positive lifetime and expand coverage deliberately.",
                        page.url,
                        cwe="CWE-319",
                        signals=["hsts_missing_or_disabled"],
                    )
                )
        script_policy = csp_directives.get("script-src", csp_directives.get("default-src", []))
        dynamic_trust = "'strict-dynamic'" in script_policy and any(
            re.match(r"'(?:nonce-|sha(?:256|384|512)-)", value) for value in script_policy
        )
        broad_script = "'unsafe-eval'" in script_policy or (
            "*" in script_policy and not dynamic_trust
        )
        if script_policy and broad_script:
            findings.append(
                FindingCandidate(
                    self.name,
                    "Content Security Policy permits broad script execution",
                    self.category,
                    "The observed script policy includes a broad source or unsafe-eval. Its impact depends on the application's injection defenses.",
                    "low",
                    85,
                    "The effective script-src/default-src contains * or 'unsafe-eval'.",
                    "Restrict script sources and remove unsafe-eval where application compatibility permits.",
                    page.url,
                    cwe="CWE-693",
                    signals=["broad_script_policy"],
                )
            )
        xcto = headers.get("x-content-type-options", "")
        if xcto and xcto.lower().strip() != "nosniff":
            findings.append(
                FindingCandidate(
                    self.name,
                    "MIME sniffing header has an unsupported value",
                    self.category,
                    "The browser may ignore an invalid X-Content-Type-Options value.",
                    "low",
                    95,
                    "X-Content-Type-Options was present but was not nosniff.",
                    "Set X-Content-Type-Options to nosniff.",
                    page.url,
                    cwe="CWE-693",
                    signals=["invalid_x_content_type_options"],
                )
            )
        return findings


class CookieScanner:
    name = "cookies"
    category = "Cookie configuration"

    async def scan(self, ctx, page):
        findings = []
        for raw in page.headers.get_list("set-cookie"):
            jar = SimpleCookie()
            try:
                jar.load(raw)
            except CookieError:
                continue
            for name, cookie in jar.items():
                # Deletion cookies do not create an ongoing exposure.
                if cookie["max-age"].strip() == "0":
                    continue
                sensitive = bool(
                    re.search(r"session|auth|jwt|token|sid|login|remember", name, re.I)
                )
                issues = []
                if sensitive and not cookie["secure"]:
                    issues.append("Secure")
                if sensitive and not cookie["httponly"]:
                    issues.append("HttpOnly")
                if sensitive and not cookie["samesite"]:
                    issues.append("SameSite")
                if cookie["samesite"].lower() == "none" and not cookie["secure"]:
                    issues.append("Secure required for SameSite=None")
                if name.startswith("__Host-") and (
                    not cookie["secure"] or cookie["domain"] or cookie["path"] != "/"
                ):
                    issues.append("__Host- prefix requirements")
                if name.startswith("__Secure-") and not cookie["secure"]:
                    issues.append("__Secure- prefix requirements")
                if issues:
                    findings.append(
                        FindingCandidate(
                            self.name,
                            "Cookie security attributes need review",
                            self.category,
                            "A session-like cookie or browser-enforced cookie prefix is missing protective attributes. Cookie values were not retained.",
                            "low",
                            90 if sensitive else 80,
                            "Observed missing or inconsistent attributes: "
                            + ", ".join(issues)
                            + ".",
                            "Use Secure and HttpOnly for session cookies; choose an explicit SameSite policy and satisfy cookie prefix requirements.",
                            page.url,
                            cwe="CWE-614",
                            parameter=name[:100],
                            signals=["cookie_attribute:" + issue for issue in issues],
                            metadata={
                                "attributes": issues,
                                "classification": "session_or_auth" if sensitive else "non_session",
                                "domain": cookie["domain"],
                                "path": cookie["path"],
                                "expires": cookie["expires"],
                                "same_site": cookie["samesite"],
                                "secure": bool(cookie["secure"]),
                                "http_only": bool(cookie["httponly"]),
                            },
                        )
                    )
        return findings


class TLSScanner:
    name = "tls"
    category = "Transport security"

    async def scan(self, ctx, page):
        if urlsplit(page.url).scheme != "https":
            if document(page):
                return [
                    FindingCandidate(
                        self.name,
                        "Document was served over unencrypted HTTP",
                        self.category,
                        "The observed document was transferred without TLS. Availability of an equivalent HTTPS endpoint was not established by this observation.",
                        "low",
                        100,
                        "The final response URL used the http scheme.",
                        "Serve the application over HTTPS and redirect HTTP navigation to HTTPS.",
                        page.url,
                        cwe="CWE-319",
                        signals=["http_transport"],
                    )
                ]
            return []
        tls = page.tls or {}
        findings = []
        version = str(tls.get("version") or tls.get("protocol") or "")
        if version.upper().replace(" ", "") in {
            "SSLV2",
            "SSLV3",
            "TLSV1",
            "TLSV1.0",
            "TLSV1.1",
            "TLS1.0",
            "TLS1.1",
        }:
            findings.append(
                self._finding(
                    page,
                    "Legacy TLS protocol was negotiated",
                    "Negotiated protocol: " + version,
                    "Disable obsolete SSL/TLS versions and require TLS 1.2 or later.",
                    "medium",
                    "legacy_tls",
                )
            )
        cipher = tls.get("cipher", "")
        if isinstance(cipher, (list, tuple)):
            cipher = cipher[0] if cipher else ""
        if re.search(r"(?:^|[-_])(RC4|DES|3DES|NULL|EXPORT|MD5)(?:$|[-_])", str(cipher), re.I):
            findings.append(
                self._finding(
                    page,
                    "Weak TLS cipher was negotiated",
                    "The negotiated cipher matched an obsolete algorithm.",
                    "Disable obsolete cipher suites and prefer modern authenticated encryption.",
                    "medium",
                    "weak_cipher",
                )
            )
        expiry = tls.get("expires_at") or tls.get("not_after")
        try:
            if isinstance(expiry, (int, float)):
                expires = datetime.fromtimestamp(expiry, UTC)
            elif expiry:
                try:
                    expires = datetime.fromisoformat(str(expiry).replace("Z", "+00:00"))
                except ValueError:
                    expires = datetime.fromtimestamp(ssl.cert_time_to_seconds(str(expiry)), UTC)
                if expires.tzinfo is None:
                    expires = expires.replace(tzinfo=UTC)
            else:
                expires = None
        except (ValueError, TypeError, OverflowError, OSError):
            expires = None
        if expires is not None:
            days = (expires - datetime.now(UTC)).total_seconds() / 86400
            if days < 30:
                findings.append(
                    self._finding(
                        page,
                        "TLS certificate has expired"
                        if days < 0
                        else "TLS certificate expires soon",
                        "The observed certificate expires at " + expires.isoformat() + ".",
                        "Renew the certificate and verify automated renewal monitoring.",
                        "medium" if days < 0 else "informational",
                        "certificate_expiry",
                    )
                )
        if tls.get("hostname_matches") is False or tls.get("verified") is False:
            findings.append(
                self._finding(
                    page,
                    "TLS certificate verification issue was reported",
                    "The guarded transport recorded a certificate verification failure.",
                    "Deploy a valid certificate chain covering the requested hostname.",
                    "medium",
                    "certificate_validation",
                )
            )
        return findings

    def _finding(self, page, title, evidence, recommendation, severity, signal):
        return FindingCandidate(
            self.name,
            title,
            self.category,
            "Assessment is based on the single observed TLS connection; other protocol and cipher support was not enumerated.",
            severity,
            95,
            evidence,
            recommendation,
            page.url,
            cwe="CWE-326",
            signals=[signal],
        )
