import ipaddress
import posixpath
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

import dns.asyncresolver

from app.utils.urls import canonicalize, host_normalize, safe_path


class ScopeDenied(ValueError):
    pass


async def resolve(host: str) -> list[str]:
    try:
        return [str(ipaddress.ip_address(host))]
    except ValueError:
        pass
    addresses = []
    for kind in ("A", "AAAA"):
        try:
            answer = await dns.asyncresolver.resolve(host, kind, lifetime=5, search=False)
            addresses.extend(str(record) for record in answer)
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
            continue
    if not addresses:
        raise ScopeDenied("No DNS addresses found")
    return addresses


@dataclass(frozen=True)
class ApprovedURL:
    url: str
    hostname: str
    port: int
    addresses: tuple[str, ...]


class ScopeGuard:
    """Central scope policy. A transport must pin one of the returned approved IPs."""

    def __init__(self, rules: list[dict], resolver=resolve):
        self.rules = [r for r in rules if r.get("enabled", True)]
        self.resolver = resolver

    def values(self, kind):
        return [r["value"] for r in self.rules if r["rule_type"] == kind]

    def check_url(self, url: str) -> str:
        try:
            normalized = canonicalize(url)
            p = urlsplit(normalized)
            host = p.hostname
            port = p.port or (443 if p.scheme == "https" else 80)
            exact = [host_normalize(v) for v in self.values("allow_domain")]
            wild = [host_normalize(v.removeprefix("*.")) for v in self.values("allow_wildcard")]
            denied = [host_normalize(v.removeprefix("*.")) for v in self.values("deny_domain")]
            if any(host == d or host.endswith("." + d) for d in denied):
                raise ScopeDenied("Explicitly excluded host")
            if host not in exact and not any(host.endswith("." + d) and host != d for d in wild):
                raise ScopeDenied("Hostname is not authorized")
            if port not in [int(v) for v in self.values("allow_port")]:
                raise ScopeDenied("Port is not authorized")
            path = p.path
            for _ in range(10):
                decoded = unquote(path)
                if decoded == path:
                    break
                path = decoded
            else:
                raise ScopeDenied("Excessively encoded path")
            path = "/" + posixpath.normpath(path.replace("\\", "/")).lstrip("/")
            if any(path.startswith(v) for v in self.values("deny_path")):
                raise ScopeDenied("Explicitly excluded path")
            if not safe_path(normalized):
                raise ScopeDenied("Potential state-changing path skipped")
            if host == "localhost" or host.endswith(".localhost"):
                raise ScopeDenied("Localhost is always blocked")
            return normalized
        except (ValueError, UnicodeError) as exc:
            raise ScopeDenied(str(exc)) from exc

    async def approve(self, url: str) -> ApprovedURL:
        normalized = self.check_url(url)
        p = urlsplit(normalized)
        addresses = await self.resolver(p.hostname)
        private_allowed = any(v.lower() == "true" for v in self.values("allow_private_network"))
        for address in addresses:
            ip = ipaddress.ip_address(address)
            if ip.version == 6 and ip.ipv4_mapped:
                ip = ip.ipv4_mapped
            if (
                ip.is_loopback
                or ip.is_link_local
                or ip.is_unspecified
                or ip.is_multicast
                or ip.is_reserved
            ):
                raise ScopeDenied("Unsafe DNS destination")
            if not ip.is_global and not (private_allowed and ip.is_private):
                raise ScopeDenied("Private infrastructure is not authorized")
            if ip.version == 4 and ip in ipaddress.ip_network("0.0.0.0/8"):
                raise ScopeDenied("Zero network is blocked")
        return ApprovedURL(
            normalized, p.hostname, p.port or (443 if p.scheme == "https" else 80), tuple(addresses)
        )
