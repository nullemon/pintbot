import pytest

from app.utils.redaction import clean_url, redact, sanitize


@pytest.mark.parametrize(
    "secret",
    [
        "sk-proj-" + "Abc123" * 8,
        "ghp_" + "a" * 36,
        "AKIA" + "A" * 16,
        "sk-ant-api03-" + "abcdef12345" * 8,
        "xoxb-1234567890-1234567890-AbCdEf",
    ],
)
def test_standalone_provider_tokens_removed(secret):
    assert secret not in redact("Found filename: " + secret + ".txt")


def test_structured_headers_urls_and_partial_private_keys():
    data = sanitize(
        {
            "Authorization": "Bearer longsecret",
            "Set-Cookie": "session=value",
            "url": "https://user:password@example.com/path?api_key=secret&x=1",
        }
    )
    assert "longsecret" not in str(data) and "session=value" not in str(data)
    assert "user:password" not in str(data) and "api_key=secret" not in str(data)
    assert redact("-----BEGIN PRIVATE KEY-----\\nsensitivepartial") == "[REDACTED]"
    assert sanitize("http://[") == "http://["
    assert "@" not in clean_url("https://user:password@example.com/")


def test_common_query_credentials_are_redacted():
    for name in ("key", "access_key", "code", "sig", "access_token"):
        assert "do-not-retain" not in clean_url(
            f"https://example.com/callback?{name}=do-not-retain"
        )
