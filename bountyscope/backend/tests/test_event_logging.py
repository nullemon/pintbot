import json
import logging
from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.core.logging import configure_scan_logging, emit_scan_event


def read_event(capsys):
    output = capsys.readouterr()
    assert output.err == ""
    assert len(output.out.splitlines()) == 1
    return json.loads(output.out)


def test_event_is_one_json_line_even_with_untrusted_control_characters(capsys):
    emit_scan_event(
        "scan-123",
        "request_sent",
        {"hostname": "example.test", "path": "/images/\nFAKE LOG\r\x1b[31m"},
    )
    event = read_event(capsys)
    assert event["scan_id"] == "scan-123"
    assert event["event"] == "request_sent"
    assert event["level"] == "info"
    assert datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")).tzinfo == UTC
    assert event["data"]["path"] == "/images/\nFAKE LOG\r\x1b[31m"


def test_sensitive_fields_strings_and_typed_metadata_are_redacted(capsys):
    provider_key = "sk-ant-api03-" + "Abcdef1234" * 8
    emit_scan_event(
        "scan-123",
        "ai_unavailable",
        {
            "reason": f"Provider refused {provider_key}; Authorization: Bearer secret123",
            "Authorization": "Bearer auth-value",
            "cookie": "session=secret-cookie",
            "url": "https://example.test/?token=query-secret&normal=1",
            "details": [
                {"name": "api_key", "value": "typed-key-secret"},
                {"field": "password", "value": "typed-password-secret"},
                {"key": "cookie", "values": ["typed-cookie-secret"]},
                {"name": "status", "value": 400},
            ],
        },
    )
    event = read_event(capsys)
    serialized = json.dumps(event)
    for secret in (
        provider_key,
        "secret123",
        "auth-value",
        "secret-cookie",
        "query-secret",
        "typed-key-secret",
        "typed-password-secret",
        "typed-cookie-secret",
    ):
        assert secret not in serialized
    assert "[REDACTED]" in serialized
    assert event["data"]["details"][-1] == {"name": "status", "value": 400}


def test_raw_content_prompts_and_headers_are_never_logged(capsys):
    emit_scan_event(
        "scan-123",
        "ai_action_executed",
        {
            "body": "target raw body",
            "request_metadata": {
                "request_headers": {"X-Custom": "opaque-credential"},
                "response_body": "nested response body",
                "method": "GET",
            },
            "system_prompt": "private system instructions",
            "prompt": "untrusted website commands",
            "messages": [{"content": "model input"}],
            "status": 200,
        },
    )
    event = read_event(capsys)
    serialized = json.dumps(event)
    for forbidden in (
        "target raw body",
        "opaque-credential",
        "nested response body",
        "private system instructions",
        "untrusted website commands",
        "model input",
    ):
        assert forbidden not in serialized
    assert event["data"]["status"] == 200
    assert event["data"]["request_metadata"]["method"] == "GET"


@pytest.mark.parametrize(
    ("kind", "data", "level"),
    [
        ("scanner_error", {"scanner": "directory", "error_type": "TimeoutError"}, "error"),
        ("request_error", {}, "error"),
        ("ai_unavailable", {"reason": "output invalid"}, "error"),
        ("ai_review_failed", {}, "error"),
        ("stage_changed", {"status": "failed"}, "error"),
        ("redirect_blocked", {}, "warning"),
        ("ai_action_denied", {}, "warning"),
        ("rate_limit_triggered", {}, "warning"),
        ("budget_exhausted", {}, "warning"),
        ("finding_created", {}, "info"),
        ("ai_batch_started", {"round": 1}, "info"),
    ],
)
def test_event_levels(capsys, kind, data, level):
    emit_scan_event("scan-123", kind, data)
    assert read_event(capsys)["level"] == level


def test_repeated_initialization_does_not_duplicate_handlers_or_use_root_level(capsys):
    root = logging.getLogger()
    previous_level = root.level
    try:
        root.setLevel(logging.WARNING)
        first = configure_scan_logging()
        assert configure_scan_logging() is first
        emit_scan_event("scan-123", "stage_changed", {"status": "crawling"})
        assert read_event(capsys)["level"] == "info"
        assert not first.propagate
        assert sum(getattr(h, "_bountyscope_scan_events", False) for h in first.handlers) == 1
    finally:
        root.setLevel(previous_level)


def test_noisy_and_unknown_events_are_skipped(capsys):
    emit_scan_event("scan-123", "scope_check", {"allowed": True})
    emit_scan_event("scan-123", "ai_progress", {"status": "waiting"})
    emit_scan_event("scan-123", "unknown", {})
    assert capsys.readouterr().out == ""


def test_bounded_serializable_metadata_never_stringifies_unknown_objects(capsys):
    class UnsafeObject:
        def __str__(self):
            return "DO NOT PRINT SECRET OBJECT"

    emit_scan_event(
        "scan-123",
        "response_received",
        {
            "status": 200,
            "items": list(range(100)),
            "date": datetime(2026, 1, 1, tzinfo=UTC),
            "id": UUID(int=0),
            "unsafe": UnsafeObject(),
            "bytes": b"opaque secret",
            "not_a_number": float("nan"),
        },
    )
    event = read_event(capsys)
    assert len(event["data"]["items"]) == 40
    assert event["data"]["id"] == str(UUID(int=0))
    assert event["data"]["date"] == "2026-01-01T00:00:00+00:00"
    assert event["data"]["unsafe"] == "[OMITTED]"
    assert event["data"]["bytes"] == "[OMITTED]"
    assert event["data"]["not_a_number"] is None
