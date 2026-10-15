"""Redacted, single-line scan diagnostics independent of Celery's root log level."""

import json
import logging
import sys
import threading
from collections.abc import Mapping
from datetime import UTC, date, datetime
from enum import Enum
from uuid import UUID

from app.utils.redaction import SENSITIVE, redact, sanitize

_LOGGER_NAME = "bountyscope.scan_events"
_CONFIG_LOCK = threading.RLock()
_EVENTS = frozenset(
    {
        "stage_changed",
        "scan_completed",
        "autopilot_reports_created",
        "scan_cancelled",
        "scanner_error",
        "request_sent",
        "response_received",
        "request_error",
        "redirect_blocked",
        "discovered_out_of_scope",
        "rate_limit_triggered",
        "budget_exhausted",
        "exposure_directory_candidates",
        "finding_created",
        "finding_observed",
    }
)
_OMITTED = "[OMITTED]"
_RAW_FIELDS = frozenset(
    {
        "body",
        "bodies",
        "raw",
        "html",
        "content",
        "payload",
        "prompt",
        "prompts",
        "messages",
        "headers",
        "requestheaders",
        "responseheaders",
        "requestbody",
        "responsebody",
        "rawbody",
        "rawresponse",
        "rawrequest",
        "systemprompt",
        "userprompt",
        "excerpt",
        "redactedexcerpt",
        "snippet",
    }
)


def _metadata(value, depth: int = 0):
    """Keep bounded JSON metadata; never stringify arbitrary response objects."""
    if depth > 6:
        return _OMITTED
    if isinstance(value, Mapping):
        descriptors = (value.get(k) for k in ("name", "field", "key", "header", "type"))
        sensitive_value = any(
            isinstance(item, str) and SENSITIVE.search(item) for item in descriptors
        )
        result = {}
        for raw_key, item in list(value.items())[:40]:
            if not isinstance(raw_key, str | int | float | bool):
                continue
            key = redact(str(raw_key))[:128]
            normalized = key.lower().replace("_", "").replace("-", "").replace(" ", "")
            if normalized in _RAW_FIELDS:
                result[key] = _OMITTED
            elif sensitive_value and normalized in {"value", "values", "text", "data"}:
                result[key] = "[REDACTED]"
            else:
                result[key] = _metadata(item, depth + 1)
        return result
    if isinstance(value, list | tuple | set | frozenset):
        return [_metadata(item, depth + 1) for item in list(value)[:40]]
    if isinstance(value, Enum):
        return _metadata(value.value, depth + 1)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, str | int | float | bool) or value is None:
        return value
    return _OMITTED


def _clip(value):
    if isinstance(value, dict):
        return {key: _clip(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clip(item) for item in value]
    if isinstance(value, str):
        return value[:2048]
    if isinstance(value, float) and (value != value or abs(value) == float("inf")):
        return None
    return value


class _EventFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        # JSON escaping keeps newline/terminal-control characters inside one record.
        return json.dumps(record.scan_event, ensure_ascii=True, allow_nan=False)


def configure_scan_logging() -> logging.Logger:
    """Create one stdout handler even when root/Celery is configured at WARNING."""
    with _CONFIG_LOCK:
        logger = logging.getLogger(_LOGGER_NAME)
        logger.setLevel(logging.INFO)
        logger.propagate = False
        logger.disabled = False
        handler = next(
            (h for h in logger.handlers if getattr(h, "_bountyscope_scan_events", False)), None
        )
        if handler is None:
            handler = logging.StreamHandler(sys.stdout)
            handler._bountyscope_scan_events = True
            handler.setFormatter(_EventFormatter())
            handler.setLevel(logging.INFO)
            logger.addHandler(handler)
        else:
            # Bind current stdout for command/test capture without flushing a stale stream.
            handler.stream = sys.stdout
        return logger


def _level(kind: str, data) -> int:
    state = str(data.get("status", data.get("stage", ""))) if isinstance(data, dict) else ""
    if kind.endswith(("_error", "_failed")) or kind == "ai_unavailable" or state == "failed":
        return logging.ERROR
    if (
        kind.endswith(("_denied", "_blocked", "_fallback", "_refused", "_retry"))
        or kind
        in {
            "discovered_out_of_scope",
            "rate_limit_triggered",
            "budget_exhausted",
            "scan_cancelled",
        }
        or state == "cancelled"
    ):
        return logging.WARNING
    return logging.INFO


def emit_scan_event(scan_id: str, kind: str, data) -> None:
    """Mirror useful persisted events to Docker logs without raw target/provider data."""
    if kind == "ai_progress" or not (kind in _EVENTS or kind.startswith("ai_")):
        return
    safe_data = _clip(sanitize(_metadata(data)))
    level = _level(kind, safe_data)
    payload = {
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "scan_id": sanitize(str(scan_id))[:128],
        "event": kind,
        "level": logging.getLevelName(level).lower(),
        "data": safe_data,
    }
    configure_scan_logging().log(level, "", extra={"scan_event": payload})
