import inspect
import traceback
from collections import deque
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qsl, urlsplit

from bs4 import BeautifulSoup
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, func, select, update

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.http import BudgetExceeded, SafeHTTPClient, ScanCancelled
from app.core.logging import emit_scan_event
from app.models import (
    Asset,
    Endpoint,
    Evidence,
    Finding,
    Project,
    Report,
    Scan,
    ScanEvent,
    ScanFinding,
)
from app.scope.guard import ScopeDenied, ScopeGuard
from app.utils.redaction import clean_url, redact, sanitize, sha256
from app.utils.urls import canonicalize, metadata_only


class ScanContext:
    def __init__(self, scan):
        self.scan_id = scan.id
        self.project_id = scan.project_id
        self.profile = scan.scan_profile
        self.limits = scan.limits
        self.guard = ScopeGuard(scan.scope_snapshot)
        self.http = SafeHTTPClient(scan.id, self.guard, scan.limits)
        self.queue = deque()
        self.known = set()
        self.visited = set()
        self.depth = 0
        self.current_asset = None
        self.directory_candidates = set()
        self.directory_candidate_limit = min(200, self.limits["url_cap"])
        self.evidence_seen = set()

    def event(self, kind, data):
        self.http.event(kind, data)
        if getattr(self, "ai", None):
            self.ai.observe_event(kind, data)

    def error(self, scanner, exc):
        if isinstance(exc, (ScanCancelled, BudgetExceeded)):
            raise exc
        # Avoid exception strings containing target secrets; type and scanner suffice.
        data = {
            "scanner": scanner,
            "error_type": type(exc).__name__,
            "location": [
                f"{f.name}:{f.lineno}" for f in traceback.extract_tb(exc.__traceback__)[-3:]
            ],
        }
        with SessionLocal() as db:
            scan = db.get(Scan, self.scan_id)
            scan.errors = [*scan.errors, data][-200:]
            db.add(ScanEvent(scan_id=self.scan_id, kind="scanner_error", data=data))
            db.commit()

        emit_scan_event(self.scan_id, "scanner_error", data)

    def check_cancelled(self):
        self.http.check_cancelled()

    def set_ai_round(self, value):
        self.set_stage("analyzing", ai_round=value)

    def set_stage(self, stage, **values):
        self.check_cancelled()
        with SessionLocal() as db:
            db.execute(
                update(Scan)
                .where(Scan.id == self.scan_id, Scan.cancel_requested.is_(False))
                .values(status=stage, **values)
            )
            db.add(
                ScanEvent(
                    scan_id=self.scan_id,
                    kind="stage_changed",
                    data=jsonable_encoder({"stage": stage, **values}),
                )
            )
            db.commit()

        emit_scan_event(self.scan_id, "stage_changed", jsonable_encoder({"stage": stage, **values}))

    async def remember_url(self, url, source="crawl"):
        self.check_cancelled()
        if len(self.known) >= self.limits["url_cap"]:
            return False
        try:
            url = canonicalize(url)
            self.guard.check_url(url)
            if clean_url(url) != url:
                self.event(
                    "discovered_out_of_scope",
                    {"url": url, "reason": "Sensitive URL values are not followed"},
                )
                return False
        except (ScopeDenied, ValueError, UnicodeError) as exc:
            self.event("discovered_out_of_scope", {"url": url, "reason": str(exc)})
            return False
        if metadata_only(url, source):
            self.http.metadata_only_urls.add(url)
        if url in self.known:
            return False
        self.known.add(url)
        # DNS for each newly discovered host is validated now and again before requesting.
        try:
            approved = await self.guard.approve(url)
        except Exception as exc:
            if isinstance(exc, (ScanCancelled, BudgetExceeded)):
                raise
            self.event(
                "discovered_out_of_scope",
                {
                    "url": url,
                    "reason": "DNS destination did not pass validation",
                    "error_type": type(exc).__name__,
                },
            )
            return False
        p = urlsplit(url)
        with SessionLocal() as db:
            asset = db.scalar(
                select(Asset).where(
                    Asset.project_id == self.project_id,
                    Asset.hostname == approved.hostname,
                    Asset.port == approved.port,
                    Asset.scheme == p.scheme,
                )
            )
            if not asset:
                asset = Asset(
                    project_id=self.project_id,
                    hostname=approved.hostname,
                    port=approved.port,
                    scheme=p.scheme,
                    ip=approved.addresses[0],
                )
                db.add(asset)
                db.flush()
                db.add(
                    ScanEvent(
                        scan_id=self.scan_id,
                        kind="asset_discovered",
                        data={"hostname": approved.hostname, "ip": approved.addresses[0]},
                    )
                )
            endpoint = db.scalar(
                select(Endpoint).where(Endpoint.asset_id == asset.id, Endpoint.url == url)
            )
            if not endpoint:
                endpoint = Endpoint(
                    asset_id=asset.id,
                    url=url,
                    source=source,
                    parameters=[k for k, _ in parse_qsl(p.query)],
                )
                db.add(endpoint)
            db.commit()
        passive_fetch = source == "manual" or urlsplit(url).path in {"/robots.txt", "/sitemap.xml"}
        if self.depth <= self.limits["max_depth"] and (self.profile != "passive" or passive_fetch):
            self.queue.append((url, self.depth, source))
        return True

    async def process_ai_page(self, page):
        from app.scanners import analyze_page

        await self.remember_url(page.url, "scanner")
        self.save_page(page)
        for candidate in await analyze_page(self, page):
            self.save_candidate(candidate, page)
        self.visited.add(page.url)
        self.counts()

    def save_page(self, page):
        p = urlsplit(page.url)
        with SessionLocal() as db:
            asset = db.scalar(
                select(Asset).where(
                    Asset.project_id == self.project_id,
                    Asset.hostname == p.hostname,
                    Asset.port == (p.port or (443 if p.scheme == "https" else 80)),
                    Asset.scheme == p.scheme,
                )
            )
            if not asset:
                return
            soup = (
                BeautifulSoup(page.body[:131072], "html.parser")
                if "html" in page.headers.get("content-type", "")
                else None
            )
            title = soup.title.get_text() if soup and soup.title else ""
            asset.status_code = page.status
            asset.title = redact(title[:300])
            asset.server = redact(page.headers.get("server", "")[:300])
            asset.content_type = page.headers.get("content-type", "")[:300]
            asset.tls = sanitize(page.tls)
            technologies = []
            for signal, tech in [
                ("wp-content", "WordPress"),
                ("__next", "Next.js"),
                ("django", "Django"),
                ("laravel", "Laravel"),
            ]:
                if signal in page.body[:65536].decode("utf-8", errors="replace").lower():
                    technologies.append(tech)
            asset.technology = sorted(set(asset.technology + technologies))
            asset.last_seen = datetime.now(UTC)
            endpoint = db.scalar(
                select(Endpoint).where(Endpoint.asset_id == asset.id, Endpoint.url == page.url)
            )
            if endpoint:
                endpoint.status_code = page.status
                endpoint.content_type = page.headers.get("content-type", "")[:300]
                endpoint.content_length = (
                    int(page.headers.get("content-length", len(page.body)))
                    if page.headers.get("content-length", "0").isdigit()
                    else len(page.body)
                )
            self.current_asset = asset.id
            db.commit()

    def save_candidate(self, candidate, page):
        from app.scanners.base import finding_fingerprint

        values = candidate if isinstance(candidate, dict) else vars(candidate)
        url = values.get("url") or page.url
        scanner = values["scanner"]
        category = values["category"]
        parameter = values.get("parameter", "")
        fingerprint = finding_fingerprint(candidate)
        page = values.get("evidence_page") or page
        with SessionLocal() as db:
            finding = db.scalar(
                select(Finding).where(
                    Finding.project_id == self.project_id, Finding.fingerprint == fingerprint
                )
            )
            created = finding is None
            if finding:
                finding.affected_locations = sorted(
                    set([*finding.affected_locations, clean_url(url)])
                )[:100]
                finding.updated_at = datetime.now(UTC)
                if clean_url(url) == finding.affected_url:
                    finding.evidence_summary = redact(values["evidence_summary"])
                    finding.confidence = max(0, min(100, values["confidence"]))
            else:
                endpoint = db.scalar(
                    select(Endpoint)
                    .where(Endpoint.url == clean_url(url))
                    .join(Asset)
                    .where(Asset.project_id == self.project_id)
                )
                finding = Finding(
                    project_id=self.project_id,
                    scan_id=self.scan_id,
                    asset_id=endpoint.asset_id if endpoint else self.current_asset,
                    endpoint_id=endpoint.id if endpoint else None,
                    scanner=scanner,
                    title=redact(values["title"]),
                    category=category,
                    description=redact(values["description"]),
                    severity=values["severity"],
                    confidence=max(0, min(100, values["confidence"])),
                    cwe=values.get("cwe", ""),
                    affected_url=clean_url(url),
                    affected_parameter=parameter,
                    affected_locations=[clean_url(url)],
                    evidence_summary=redact(values["evidence_summary"]),
                    recommendation=redact(values["recommendation"]),
                    fingerprint=fingerprint,
                )
                db.add(finding)
            db.flush()
            if not db.get(ScanFinding, (self.scan_id, finding.id)):
                db.add(ScanFinding(scan_id=self.scan_id, finding_id=finding.id))
            evidence_key = (fingerprint, clean_url(url))
            if (
                evidence_key in self.evidence_seen
                or sum(1 for fp, _ in self.evidence_seen if fp == fingerprint) >= 100
            ):
                db.commit()
                return
            self.evidence_seen.add(evidence_key)
            excerpt = values.get("excerpt", "")[:512]
            # Exposure indicators never retain arbitrary assignment values, even unknown key names.
            if scanner in {"exposed_files", "exposure"}:
                import re

                excerpt = re.sub(r"(?m)^([^=\n]{1,100}=).*$", r"\1[REDACTED]", excerpt)
            db.add(
                Evidence(
                    finding_id=finding.id,
                    type="http",
                    request_metadata=sanitize(
                        {
                            "scan_id": self.scan_id,
                            "method": getattr(
                                page,
                                "request_method",
                                values.get("metadata", {}).get("method", "GET"),
                            ),
                            "url": page.url,
                            "headers": getattr(page, "request_headers", {}),
                            "scanner": scanner,
                        }
                    ),
                    response_metadata=sanitize(
                        {
                            "status": page.status,
                            "content_type": page.headers.get("content-type", ""),
                            "bytes_sampled": len(page.body),
                            "content_length": page.headers.get("content-length"),
                            "http_version": getattr(page, "http_version", "unknown"),
                            "truncated": page.truncated,
                            "hash_scope": "sampled_bytes",
                            "headers": {
                                k: v
                                for k, v in page.headers.items()
                                if k.lower()
                                in {
                                    "content-security-policy",
                                    "strict-transport-security",
                                    "x-content-type-options",
                                    "referrer-policy",
                                    "permissions-policy",
                                    "x-frame-options",
                                    "access-control-allow-origin",
                                    "access-control-allow-credentials",
                                    "vary",
                                    "cache-control",
                                    "server",
                                }
                            },
                            "signals": values.get("signals", []),
                            "details": values.get("metadata", {}),
                        }
                    ),
                    redacted_excerpt=redact(excerpt),
                    body_sha256=sha256(page.body),
                )
            )
            db.add(
                ScanEvent(
                    scan_id=self.scan_id,
                    kind="finding_created" if created else "finding_observed",
                    data={
                        "finding_id": finding.id,
                        "scanner": scanner,
                        "title": finding.title,
                        "confidence": finding.confidence,
                    },
                )
            )
            db.commit()

    def counts(self):
        with SessionLocal() as db:
            db.execute(
                update(Scan)
                .where(Scan.id == self.scan_id)
                .values(
                    assets_found=db.scalar(
                        select(func.count())
                        .select_from(Asset)
                        .where(Asset.project_id == self.project_id)
                    ),
                    endpoints_found=len(self.known),
                    findings_found=db.scalar(
                        select(func.count())
                        .select_from(ScanFinding)
                        .where(ScanFinding.scan_id == self.scan_id)
                    ),
                )
            )
            db.commit()


