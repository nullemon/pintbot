import httpx
import pytest
from sqlalchemy import select
from test_scope import public_dns, rules

from app.core.database import SessionLocal
from app.core.http import BudgetExceeded, SafeHTTPClient, ScanCancelled
from app.models import Project, Scan, ScanEvent
from app.scope.guard import ScopeDenied, ScopeGuard


class FakeResponse:
    def __init__(self, status=200, headers=None, body=b"hello"):
        self.status_code = status
        self.headers = httpx.Headers(headers or {"content-type": "text/plain"})
        self.extensions = {}
        self.body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    async def aiter_raw(self, chunk_size=8192):
        for start in range(0, len(self.body), chunk_size):
            yield self.body[start : start + chunk_size]


class FakeClient:
    calls = []
    responses = []

    def __init__(self, **kwargs):
        assert kwargs["trust_env"] is False
        assert kwargs["follow_redirects"] is False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass

    def stream(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return self.responses.pop(0)


class NoWait:
    def __init__(self):
        import asyncio
        from collections import defaultdict

        self.global_slots = asyncio.Semaphore(10)
        self.host_slots = defaultdict(lambda: asyncio.Semaphore(3))
        self.penalty = defaultdict(lambda: 1)

    async def pace(self, *args):
        pass

    def feedback(self, *args):
        pass


@pytest.fixture
def client(monkeypatch):
    FakeClient.calls = []
    FakeClient.responses = []
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    with SessionLocal() as db:
        p = Project(name="test", authorization_confirmed=True)
        db.add(p)
        db.flush()
        scan = Scan(project_id=p.id, target="https://example.com", status="scanning")
        db.add(scan)
        db.commit()
        scan_id = scan.id
    return SafeHTTPClient(
        scan_id, ScopeGuard(rules(), public_dns), {"request_budget": 2, "max_rps": 2}, NoWait()
    )


async def test_pinned_ip_sni_host_and_body_cap(client):
    FakeClient.responses = [FakeResponse(body=b"abcdef")]
    response = await client.get("https://example.com/path", max_bytes=3)
    assert response.body == b"abc" and response.truncated
    method, url, kwargs = FakeClient.calls[0]
    assert url == "https://93.184.216.34:443/path"
    assert kwargs["headers"]["Host"] == "example.com"
    assert kwargs["extensions"]["sni_hostname"] == "example.com"
    with SessionLocal() as db:
        assert db.get(Scan, client.scan_id).requests_sent == 1
        assert db.scalars(select(ScanEvent).where(ScanEvent.kind == "request_sent")).first()


async def test_redirect_outside_scope_never_requested(client):
    FakeClient.responses = [FakeResponse(302, {"location": "https://evil.org/"})]
    with pytest.raises(ScopeDenied):
        await client.get("https://example.com/")
    assert len(FakeClient.calls) == 1


async def test_rebinding_redirect_validated_before_connect(client):
    addresses = iter([["93.184.216.34"], ["127.0.0.1"]])

    async def rebound(host):
        return next(addresses)

    client.guard.resolver = rebound
    FakeClient.responses = [FakeResponse(302, {"location": "/next"})]
    with pytest.raises(ScopeDenied):
        await client.get("https://example.com/")
    assert len(FakeClient.calls) == 1


async def test_shared_budget_all_methods(client):
    FakeClient.responses = [FakeResponse(), FakeResponse()]
    await client.head("https://example.com/a")
    await client.options("https://example.com/b")
    with pytest.raises(BudgetExceeded):
        await client.get("https://example.com/c")
    assert len(FakeClient.calls) == 2


async def test_cancellation_admission(client):
    with SessionLocal() as db:
        scan = db.get(Scan, client.scan_id)
        scan.cancel_requested = True
        db.commit()
    with pytest.raises(ScanCancelled):
        await client.get("https://example.com/")
    assert FakeClient.calls == []


async def test_cache_preserves_budget(client):
    FakeClient.responses = [FakeResponse()]
    a = await client.get("https://example.com/")
    b = await client.get("https://example.com/")
    assert a is b and len(FakeClient.calls) == 1


async def test_non_get_and_auth_headers_rejected(client):
    with pytest.raises(ScopeDenied):
        await client.request("POST", "https://example.com/")
    with pytest.raises(ScopeDenied):
        await client.get("https://example.com/", headers={"Authorization": "secret"})


@pytest.mark.parametrize(
    "path", ["/movie.mov", "/audio.flac", "/photo.avif", "/archive.zip", "/database.sql"]
)
async def test_artifact_get_downgraded_to_metadata_only(client, path):
    FakeClient.responses = [FakeResponse(body=b"must not retain file content")]
    page = await client.get("https://example.com" + path)
    assert FakeClient.calls[0][0] == "HEAD" and page.body == b""


async def test_multiply_encoded_environment_sample_is_minimized(client):
    FakeClient.responses = [FakeResponse(body=b"x" * 2000)]
    page = await client.get("https://example.com/%252eenv", max_bytes=2000)
    assert len(page.body) == 512


async def test_extensionless_media_and_map_body_never_read(client):
    FakeClient.responses = [FakeResponse(headers={"content-type": "image/jpeg"}, body=b"x" * 2000)]
    page = await client.get("https://example.com/image?id=1")
    assert page.body == b"" and page.truncated
    client.metadata_only_urls.add("https://example.com/debug/map")
    FakeClient.responses = [FakeResponse(body=b"x" * 2000)]
    page = await client.get("https://example.com/debug/map")
    assert FakeClient.calls[-1][0] == "HEAD" and page.body == b""


async def test_credential_query_redirect_is_not_requested(client):
    FakeClient.responses = [FakeResponse(302, {"location": "/callback?access_token=do-not-use"})]
    with pytest.raises(ScopeDenied):
        await client.get("https://example.com/")
    assert len(FakeClient.calls) == 1


async def test_host_pacing_shared_between_scans(monkeypatch):
    from app.core.http import RateLimiter

    elapsed = [1000000.0]

    async def advance(delay):
        elapsed[0] += delay

    monkeypatch.setattr("app.core.http.time.monotonic", lambda: elapsed[0])
    monkeypatch.setattr("app.core.http.asyncio.sleep", advance)
    first = RateLimiter()
    second = RateLimiter()
    first.next_at.pop("pacing.example", None)
    first.penalty.pop("pacing.example", None)
    await first.pace("pacing.example", 2)
    await second.pace("pacing.example", 2)
    assert elapsed[0] == 1000000.5
    first.next_at.pop("pacing.example", None)
