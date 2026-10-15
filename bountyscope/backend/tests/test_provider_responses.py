"""Exercise real provider response parsing without external API calls or credentials."""

import json

import httpx
import pytest

from app.intelligence.providers import (
    AnthropicProvider,
    OpenAIProvider,
    ProviderUnavailable,
)
from app.intelligence.schemas import FindingAnalysis, SafeTool

API_KEY = "synthetic-provider-key-never-print"
PRIVATE_VALUE = "untrusted-response-value-never-print"
FINDING = {"id": "finding-1", "severity": "low", "confidence": 80}
ANALYSIS = {
    "explanation": "A directory index was observed.",
    "business_impact": "Listed filenames may require review in the application's context.",
    "false_positive_likelihood": "unknown",
    "false_positive_reasoning": "Public assets may be intentionally indexed.",
    "recommended_verification": ["Review the recorded index evidence."],
    "confidence_adjustment": 0,
}
PLAN = {
    "checks": [
        {
            "tool": "check_directory",
            "url": "https://example.test/uploads/",
            "reason": "An observed media URL has this parent directory.",
        }
    ]
}


def anthropic_result(value, *, name="submit_result", stop_reason="tool_use"):
    return {
        "stop_reason": stop_reason,
        "content": [{"type": "tool_use", "id": "result-1", "name": name, "input": value}],
    }


def anthropic_provider(payload, *, status_code=200, captured=None):
    def respond(request):
        if captured is not None:
            captured.append(request)
        return httpx.Response(status_code, json=payload)

    return AnthropicProvider(API_KEY, "configured-model", transport=httpx.MockTransport(respond))


async def test_anthropic_forces_narrow_output_tool_and_accepts_native_result():
    captured = []
    provider = anthropic_provider(anthropic_result(ANALYSIS), captured=captured)
    result = await provider.analyze_finding(FINDING, [])
    assert isinstance(result, FindingAnalysis)
    assert result.explanation == ANALYSIS["explanation"]
    request = captured[0]
    payload = json.loads(request.content)
    assert str(request.url) == "https://api.anthropic.com/v1/messages"
    assert payload["tool_choice"] == {"type": "tool", "name": "submit_result"}
    assert len(payload["tools"]) == 1
    tool = payload["tools"][0]
    assert tool["name"] == "submit_result"
    assert tool["input_schema"]["additionalProperties"] is False
    assert "explanation" in tool["input_schema"]["properties"]
    assert "temperature" not in payload
    assert 0 < payload["max_tokens"] <= 8192
    assert 30 < request.extensions["timeout"]["read"] <= 120


async def test_anthropic_native_plan_preserves_enum_and_bounded_list():
    checks = await anthropic_provider(anthropic_result(PLAN)).suggest_safe_next_checks([])
    assert len(checks) == 1
    assert checks[0].tool is SafeTool.CHECK_DIRECTORY
    assert checks[0].url == "https://example.test/uploads/"


@pytest.mark.parametrize("fenced", [False, True])
async def test_anthropic_accepts_json_text_fallback_with_optional_single_fence(fenced):
    text = json.dumps(PLAN)
    if fenced:
        text = "```json\n" + text + "\n```"
    provider = anthropic_provider(
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": text}]}
    )
    checks = await provider.suggest_safe_next_checks([])
    assert len(checks) == 1 and checks[0].tool is SafeTool.CHECK_DIRECTORY


@pytest.mark.parametrize(
    "bad_text",
    [
        "not JSON " + PRIVATE_VALUE,
        '{"checks":[]}\n' + PRIVATE_VALUE,
        '{"checks":[]}\n{"checks":[]}',
        '```json\n{"checks":[]}\n```\n' + PRIVATE_VALUE,
    ],
)
async def test_malformed_json_never_echoes_untrusted_content(bad_text):
    provider = anthropic_provider(
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": bad_text}]}
    )
    with pytest.raises(ProviderUnavailable, match="AI output was not valid JSON") as caught:
        await provider.suggest_safe_next_checks([])
    assert PRIVATE_VALUE not in str(caught.value)


@pytest.mark.parametrize(
    ("value", "field"),
    [
        ({"checks": [{"tool": "shell", "url": "https://example.test/"}]}, "tool"),
        ({"checks": [{"tool": "check_directory", "url": 42}]}, "url"),
        (
            {
                "checks": [
                    {
                        "tool": "check_directory",
                        "url": "https://example.test/",
                        "method": PRIVATE_VALUE,
                    }
                ]
            },
            None,
        ),
        ({"checks": PRIVATE_VALUE}, "checks"),
    ],
)
async def test_native_results_still_enforce_strict_schema_and_capabilities(value, field):
    provider = anthropic_provider(anthropic_result(value))
    with pytest.raises(ProviderUnavailable, match="AI output schema mismatch") as caught:
        await provider.suggest_safe_next_checks([])
    message = str(caught.value)
    if field:
        assert field in message
    assert PRIVATE_VALUE not in message
    assert API_KEY not in message