async def run_scan(scan_id):
    from app.recon.discovery import (
        discover_html,
        discover_javascript,
        parent_directories,
        parse_robots,
        parse_sitemap,
    )
    from app.scanners import analyze_page

    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        if not scan or scan.cancel_requested:
            return
        # One successful claim prevents duplicate queue deliveries from running a scan twice.
        claimed = db.execute(
            update(Scan)
            .where(Scan.id == scan_id, Scan.status == "queued", Scan.cancel_requested.is_(False))
            .values(status="validating_scope", started_at=datetime.now(UTC))
        )
        db.commit()
        if claimed.rowcount != 1:
            return
        db.refresh(scan)
    ctx = ScanContext(scan)
    from app.intelligence.live import LiveAdvisor

    ctx.ai = LiveAdvisor(ctx)
    ctx.ai.publish()
    try:
        with SessionLocal() as db:
            project = db.get(Project, scan.project_id)
            if not project.authorization_confirmed:
                raise ScopeDenied("Authorization was withdrawn")
        ctx.set_stage("discovering")
        await ctx.remember_url(scan.target, "manual")
        target = urlsplit(scan.target)
        origin = f"{target.scheme}://{target.netloc}"
        await ctx.remember_url(origin + "/robots.txt", "robots")
        await ctx.remember_url(origin + "/sitemap.xml", "sitemap")
        ctx.set_stage("probing")
        observations = []
        while ctx.queue:
            ctx.check_cancelled()
            url, depth, source = ctx.queue.popleft()
            if url in ctx.visited:
                continue
            ctx.visited.add(url)
            ctx.depth = depth + 1
            ctx.set_stage("crawling")
            try:
                suffix = urlsplit(url).path.lower()
                # Images/archives become metadata only; never mass-download media or dumps.
                only_metadata = metadata_only(url, source)
                limit = (
                    131072
                    if source == "scanner:directory"
                    else 32768
                    if suffix.endswith("robots.txt")
                    else 131072
                    if suffix.endswith(".xml")
                    else 512
                    if suffix.endswith((".env", ".log", ".bak", "/.git/head"))
                    else 2 * 1024 * 1024
                )
                ctx.http.scanner = "recon"
                page = await (
                    ctx.http.head(url) if only_metadata else ctx.http.get(url, max_bytes=limit)
                )
                await ctx.remember_url(page.url, "redirect" if page.url != url else source)
                ctx.save_page(page)
                from app.scanners.directory import is_directory_listing

                links = []
                content_type = page.headers.get("content-type", "")
                if suffix.endswith("robots.txt"):
                    links.extend(
                        parse_robots(page.body.decode("utf-8", errors="replace"), page.url)
                    )
                elif "xml" in content_type or suffix.endswith(".xml"):
                    links.extend(parse_sitemap(page.body, page.url))
                elif "javascript" in content_type or suffix.endswith(".js"):
                    links.extend(
                        discover_javascript(page.body.decode("utf-8", errors="replace"), page.url)
                    )
                elif "html" in content_type and not is_directory_listing(page):
                    links.extend(discover_html(page))
                for discovered, link_source in links:
                    if depth < ctx.limits["max_depth"]:
                        await ctx.remember_url(discovered, link_source)
                    else:
                        # Still evaluate discovered scope and record excluded URLs.
                        try:
                            ctx.guard.check_url(discovered)
                        except (ScopeDenied, ValueError) as exc:
                            ctx.event(
                                "discovered_out_of_scope", {"url": discovered, "reason": str(exc)}
                            )
                    if ctx.profile != "passive":
                        for directory in parent_directories(discovered):
                            if len(ctx.directory_candidates) < ctx.directory_candidate_limit:
                                ctx.directory_candidates.add(directory)
                ctx.set_stage("scanning")
                if inspect.iscoroutinefunction(analyze_page):
                    candidates = await analyze_page(ctx, page)
                else:
                    candidates = analyze_page(ctx, page)
                for candidate in candidates:
                    ctx.save_candidate(candidate, page)
                observations.append(
                    sanitize(
                        {
                            "url": page.url,
                            "status": page.status,
                            "content_type": content_type,
                            "signals": [c.title for c in candidates],
                            "discovered_urls": [u for u, _ in links[:20]],
                            "parent_directories": sorted(ctx.directory_candidates)[:20],
                        }
                    )
                )
                observations = observations[-200:]
                ctx.counts()
                for followup in await ctx.ai.review(observations):
                    observations.append(
                        sanitize(
                            {
                                "url": followup.url,
                                "status": followup.status,
                                "content_type": followup.headers.get("content-type", ""),
                            }
                        )
                    )
                ctx.counts()
            except (ScanCancelled, BudgetExceeded):
                raise
            except ScopeDenied as exc:
                ctx.event("scope_check", {"url": url, "allowed": False, "reason": str(exc)})
            except Exception as exc:
                ctx.error("pipeline", exc)
            if not ctx.queue and ctx.profile != "passive" and ctx.directory_candidates:
                directories = sorted(ctx.directory_candidates)
                ctx.directory_candidates.clear()
                for directory in directories:
                    await ctx.remember_url(directory, "scanner")
        ctx.set_stage("analyzing")
        await ctx.ai.review(observations, force=True)
        ctx.ai.finish()
        ctx.counts()
        ctx.set_stage("complete", finished_at=datetime.now(UTC))
    except ScanCancelled:
        ctx.event(
            "scan_cancelled", {"message": "Worker acknowledged cancellation; no new requests"}
        )
    except BudgetExceeded:
        ctx.counts()
        ctx.event(
            "budget_exhausted", {"message": "Request budget reached; remaining checks skipped"}
        )
        ctx.set_stage("complete", finished_at=datetime.now(UTC))
    except Exception as exc:
        ctx.error("scan", exc)
        with SessionLocal() as db:
            db.execute(
                update(Scan)
                .where(Scan.id == scan_id, Scan.cancel_requested.is_(False))
                .values(status="failed", finished_at=datetime.now(UTC))
            )
            db.commit()


def purge_expired_evidence():
    cutoff = datetime.now(UTC) - timedelta(days=settings.evidence_retention_days)
    with SessionLocal() as db:
        db.execute(delete(Evidence).where(Evidence.created_at < cutoff))
        # Reports may embed evidence; expire them by the same policy.
        db.execute(delete(Report).where(Report.created_at < cutoff))
        db.commit()
