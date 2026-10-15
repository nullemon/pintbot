"""Shared scanner values. Target traffic belongs exclusively to the guarded client."""

import hashlib
import json
import posixpath
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import unquote, urlsplit

import httpx


@dataclass
class Page:
    url: str
    status: int
    headers: httpx.Headers
    body: bytes
    truncated: bool = False
    tls: dict = field(default_factory=dict)
    redirects: list[dict] = field(default_factory=list)

    def __post_init__(self):
        if not isinstance(self.headers, httpx.Headers):
            self.headers = httpx.Headers(self.headers)

    @property
    def status_code(self) -> int:
        return self.status

    @property
    def text(self) -> str:
        return self.body.decode("utf-8", errors="replace")

    @property
    def content(self) -> bytes:
        return self.body


@dataclass
class FindingCandidate:
    scanner: str
    title: str
    category: str
    description: str
    severity: str
    confidence: int
    evidence_summary: str
    recommendation: str
    url: str
    cwe: str = ""
    parameter: str = ""
    signals: list[str] = field(default_factory=list)
    excerpt: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)
    evidence_page: Page | None = None


def finding_fingerprint(candidate: FindingCandidate | Mapping) -> str:
    """Deduplicate observations without retaining query values or cookie values."""
    values = candidate if isinstance(candidate, Mapping) else vars(candidate)
    parts = urlsplit(values["url"])
    hostname = (parts.hostname or "").lower().rstrip(".")
    path = posixpath.normpath(unquote(parts.path or "/"))
    path = re.sub(r"(?<=/)[0-9]+(?=/|$)", "{id}", path)
    path = re.sub(r"(?i)(?<=/)[0-9a-f]{8}-[0-9a-f-]{27,36}(?=/|$)", "{id}", path)
    if values["scanner"] in {"security_headers", "cookies", "tls", "directory_listing"} or any(
        signal.startswith("version_header:") for signal in values.get("signals", [])
    ):
        path = "/"
    material = [
        values["scanner"],
        hostname,
        values["category"],
        values["title"],
        path.rstrip("/") or "/",
        values.get("parameter", ""),
    ]
    return hashlib.sha256(
        json.dumps(material, ensure_ascii=True, separators=(",", ":")).encode()
    ).hexdigest()


def passive(ctx) -> bool:
    profile = getattr(ctx, "profile", "standard")
    return str(getattr(profile, "name", profile)).lower() == "passive"


def origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


def document(page: Page) -> bool:
    kind = page.headers.get("content-type", "").lower()
    return "html" in kind or (not kind and b"<html" in page.body[:1024].lower())


def once(ctx, key: str) -> bool:
    """Keep active probes bounded across a scan without shared cross-scan state."""
    state = getattr(ctx, "scanner_state", None)
    if state is None:
        state = {}
        try:
            ctx.scanner_state = state
        except AttributeError:
            # Contexts normally expose scanner_state; a restricted test context can
            # still run scanners correctly without this optimization.
            return True
    seen = state.setdefault("probes", set())
    if key in seen:
        return False
    seen.add(key)
    return True


def permitted(ctx, url: str) -> bool:
    """Excluded discovery paths are skipped before asking the client to fetch them."""
    from app.scope.guard import ScopeDenied

    try:
        ctx.guard.check_url(url)
    except (ScopeDenied, ValueError) as exc:
        event = getattr(ctx, "event", None)
        if event:
            event("discovered_out_of_scope", {"url": url, "reason": str(exc)})
        return False
    return True