async def test_schema_error_does_not_leak_unknown_field_name_or_input_value():
    provider = anthropic_provider(
        anthropic_result({**PLAN, PRIVATE_VALUE: "also-private-never-print"})
    )
    with pytest.raises(ProviderUnavailable, match="AI output schema mismatch") as caught:
        await provider.suggest_safe_next_checks([])
    assert PRIVATE_VALUE not in str(caught.value)
    assert "also-private-never-print" not in str(caught.value)


async def test_native_plan_rejects_more_than_twenty_actions():
    provider = anthropic_provider(anthropic_result({"checks": PLAN["checks"] * 21}))
    with pytest.raises(ProviderUnavailable, match="AI output schema mismatch"):
        await provider.suggest_safe_next_checks([])


@pytest.mark.parametrize("first_failure", ["json", "schema"])
async def test_one_bounded_repair_uses_no_raw_invalid_response(first_failure):
    captured = []

    def respond(request):
        captured.append(request)
        if len(captured) == 1:
            if first_failure == "json":
                payload = {
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": PRIVATE_VALUE}],
                }
            else:
                payload = anthropic_result({"checks": PRIVATE_VALUE})
        else:
            payload = anthropic_result(PLAN)
        return httpx.Response(200, json=payload)

    provider = AnthropicProvider(
        API_KEY, "configured-model", transport=httpx.MockTransport(respond)
    )
    result = await provider.suggest_safe_next_checks([])
    assert len(captured) == 2
    assert result[0].tool is SafeTool.CHECK_DIRECTORY
    assert PRIVATE_VALUE not in captured[1].content.decode()


async def test_persistent_invalid_output_exhausts_one_repair_and_fails_closed():
    captured = []
    provider = anthropic_provider(anthropic_result({"checks": PRIVATE_VALUE}), captured=captured)
    with pytest.raises(ProviderUnavailable, match="AI output schema mismatch"):
        await provider.suggest_safe_next_checks([])
    assert len(captured) == 2


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        (
            {"stop_reason": "max_tokens", "content": [{"type": "text", "text": "{"}]},
            "AI output was truncated",
        ),
        (
            {"stop_reason": "refusal", "content": [{"type": "text", "text": PRIVATE_VALUE}]},
            "AI provider refused",
        ),
        ({"stop_reason": "end_turn", "content": []}, "AI provider returned no structured result"),
        ({"content": []}, "AI provider returned no structured result"),
        (
            anthropic_result(PLAN, name="shell"),
            "AI provider returned an unexpected response tool",
        ),
    ],
)
async def test_anthropic_stop_reasons_and_missing_result_have_specific_errors(payload, expected):
    with pytest.raises(ProviderUnavailable, match=expected) as caught:
        await anthropic_provider(payload).suggest_safe_next_checks([])
    assert PRIVATE_VALUE not in str(caught.value)
    assert API_KEY not in str(caught.value)


async def test_timeout_is_distinguished_without_leaking_request_content():
    def timeout(request):
        raise httpx.ReadTimeout(PRIVATE_VALUE + " " + API_KEY, request=request)

    provider = AnthropicProvider(
        API_KEY, "configured-model", transport=httpx.MockTransport(timeout)
    )
    with pytest.raises(ProviderUnavailable, match="AI provider timed out") as caught:
        await provider.suggest_safe_next_checks([])
    assert PRIVATE_VALUE not in str(caught.value)
    assert API_KEY not in str(caught.value)


async def test_http_error_retains_status_and_redacts_provider_key():
    provider = anthropic_provider(
        {"error": {"type": "authentication_error", "message": "Invalid key " + API_KEY}},
        status_code=401,
    )
    with pytest.raises(ProviderUnavailable, match="HTTP 401") as caught:
        await provider.suggest_safe_next_checks([])
    assert API_KEY not in str(caught.value)


@pytest.mark.parametrize(
    ("provider_type", "payload"),
    [
        (AnthropicProvider, []),
        (AnthropicProvider, None),
        (AnthropicProvider, {"content": PRIVATE_VALUE}),
        (OpenAIProvider, []),
        (OpenAIProvider, {"choices": []}),
        (OpenAIProvider, {"choices": [None]}),
        (OpenAIProvider, {"choices": [{"message": None}]}),
    ],
)
async def test_malformed_envelopes_raise_sanitized_provider_error(provider_type, payload):
    def respond(request):
        return httpx.Response(200, content=json.dumps(payload).encode())

    provider = provider_type(API_KEY, "configured-model", transport=httpx.MockTransport(respond))
    with pytest.raises(ProviderUnavailable) as caught:
        await provider.suggest_safe_next_checks([])
    assert API_KEY not in str(caught.value)
    assert PRIVATE_VALUE not in str(caught.value)


@pytest.mark.parametrize(
    ("finish_reason", "expected"),
    [("length", "AI output was truncated"), ("content_filter", "AI provider refused")],
)
async def test_openai_non_success_finish_reason_is_not_parsed_as_valid_json(
    finish_reason, expected
):
    def respond(request):
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"finish_reason": finish_reason, "message": {"content": json.dumps(PLAN)}}
                ]
            },
        )

    provider = OpenAIProvider(API_KEY, "configured-model", transport=httpx.MockTransport(respond))
    with pytest.raises(ProviderUnavailable, match=expected):
        await provider.suggest_safe_next_checks([])
