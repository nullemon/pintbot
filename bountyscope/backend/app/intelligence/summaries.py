"""Reduce observations to redacted data before they cross the provider boundary."""

from collections.abc import Iterable, Mapping

from app.utils.redaction import redact, sanitize


def read(value, key, default=None):
    return value.get(key, default) if isinstance(value, Mapping) else getattr(value, key, default)


def bounded(value, limit=2000):
    value = str(value or "")
    try:
        return str(sanitize(value))[:limit]
    except (ValueError, UnicodeError):
        # Preserve malformed URL evidence as text; audit sinks may sanitize again.
        return ("[invalid URL] " + redact(value))[:limit]


def finding_summary(finding):
    fields = (
        "id",
        "scanner",
        "title",
        "category",
        "description",
        "severity",
        "confidence",
        "status",
        "cwe",
        "affected_url",
        "affected_parameter",
        "evidence_summary",
        "recommendation",
    )
    return {key: bounded(read(finding, key)) for key in fields}


def evidence_summary(evidence):
    result = []
    if evidence is None:
        evidence = []
    elif isinstance(evidence, Mapping) or not isinstance(evidence, Iterable):
        evidence = [evidence]
    for item in list(evidence)[:10]:
        request = read(item, "request_metadata", {}) or {}
        response = read(item, "response_metadata", {}) or {}
        result.append(
            {
                "type": bounded(read(item, "type"), 60),
                "request": {
                    "method": bounded(read(request, "method"), 10),
                    "url": bounded(read(request, "url")),
                },
                "response": {
                    "status": bounded(read(response, "status_code", read(response, "status")), 10),
                    "content_type": bounded(read(response, "content_type"), 150),
                },
                "redacted_excerpt": bounded(read(item, "redacted_excerpt"), 1000),
                "body_sha256": bounded(read(item, "body_sha256"), 64),
            }
        )
    return result


def observation_summary(observations):
    result = []
    for page in list(observations or [])[-20:]:
        headers = read(page, "headers", {}) or {}
        # Neither raw HTML nor cookies, authorization, or arbitrary header values leave the scan.
        result.append(
            {
                "url": bounded(read(page, "url")),
                "status": bounded(read(page, "status", read(page, "status_code")), 10),
                "content_type": bounded(read(headers, "content-type"), 150),
                "observed_security_headers": [
                    name
                    for name in (
                        "content-security-policy",
                        "strict-transport-security",
                        "x-frame-options",
                        "x-content-type-options",
                        "referrer-policy",
                    )
                    if name in headers
                ],
                "truncated": bool(read(page, "truncated", False)),
            }
        )
    return result
