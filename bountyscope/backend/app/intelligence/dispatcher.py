"""A small capability boundary between untrusted AI plans and target HTTP."""

import inspect
from collections import deque
from urllib.parse import urlsplit

import httpx
from pydantic import ValidationError

from app.intelligence.schemas import SafeCheck, SafeTool
from app.intelligence.summaries import bounded, read
from app.scope.guard import ScopeDenied
from app.utils.redaction import sanitize

MAX_ROUNDS = 3
MAX_ACTIONS_PER_ROUND = 20


async def check_cancelled(ctx):
    callback = getattr(ctx, "check_cancelled", None)
    if callback is None:
        callback = ctx.http.check_cancelled
    result = callback()
    if inspect.isawaitable(result):
        await result


def event(ctx, kind, data):
    callback = getattr(ctx, "event", None)
    if callback:
        callback(kind, sanitize(data))


class SafeToolDispatcher:
    """Dispatch only named read-only checks through the scan's shared SafeHTTPClient.

    This layer cannot create an HTTP transport, choose methods/headers from a prompt,
    invoke a shell, or instantiate a browser. The shared target client still performs
    DNS/IP pinning, redirect validation, rate limiting, cancellation and budget admission.
    """

    def __init__(self, ctx, *, max_actions=MAX_ROUNDS * MAX_ACTIONS_PER_ROUND, observed_urls=()):
        self.ctx = ctx
        ceiling = (
            min(10000, max(0, int(ctx.limits["request_budget"])))
            if getattr(ctx, "autopilot", False)
            else MAX_ROUNDS * MAX_ACTIONS_PER_ROUND
        )
        self.max_actions = min(max(0, int(max_actions)), ceiling)
        self.actions = 0
        self.seen = set()
        self.observed_urls = set(observed_urls)
        self.history = deque(maxlen=80)

    async def dispatch(self, action):
        await check_cancelled(self.ctx)
        proposal = {
            "tool": bounded(
                getattr(read(action, "tool", ""), "value", read(action, "tool", "")), 80
            ),
            "url": bounded(read(action, "url", ""), 2048),
            "reason": bounded(read(action, "reason", ""), 1000),
        }
        event(self.ctx, "ai_action_proposed", proposal)
        try:
            page = await self._dispatch_validated(action)
            self.history.append(
                {
                    **proposal,
                    "outcome": "executed" if page is not None else "duplicate",
                    "status": page.status if page is not None else None,
                }
            )
            return page
        except (
            ScopeDenied,
            ValidationError,
            httpx.HTTPError,
            OSError,
            ValueError,
            TypeError,
        ) as exc:
            reason = bounded(str(exc), 300) if isinstance(exc, ScopeDenied) else type(exc).__name__
            event(self.ctx, "ai_action_denied", {**proposal, "reason": reason})
            self.history.append({**proposal, "outcome": "denied", "reason": reason})
            raise

    async def _dispatch_validated(self, action):
        if getattr(self.ctx, "profile", "standard") == "passive":
            raise ScopeDenied("Passive scans do not permit AI follow-up requests")
        action = SafeCheck.model_validate(action)
        if getattr(self.ctx, "profile", "standard") == "exposure" and action.tool in {
            SafeTool.CHECK_CORS,
            SafeTool.CHECK_COOKIE,
        }:
            raise ScopeDenied(
                "Exposure profile permits directory and file checks, not CORS or cookie probes"
            )
        if action.tool == SafeTool.CAPTURE_SCREENSHOT:
            raise ScopeDenied("Screenshot capture is unavailable: no guarded browser is configured")
        if self.actions >= self.max_actions:
            raise ScopeDenied("AI action ceiling reached")
        normalized = self.ctx.guard.check_url(action.url)
        parts = urlsplit(normalized)
        # AI may revisit observed query strings, but cannot invent payload-bearing queries.
        if parts.query and normalized not in self.observed_urls:
            raise ScopeDenied("AI cannot introduce unobserved query parameters")
        if action.tool == SafeTool.CHECK_DIRECTORY and (
            not parts.path.endswith("/") or parts.query
        ):
            raise ScopeDenied("Directory checks require a query-free directory URL")
        key = (action.tool, normalized)
        if key in self.seen:
            event(
                self.ctx,
                "ai_action_denied",
                {
                    "tool": action.tool.value,
                    "url": normalized,
                    "reason": "Duplicate check already completed",
                },
            )
            return None
        remember = getattr(self.ctx, "remember_url", None)
        known = getattr(self.ctx, "known", set())
        if remember and normalized not in known:
            admitted = remember(normalized, "ai_followup")
            if inspect.isawaitable(admitted):
                admitted = await admitted
            if admitted is False:
                raise ScopeDenied("AI follow-up URL cap exhausted")
        self.seen.add(key)
        self.actions += 1
        event(
            self.ctx,
            "ai_action_approved",
            {
                "tool": action.tool.value,
                "url": normalized,
                "reason": action.reason,
            },
        )
        # Fixed branches are deliberate: never getattr(ctx.http, model_supplied_name).
        if action.tool == SafeTool.INSPECT_HEADERS:
            page = await self.ctx.http.head(normalized, max_bytes=0)
        elif action.tool == SafeTool.CHECK_CORS:
            page = await self.ctx.http.get(
                normalized,
                headers={"Origin": "https://bountyscope.invalid"},
                max_bytes=65536,
                follow_redirects=False,
            )
        elif action.tool in {
            SafeTool.INSPECT_ENDPOINT,
            SafeTool.CHECK_DIRECTORY,
            SafeTool.CHECK_COOKIE,
        }:
            page = await self.ctx.http.get(normalized, max_bytes=131072)
        else:  # Defense in depth when a future enum member is added.
            raise ScopeDenied("Unsupported AI tool")
        event(
            self.ctx,
            "ai_action_executed",
            {
                "tool": action.tool.value,
                "url": str(page.url),
                "status": page.status,
                "truncated": bool(page.truncated),
            },
        )
        await check_cancelled(self.ctx)
        if remember and page.url != normalized:
            result = remember(page.url, "ai_followup")
            if inspect.isawaitable(result):
                await result
        return page
