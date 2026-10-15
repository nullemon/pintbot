import asyncio
import time
from collections import OrderedDict, defaultdict
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx
from sqlalchemy import update

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Project, Scan, ScanEvent, now
from app.scope.guard import ScopeDenied, ScopeGuard
from app.utils.redaction import clean_url, sanitize
from app.utils.urls import decoded_path, metadata_only


class ScanCancelled(Exception):
    pass


class BudgetExceeded(Exception):
    pass


# Deployment has one execution slot. Keep pacing/backoff across scan event loops.
_HOST_NEXT_AT = defaultdict(float)
_HOST_PENALTY = defaultdict(lambda: 1.0)


class RateLimiter:
    """Conservative per-host pacing. Deployment uses one worker execution slot.

    The shared instance also bounds total and per-host concurrent requests.
    """

    def __init__(self):
        self.global_slots = asyncio.Semaphore(10)
        self.host_slots = defaultdict(lambda: asyncio.Semaphore(3))
        self.locks = defaultdict(asyncio.Lock)
        self.next_at = _HOST_NEXT_AT
        self.penalty = _HOST_PENALTY

    async def pace(self, host, rps):
        async with self.locks[host]:
            delay = self.next_at[host] - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            self.next_at[host] = time.monotonic() + self.penalty[host] / rps

    def feedback(self, host, bad):
        self.penalty[host] = (
            min(32, self.penalty[host] * 2) if bad else max(1, self.penalty[host] * 0.9)
        )


