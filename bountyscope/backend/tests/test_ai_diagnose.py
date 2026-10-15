import httpx

from app.core.config import settings
from app.intelligence.diagnose import diagnose


def configure(monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ai_provider", "anthropic")
    monkeypatch.setattr(settings, "anthropic_api_key", "synthetic-secret-never-print")
    monkeypatch.setattr(settings, "anthropic_model", "configured-test-model")


async def test_no_network_without_test_flag(monkeypatch, capsys):
    configure(monkeypatch)
    assert await diagnose() == 0
    output = capsys.readouterr().out
    assert "API_KEY_PRESENT=True" in output
    assert "synthetic-secret-never-print" not in output


async def test_provider_failure_is_visible_and_redacted(monkeypatch, capsys):
    configure(monkeypatch)

    def reject(request):
        return httpx.Response(
            401,
            json={
                "error": {
                    "type": "authentication_error",
                    "message": "Invalid key synthetic-secret-never-print",
                }
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(reject)) as client:
        assert await diagnose(True, client) == 1
    output = capsys.readouterr().out
    assert "HTTP 401" in output and "authentication_error" in output
    assert "synthetic-secret-never-print" not in output


async def test_provider_success_has_bounded_request(monkeypatch, capsys):
    configure(monkeypatch)

    def accept(request):
        import json

        assert request.url.host == "api.anthropic.com"
        assert json.loads(request.content)["max_tokens"] == 32
        return httpx.Response(200, json={"content": [{"type": "text", "text": "OK"}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(accept)) as client:
        assert await diagnose(True, client) == 0
    assert "SUCCESS" in capsys.readouterr().out
