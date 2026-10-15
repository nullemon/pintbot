"""Explicit provider connectivity check. Never sends target data or prints credentials."""

import argparse
import asyncio

import httpx

from app.core.config import settings
from app.utils.redaction import redact


def safe_error(response, key):
    try:
        error = response.json().get("error", {})
        message = str(error.get("message", "Provider rejected the request"))
        kind = str(error.get("type", "unknown"))
    except (ValueError, AttributeError):
        kind, message = "unknown", "Provider returned a non-JSON error"
    if key:
        message = message.replace(key, "[REDACTED]")
        kind = kind.replace(key, "[REDACTED]")
    return f"HTTP {response.status_code}: {redact(kind)}: {redact(message)[:400]}"


async def diagnose(test=False, client=None):
    print(f"AI_ENABLED={settings.ai_enabled}")
    print(f"AI_PROVIDER={settings.ai_provider}")
    key, model = (
        (settings.anthropic_api_key, settings.anthropic_model)
        if settings.ai_provider == "anthropic"
        else (settings.openai_api_key, settings.openai_model)
    )
    print(f"API_KEY_PRESENT={bool(key)}")
    print(f"MODEL={redact(model) if model else '(missing)'}")
    if not settings.ai_enabled or not key or not model:
        print(
            "NOT READY: enable AI and configure the selected provider's key and model in .env; recreate api and worker."
        )
        return 1
    if not test:
        print(
            "Configuration present. Add --test to send one short provider request (billable API usage)."
        )
        return 0
    owned = client is None
    client = client or httpx.AsyncClient(timeout=30, follow_redirects=False)
    try:
        if settings.ai_provider == "anthropic":
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": key, "anthropic-version": "2023-06-01"},
                json={
                    "model": model,
                    "max_tokens": 32,
                    "temperature": 0,
                    "messages": [{"role": "user", "content": "Reply with the word OK."}],
                },
            )
        elif settings.ai_provider == "openai":
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json={
                    "model": model,
                    "max_completion_tokens": 32,
                    "temperature": 0,
                    "messages": [{"role": "user", "content": "Reply with the word OK."}],
                },
            )
        else:
            print("NOT READY: AI_PROVIDER must be anthropic or openai.")
            return 1
        if not response.is_success:
            print(safe_error(response, key))
            return 1
        print("SUCCESS: provider accepted the configured key, model and request options.")
        print(
            "Now open a finding and click Analyze with AI; new scans analyze findings after scanning."
        )
        return 0
    except httpx.HTTPError as exc:
        print(
            f"NETWORK ERROR: {type(exc).__name__}. Check Internet/proxy connectivity from this container."
        )
        return 1
    finally:
        if owned:
            await client.aclose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--test", action="store_true", help="Send one short billable provider request"
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(diagnose(args.test)))


if __name__ == "__main__":
    main()
