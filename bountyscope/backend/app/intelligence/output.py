"""Normalize response envelopes without weakening the AI capability schema."""

import json
import re

from pydantic import ValidationError


class InvalidJSON(ValueError):
    pass


def json_object(value: str | dict) -> str:
    """Accept a single object, optionally enclosed in one complete Markdown fence."""
    if isinstance(value, dict):
        value = json.dumps(value, allow_nan=False)
    if not isinstance(value, str):
        raise InvalidJSON()
    value = value.strip()
    fence = re.fullmatch(r"```(?:json)?\s*\n([\s\S]*?)\n```", value, flags=re.I)
    if fence:
        value = fence.group(1).strip()

    def unique_pairs(pairs):
        result = {}
        for key, item in pairs:
            if key in result:
                raise InvalidJSON()
            result[key] = item
        return result

    try:
        parsed = json.loads(
            value,
            object_pairs_hook=unique_pairs,
            parse_constant=lambda _: (_ for _ in ()).throw(InvalidJSON()),
        )
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise InvalidJSON() from exc
    if not isinstance(parsed, dict):
        raise InvalidJSON()
    # Preserve JSON-mode strict validation (including enum handling).
    return value


def schema_error(error: ValidationError, schema: dict) -> str:
    """Only known field names/types leave this boundary, never rejected values."""
    allowed = set()

    def visit(node):
        if isinstance(node, dict):
            allowed.update(node.get("properties", {}).keys())
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(schema)
    failures = []
    for item in error.errors(include_input=False, include_context=False, include_url=False)[:3]:
        path = (
            ".".join(
                str(part) if isinstance(part, int) or part in allowed else "unknown_field"
                for part in item["loc"]
            )
            or "response"
        )
        kind = item["type"] if re.fullmatch(r"[a-z0-9_]{1,60}", item["type"]) else "invalid"
        failures.append(f"{path} ({kind})")
    return "AI output schema mismatch: " + "; ".join(failures)