class SafeHTTPClient:
    """The sole target HTTP transport. Resolve, validate and pin IP on every hop.

    Proxy inheritance is disabled: proxies could re-resolve a hostname after validation.
    TLS retains the original SNI/Host and certificate verification against the hostname.
    """

    def __init__(self, scan_id: str, guard: ScopeGuard, limits: dict, limiter=None):
        self.scan_id = scan_id
        self.guard = guard
        self.limits = limits
        self.limiter = limiter or RateLimiter()
        self.scanner = "recon"
        self.responses = OrderedDict()
        self.metadata_only_urls = set()

    def event(self, kind, data):
        with SessionLocal() as db:
            db.add(ScanEvent(scan_id=self.scan_id, kind=kind, data=sanitize(data)))
            db.commit()

    def check_cancelled(self):
        with SessionLocal() as db:
            scan = db.get(Scan, self.scan_id)
            if scan and not db.get(Project, scan.project_id).authorization_confirmed:
                scan.cancel_requested = True
                scan.status = "cancelled"
                scan.finished_at = now()
                db.commit()
            if not scan or scan.cancel_requested or scan.status in ("cancelled", "failed"):
                raise ScanCancelled()

    def admit(self):
        # Atomic budget admission also checks cancellation; cancellation uses the same row.
        with SessionLocal() as db:
            result = db.execute(
                update(Scan)
                .where(
                    Scan.id == self.scan_id,
                    Scan.cancel_requested.is_(False),
                    Scan.requests_sent < self.limits["request_budget"],
                    Scan.status.not_in(["cancelled", "failed", "complete"]),
                )
                .values(requests_sent=Scan.requests_sent + 1)
            )
            db.commit()
            if result.rowcount != 1:
                self.check_cancelled()
                raise BudgetExceeded("Scan request budget exhausted")

    async def get(self, url, **kwargs):
        return await self.request("GET", url, **kwargs)

    async def head(self, url, **kwargs):
        return await self.request("HEAD", url, **kwargs)

    async def options(self, url, **kwargs):
        return await self.request("OPTIONS", url, **kwargs)

    async def request(
        self, method, url, headers=None, max_bytes=2 * 1024 * 1024, follow_redirects=True
    ):
        from app.scanners.base import Page

        if method not in {"GET", "HEAD", "OPTIONS"}:
            raise ScopeDenied("Only non-destructive HTTP methods are supported")
        max_bytes = max(0, min(int(max_bytes), 2 * 1024 * 1024))
        if headers and any(k.lower() not in {"origin", "accept"} for k in headers):
            raise ScopeDenied("Request headers are restricted")
        key = (method, url, tuple(sorted((headers or {}).items())), max_bytes, follow_redirects)
        self.check_cancelled()
        if key in self.responses:
            return self.responses[key]
        redirects = []
        for hop in range(6):
            self.check_cancelled()
            try:
                approved = await self.guard.approve(url)
                if clean_url(approved.url) != approved.url:
                    raise ScopeDenied("Credential-bearing target URL is blocked")
            except ScopeDenied as exc:
                self.event(
                    "redirect_blocked" if hop else "discovered_out_of_scope",
                    {"url": url, "reason": str(exc)},
                )
                raise
            # Enforce evidence minimization for ALL modules, including AI proposals.
            import re

            path = decoded_path(approved.url)
            if metadata_only(approved.url) or approved.url in self.metadata_only_urls:
                method, max_bytes = "HEAD", 0
            elif re.search(
                r"(?:^|/)\.env(?:[./_-]|$)|\.(?:log|bak|ini|conf|config|yaml|yml)$|/\.git/head$",
                path,
            ):
                max_bytes = min(max_bytes, 512)
            self.event("scope_check", {"url": approved.url, "allowed": True})
            host = approved.hostname
            async with self.limiter.global_slots, self.limiter.host_slots[host]:
                await self.limiter.pace(host, self.limits["max_rps"])
                self.check_cancelled()
                p = urlsplit(approved.url)
                ip = approved.addresses[0]
                ip_host = f"[{ip}]" if ":" in ip else ip
                pinned_url = urlunsplit(
                    (p.scheme, f"{ip_host}:{approved.port}", p.path, p.query, "")
                )
                authority = p.netloc
                self.admit()
                self.event(
                    "request_sent",
                    {
                        "hostname": host,
                        "method": method,
                        "path": clean_url(approved.url),
                        "scanner": self.scanner,
                    },
                )
                try:
                    async with (
                        asyncio.timeout(20),
                        httpx.AsyncClient(
                            timeout=httpx.Timeout(12, connect=5),
                            trust_env=False,
                            follow_redirects=False,
                        ) as client,
                    ):
                        async with client.stream(
                            method,
                            pinned_url,
                            headers={
                                "Host": authority,
                                "User-Agent": settings.user_agent,
                                "Accept-Encoding": "identity",
                                **(headers or {}),
                            },
                            extensions={"sni_hostname": host},
                        ) as response:
                            tls = {}
                            stream = response.extensions.get("network_stream")
                            ssl_obj = stream.get_extra_info("ssl_object") if stream else None
                            if ssl_obj:
                                cert = ssl_obj.getpeercert()
                                tls = {
                                    "verified": True,
                                    "protocol": ssl_obj.version(),
                                    "cipher": ssl_obj.cipher()[0],
                                    "not_after": cert.get("notAfter"),
                                    "not_before": cert.get("notBefore"),
                                    "san": [
                                        v for k, v in cert.get("subjectAltName", []) if k == "DNS"
                                    ],
                                }
                            status = response.status_code
                            self.limiter.feedback(host, status in (429, 503))
                            if status in (429, 503):
                                self.event(
                                    "rate_limit_triggered",
                                    {
                                        "hostname": host,
                                        "status": status,
                                        "backoff": self.limiter.penalty[host],
                                    },
                                )
                            body = bytearray()
                            truncated = False
                            # Raw bytes prevent compressed-content expansion attacks. Ask for identity;
                            # if a server ignores it, skip compressed bodies rather than decompressing.
                            if response.headers.get("content-encoding", "identity") not in (
                                "",
                                "identity",
                            ):
                                truncated = True
                            elif (
                                response.headers.get("content-type", "")
                                .lower()
                                .startswith(("image/", "audio/", "video/"))
                                or "attachment"
                                in response.headers.get("content-disposition", "").lower()
                                or response.headers.get("content-type", "").split(";", 1)[0].lower()
                                in {
                                    "application/octet-stream",
                                    "application/zip",
                                    "application/gzip",
                                    "application/x-sql",
                                    "application/sql",
                                    "application/vnd.sqlite3",
                                }
                            ):
                                truncated = True
                            elif method != "HEAD" and max_bytes:
                                async for chunk in response.aiter_raw(
                                    chunk_size=min(max_bytes + 1, 8192)
                                ):
                                    self.check_cancelled()
                                    remaining = max_bytes - len(body)
                                    body.extend(chunk[:remaining])
                                    if len(chunk) > remaining or len(body) >= max_bytes:
                                        truncated = True
                                        break
                            page = Page(
                                url=approved.url,
                                status=status,
                                headers=response.headers,
                                body=bytes(body),
                                truncated=truncated,
                                tls=tls,
                                redirects=list(redirects),
                            )
                            page.http_version = response.extensions.get(
                                "http_version", b"HTTP/1.1"
                            ).decode("ascii", errors="replace")
                            page.request_method = method
                            page.request_headers = headers or {}
                            self.event(
                                "response_received",
                                {
                                    "hostname": host,
                                    "method": method,
                                    "path": approved.url,
                                    "scanner": self.scanner,
                                    "status": status,
                                    "bytes_sampled": len(body),
                                    "truncated": truncated,
                                },
                            )
                except (httpx.HTTPError, OSError, TimeoutError) as exc:
                    self.limiter.feedback(host, True)
                    self.event(
                        "request_error", {"url": approved.url, "error_type": type(exc).__name__}
                    )
                    raise
            if status in (301, 302, 303, 307, 308) and page.headers.get("location"):
                redirects.append(
                    {"url": approved.url, "status": status, "location": page.headers["location"]}
                )
                if not follow_redirects:
                    page.redirects = list(redirects)
                    return page
                url = urljoin(approved.url, page.headers["location"])
                # Validation occurs before the next request, including DNS and IP checks.
                continue
            self.responses[key] = page
            while (
                len(self.responses) > 64
                or sum(len(p.body) for p in self.responses.values()) > 16 * 1024 * 1024
            ):
                self.responses.popitem(last=False)
            return page
        raise ScopeDenied("Redirect limit exceeded")
