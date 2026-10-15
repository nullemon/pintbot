"""Report security and provenance checks across both supported output formats."""

import re
from html.parser import HTMLParser

import pytest

from app.models import Evidence, Finding
from app.reports import generate_report


@pytest.fixture
def finding():
    return {
        "title": "Observed missing security header",
        "description": "The recorded response did not contain a header.",
        "severity": "low",
        "confidence": 90,
        "category": "security_headers",
        "status": "needs_verification",
        "affected_url": "https://example.test/private-unobserved-path",
        "evidence_summary": "A response was recorded.",
        "recommendation": "Review the header configuration.",
        "researcher_notes": "Manual verification pending.",
        "ai_analysis": {
            "summary": "Invented AI compromise claim",
            "reproduction_steps": ["Submit a DELETE request to /destroy"],
        },
    }


@pytest.fixture
def evidence():
    return [
        {
            "type": "http",
            "request_metadata": {"method": "GET", "url": "https://example.test/observed"},
            "response_metadata": {"status_code": 200, "headers": {"Server": "fixture"}},
            "redacted_excerpt": "Recorded response excerpt",
            "body_sha256": "abc123",
        }
    ]


@pytest.mark.parametrize("format", ["markdown", "html"])
def test_report_is_deterministic_and_excludes_ai_claims(finding, evidence, format):
    report = generate_report(finding, evidence, format=format)
    assert report == generate_report(finding, evidence, format=format)
    for heading in (
        "Summary",
        "Observed evidence",
        "Impact",
        "Reproduction",
        "Recommendation",
        "References",
        "Researcher notes",
    ):
        assert heading in report
    assert "Invented AI" not in report
    assert "DELETE" not in report
    assert "manual verification" in report
    assert "owasp.org" in report
    assert "cwe.mitre.org" in report


@pytest.mark.parametrize("format", ["markdown", "html"])
def test_all_report_sections_redact_sensitive_values(finding, evidence, format):
    finding.update(
        {
            "title": "token=title-secret",
            "description": "Authorization: Bearer description-secret",
            "recommendation": "password=recommendation-secret",
            "researcher_notes": "api_key=notes-secret",
            "affected_url": "https://example.test/?access_token=url-secret",
            "evidence_summary": "secret=summary-secret",
        }
    )
    evidence[0].update(
        {
            "request_metadata": {
                "method": "GET",
                "url": "https://example.test/?session=request-secret",
                "headers": {
                    "Authorization": "Bearer header-secret",
                    "Cookie": "session=cookie-secret",
                },
            },
            "response_metadata": {"headers": {"Set-Cookie": "session=response-secret"}},
            "redacted_excerpt": 'password="excerpt-secret" Bearer bearer-secret',
        }
    )
    report = generate_report(finding, evidence, format=format)
    for secret in (
        "title-secret",
        "description-secret",
        "recommendation-secret",
        "notes-secret",
        "url-secret",
        "summary-secret",
        "request-secret",
        "header-secret",
        "cookie-secret",
        "response-secret",
        "excerpt-secret",
        "bearer-secret",
    ):
        assert secret not in report
    assert "REDACTED" in report


class _Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        self.links.extend(value for key, value in attrs if key == "href")


def test_html_escapes_all_untrusted_markup(finding, evidence):
    malicious = '<script>alert(1)</script><a href="javascript:alert(2)">click</a><img src=x onerror=alert(3)>'
    finding.update(title=malicious, description=malicious, researcher_notes=malicious)
    evidence[0]["redacted_excerpt"] = malicious
    evidence[0]["request_metadata"]["untrusted"] = malicious
    parser = _Tags()
    report = generate_report(finding, evidence, format="html")
    parser.feed(report)
    assert not {"script", "img"}.intersection(parser.tags)
    assert parser.links == [
        "https://owasp.org/www-project-web-security-testing-guide/",
        "https://cwe.mitre.org/",
    ]
    assert "&lt;script&gt;" in report
    assert '<a href="javascript:' not in report


def test_markdown_escapes_raw_html_links_fences_and_heading_injection(finding, evidence):
    malicious = "\n# heading\n<script>x</script> [click](javascript:alert(1)) ![image](https://evil.test)\n```html\n<img src=x>\n```"
    finding.update(title=malicious, researcher_notes=malicious)
    evidence[0]["redacted_excerpt"] = malicious
    report = generate_report(finding, evidence)
    assert "<script>" not in report
    assert "<img" not in report
    assert "[click](javascript:" not in report
    assert "![image]" not in report
    assert "```" not in report
    assert "\n# heading" not in report
    assert r"\[click\]\(javascript\:alert\(1\)\)" in report
    assert "&lt;script&gt;" in report


@pytest.mark.parametrize("format", ["markdown", "html"])
def test_reproduction_uses_only_observed_get_or_head_requests(finding, evidence, format):
    evidence.extend(
        [
            {"request_metadata": {"method": "HEAD", "url": "https://example.test/head-observed"}},
            {
                "request_metadata": {
                    "method": "POST",
                    "url": "https://example.test/never-repeat-post",
                }
            },
            {"request_metadata": {"url": "https://example.test/method-not-recorded"}},
            {"request_metadata": {"method": "GET", "url": "javascript:alert(1)"}},
        ]
    )
    report = generate_report(finding, evidence, format=format)
    reproduction = re.split(r"(?:## Reproduction|<h2>Reproduction</h2>)", report)[1]
    reproduction = re.split(r"(?:## Recommendation|<h2>Recommendation</h2>)", reproduction)[0]
    assert "recorded GET request" in reproduction
    assert "recorded HEAD request" in reproduction
    for forbidden in (
        "private-unobserved-path",
        "never-repeat-post",
        "method-not-recorded",
        "javascript",
        "destroy",
        "DELETE",
    ):
        assert forbidden not in reproduction


@pytest.mark.parametrize("format", ["markdown", "html"])
def test_no_evidence_produces_no_invented_steps(finding, format):
    report = generate_report(finding, [], format=format)
    assert "No request steps have been inferred" in report
    assert "Step 1" not in report
    assert "Invented AI" not in report


def test_report_accepts_sqlalchemy_objects_without_database(finding, evidence):
    orm_finding = Finding(**finding)
    orm_evidence = Evidence(**evidence[0])
    assert generate_report(orm_finding, [orm_evidence]) == generate_report(finding, evidence)


def test_single_evidence_record_and_invalid_format(finding, evidence):
    assert generate_report(finding, evidence[0]) == generate_report(finding, evidence)
    with pytest.raises(ValueError, match="Report format"):
        generate_report(finding, evidence, format="pdf")


def test_malformed_evidence_url_is_not_a_reproduction_step(finding):
    report = generate_report(
        finding, [{"request_metadata": {"method": "GET", "url": "https://[invalid"}}]
    )
    assert "No request steps have been inferred" in report
