"""Reduce observations to redacted data before they cross the provider boundary."""

import json
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
    for page in reversed(list(observations or [])[-20:]):
        headers = read(page, "headers", {}) or {}
        # Neither raw HTML nor cookies, authorization, or arbitrary header values leave the scan.
        entry = {
            "url": bounded(read(page, "url")),
            "status": bounded(read(page, "status", read(page, "status_code")), 10),
            "content_type": bounded(read(page, "content_type", read(headers, "content-type")), 150),
            "signals": [bounded(s, 160) for s in list(read(page, "signals", []) or [])[:10]],
            "discovered_urls": [
                bounded(u) for u in list(read(page, "discovered_urls", []) or [])[:20]
            ],
            "parent_directories": [
                bounded(u) for u in list(read(page, "parent_directories", []) or [])[:20]
            ],
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
        provenance = read(page, "provenance")
        if provenance in {"guarded_http", "browser_snapshot_unverified"}:
            entry["provenance"] = provenance
        focus = read(page, "researcher_focus")
        if isinstance(focus, str) and focus:
            entry["researcher_focus"] = bounded(focus, 1000)
        forms = read(page, "form_summary")
        if isinstance(forms, Mapping):
            entry["form_summary"] = {
                key: value
                for key in ("total", "auth_inputs", "file_inputs")
                if isinstance(value := forms.get(key), int)
                and not isinstance(value, bool)
                and 0 <= value <= 10000
            }
        secure_context = read(page, "secure_context")
        if isinstance(secure_context, bool):
            entry["secure_context"] = secure_context
        if len(json.dumps([*result, entry], ensure_ascii=True)) > 64000:
            entry["discovered_urls"] = []
            entry["parent_directories"] = []
        if len(json.dumps([*result, entry], ensure_ascii=True)) <= 64000:
            result.append(entry)
    return list(reversed(result))
