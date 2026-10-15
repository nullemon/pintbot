import pytest

from app.scope.guard import ScopeDenied, ScopeGuard
from app.utils.urls import canonicalize


def rules(private=False):
    result = [
        {"rule_type": "allow_domain", "value": "example.com"},
        {"rule_type": "allow_wildcard", "value": "*.example.com"},
        {"rule_type": "allow_domain", "value": "xn--bcher-kva.example"},
        {"rule_type": "deny_domain", "value": "support.example.com"},
        {"rule_type": "deny_path", "value": "/excluded"},
        {"rule_type": "allow_port", "value": "443"},
        {"rule_type": "allow_port", "value": "80"},
    ]
    if private:
        result.append({"rule_type": "allow_private_network", "value": "true"})
    return result


async def public_dns(host):
    return ["93.184.216.34"]


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/",
        "https://api.example.com/",
        "https://bücher.example/",
        "https://EXAMPLE.COM./x#fragment",
    ],
)
async def test_authorized_domains(url):
    approved = await ScopeGuard(rules(), public_dns).approve(url)
    assert approved.addresses == ("93.184.216.34",)


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com.evil.org/",
        "https://evil-example.com/",
        "https://support.example.com/",
        "https://deep.support.example.com/",
        "https://example.com/excluded/private",
        "https://example.com/%65xcluded/x",
        "https://example.com/a/../excluded/x",
        "https://example.com:8443/",
        "https://example.com@evil.org/",
        "https://user:password@example.com/",
        "file:///etc/passwd",
        "https://example.com/logout",
        "https://example.com/delete/account",
    ],
)
async def test_reject_url(url):
    with pytest.raises(ScopeDenied):
        await ScopeGuard(rules(), public_dns).approve(url)


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "169.254.169.254",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "::1",
        "fe80::1",
        "0.0.0.0",
        "0.1.2.3",
        "::ffff:127.0.0.1",
    ],
)
async def test_dns_internal_blocked(ip):
    async def resolver(host):
        return [ip]

    with pytest.raises(ScopeDenied):
        await ScopeGuard(rules(), resolver).approve("https://example.com/")


@pytest.mark.parametrize("ip", ["127.0.0.1", "169.254.169.254", "::1", "fe80::1", "0.0.0.0"])
async def test_unsafe_even_with_private_optin(ip):
    async def resolver(host):
        return [ip]

    with pytest.raises(ScopeDenied):
        await ScopeGuard(rules(True), resolver).approve("https://example.com/")


async def test_private_optin():
    async def resolver(host):
        return ["10.0.0.1"]

    approved = await ScopeGuard(rules(True), resolver).approve("https://example.com/")
    assert approved.addresses == ("10.0.0.1",)


async def test_localhost_even_explicitly_allowed():
    r = rules(True) + [{"rule_type": "allow_domain", "value": "localhost"}]
    with pytest.raises(ScopeDenied):
        await ScopeGuard(r, public_dns).approve("http://localhost/")


async def test_mixed_dns_answer_rejected():
    async def resolver(host):
        return ["93.184.216.34", "127.0.0.1"]

    with pytest.raises(ScopeDenied):
        await ScopeGuard(rules(), resolver).approve("https://example.com/")


def test_canonical_dedup():
    assert canonicalize("https://Example.COM:443/x?z=2&a=1#frag") == "https://example.com/x?a=1&z=2"
