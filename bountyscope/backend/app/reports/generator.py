"""Deterministic, escaped reports built exclusively from recorded finding data."""

import html
import json
import string
from collections.abc import Iterable, Mapping
from urllib.parse import urlsplit

from app.utils.redaction import SENSITIVE, redact, sanitize

_REFERENCES = (
    (
        "OWASP Web Security Testing Guide",
        "https://owasp.org/www-project-web-security-testing-guide/",
    ),
    ("Common Weakness Enumeration (CWE)", "https://cwe.mitre.org/"),
)
_IMPACT_CAUTION = (
    "The recorded evidence establishes only the observations shown below. "
    "Exploitability and business impact require authorized manual verification; "
    "the recorded severity is a triage assessment, not proof of compromise."
)


def _get(record, name, default=""):
    value = (
        record.get(name, default) if isinstance(record, Mapping) else getattr(record, name, default)
    )
    return default if value is None else value


def _clean(value):
    """Redact at the output boundary, including structured metadata and dictionary keys."""
    if isinstance(value, Mapping):
        return {
            redact(str(key)): "[REDACTED]" if SENSITIVE.search(str(key)) else _clean(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_clean(item) for item in value]
    if not isinstance(value, (str, int, float, bool, type(None))):
        value = str(value)
    if isinstance(value, str):
        try:
            value = sanitize(value)
        except ValueError:
            # Malformed URLs are still evidence text, never links or requests.
            pass
        return redact(value)
    return value


def _display(value):
    value = _clean(value)
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)
    return str(value)


def _markdown(value):
    """Escape all Markdown punctuation and raw HTML without creating dynamic links."""
    escaped = []
    for character in _display(value).replace("\r\n", "\n").replace("\r", "\n"):
        if character in "&<>\"'":
            escaped.append(html.escape(character, quote=True))
        elif character in string.punctuation:
            escaped.append("\\" + character)
        elif character == "\n":
            escaped.append("  \n")
        else:
            escaped.append(character)
    return "".join(escaped)


def _html(value):
    return html.escape(_display(value), quote=True)


def _records(evidence):
    if evidence is None:
        return []
    if isinstance(evidence, Mapping) or not isinstance(evidence, Iterable):
        return [evidence]
    if isinstance(evidence, (str, bytes)):
        return []
    return list(evidence)


def _observed_requests(records):
    """Never infer a request from the finding URL, prose, or AI output."""
    requests = []
    seen = set()
    for record in records:
        metadata = _get(record, "request_metadata", {})
        if not isinstance(metadata, Mapping):
            continue
        method, url = metadata.get("method"), metadata.get("url")
        if not isinstance(method, str) or not isinstance(url, str):
            continue
        method = method.upper().strip()
        if method not in {"GET", "HEAD"} or any(ord(char) < 32 for char in url):
            continue
        try:
            parsed = urlsplit(url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                continue
        except ValueError:
            continue
        request = (method, _display(url))
        if request not in seen:
            seen.add(request)
            requests.append(request)
    return requests


def generate_report(finding, evidence, format="markdown") -> str:
    """Render a finding and its evidence as Markdown or HTML, with no network or AI calls.

    ``finding`` and evidence records may be dictionaries or ORM objects. Reproduction
    contains only GET/HEAD URLs explicitly present in evidence request metadata.
    Stored AI analysis is deliberately excluded from every report section.
    """
    if format not in {"markdown", "html"}:
        raise ValueError("Report format must be 'markdown' or 'html'")
    records = _records(evidence)
    title = _get(finding, "title", "Untitled finding")
    sections = [
        (
            "Summary",
            [
                ("Description", _get(finding, "description", "No description recorded.")),
                ("Category", _get(finding, "category", "Not recorded")),
                ("Severity", _get(finding, "severity", "Not recorded")),
                ("Confidence", _get(finding, "confidence", "Not recorded")),
                ("Status", _get(finding, "status", "needs_verification")),
                ("Affected URL", _get(finding, "affected_url", "Not recorded")),
                ("Affected parameter", _get(finding, "affected_parameter", "Not recorded")),
                ("CWE classification", _get(finding, "cwe", "Not recorded")),
                ("OWASP classification", _get(finding, "owasp_category", "Not recorded")),
            ],
        ),
        (
            "Observed evidence",
            [
                (
                    "Recorded summary",
                    _get(finding, "evidence_summary", "No evidence summary recorded."),
                ),
            ],
        ),
    ]
    if not records:
        sections[1][1].append(("Evidence records", "No evidence records supplied."))
    for index, record in enumerate(records, start=1):
        prefix = f"Evidence {index}"
        sections[1][1].extend(
            [
                (f"{prefix} type", _get(record, "type", "Not recorded")),
                (f"{prefix} request", _get(record, "request_metadata", {})),
                (f"{prefix} response", _get(record, "response_metadata", {})),
                (f"{prefix} excerpt", _get(record, "redacted_excerpt", "No excerpt recorded.")),
                (f"{prefix} body SHA-256", _get(record, "body_sha256", "Not recorded")),
            ]
        )
    requests = _observed_requests(records)
    reproduction = [
        (
            f"Step {index}",
            f"Within the authorized scope, repeat the recorded {method} request to {url}.",
        )
        for index, (method, url) in enumerate(requests, start=1)
    ]
    if not reproduction:
        reproduction = [
            (
                "Reproduction",
                (
                    "No reproducible GET or HEAD request was recorded in the supplied evidence. "
                    "No request steps have been inferred."
                ),
            )
        ]
    sections.extend(
        [
            ("Impact", [("Verification caution", _IMPACT_CAUTION)]),
            ("Reproduction", reproduction),
            (
                "Recommendation",
                [
                    (
                        "Recorded recommendation",
                        _get(
                            finding,
                            "recommendation",
                            "No recommendation recorded; review the evidence before remediation.",
                        ),
                    )
                ],
            ),
            ("References", list(_REFERENCES)),
            (
                "Researcher notes",
                [("Notes", _get(finding, "researcher_notes", "No researcher notes recorded."))],
            ),
        ]
    )

    if format == "markdown":
        output = [f"# {_markdown(title)}"]
        for heading, fields in sections:
            output.append(f"## {heading}")
            if heading == "References":
                output.extend(f"- [{label}]({url})" for label, url in fields)
            else:
                output.extend(f"**{label}:** {_markdown(value)}" for label, value in fields)
        return "\n\n".join(output) + "\n"

    output = [
        "<!doctype html>",
        '<html lang="en"><head><meta charset="utf-8">',
        f"<title>{_html(title)}</title></head><body><article>",
        f"<h1>{_html(title)}</h1>",
    ]
    for heading, fields in sections:
        output.append(f"<section><h2>{heading}</h2>")
        if heading == "References":
            output.extend(
                f'<p><a href="{url}" rel="noopener noreferrer">{label}</a></p>'
                for label, url in fields
            )
        else:
            output.append("<dl>")
            output.extend(
                f"<dt>{label}</dt><dd><pre>{_html(value)}</pre></dd>" for label, value in fields
            )
            output.append("</dl>")
        output.append("</section>")
    output.append("</article></body></html>")
    return "\n".join(output) + "\n"


__all__ = ["generate_report"]
