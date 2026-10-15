"""Bounded browser observations for an explicitly authorized single-page review."""

from typing import Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.utils.redaction import clean_url, sanitize
from app.utils.urls import canonicalize


class BrowserReference(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=3000)
    kind: Literal[
        "link", "script", "stylesheet", "image", "media", "iframe", "canonical", "form", "api"
    ]


class FormSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int = Field(default=0, ge=0, le=10000, strict=True)
    password_fields: int = Field(default=0, ge=0, le=10000, strict=True)
    file_inputs: int = Field(default=0, ge=0, le=10000, strict=True)


class BrowserPageContext(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=3000)
    references: list[BrowserReference] = Field(default_factory=list, max_length=200)
    forms: FormSummary = Field(default_factory=FormSummary)
    secure_context: bool = Field(default=False, strict=True)

    @model_validator(mode="after")
    def bound_size(self):
        if len(self.model_dump_json().encode("utf-8")) > 64000:
            raise ValueError("Browser observations must fit within 64 KB")
        return self


class PageReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=3000)
    scan_profile: Literal["passive", "standard", "exposure"] = "standard"
    authorization_confirmed: bool = Field(default=False, strict=True)
    focus: str = Field(default="", max_length=1000)
    page_context: BrowserPageContext | None = None


def review_snapshot(body: PageReviewInput, target: str) -> dict:
    """Drop reference queries and reject secret-bearing paths before persistence."""
    snapshot = None
    skipped = 0
    if body.page_context:
        context = body.page_context
        if canonicalize(context.url) != target:
            raise ValueError("Captured tab URL must match the review target; capture the tab again")
        references = []
        seen = set()
        for ref in context.references:
            try:
                # Validate userinfo and protocol before stripping queries. Relative DOM
                # references resolve against the actual target, never a client-supplied base.
                url = canonicalize(ref.url, target)
                parts = urlsplit(url)
                url = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
                if clean_url(url) != url:
                    raise ValueError("Sensitive URL path")
            except (ValueError, UnicodeError):
                skipped += 1
                continue
            key = (url, ref.kind)
            if key not in seen:
                references.append({"url": url, "kind": ref.kind})
                seen.add(key)
        snapshot = {
            "url": target,
            "references": references,
            "forms": {
                "total": context.forms.total,
                "auth_inputs": context.forms.password_fields,
                "file_inputs": context.forms.file_inputs,
            },
            "secure_context": context.secure_context,
        }
    return sanitize(
        {
            "version": 1,
            "focus": body.focus,
            "browser_snapshot": snapshot,
            "invalid_references_skipped": skipped,
            "provenance": "browser_snapshot_unverified" if snapshot else "manual_url",
        }
    )


def review_summary(data: dict) -> dict:
    """Expose mode and counts without returning the captured reference inventory."""
    snapshot = data.get("browser_snapshot") or {}
    forms = snapshot.get("forms") or {}
    return {
        "mode": "single_page",
        "focus": data.get("focus", ""),
        "context_summary": {
            "browser_snapshot": bool(snapshot),
            "references": len(snapshot.get("references", [])),
            "forms": forms.get("total", 0),
            "password_fields": forms.get("auth_inputs", 0),
            "file_inputs": forms.get("file_inputs", 0),
        },
    }
