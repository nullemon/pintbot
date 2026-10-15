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
        with SessionLocal() as db:
            request = db.scalar(
                select(ScanEvent)
                .where(ScanEvent.scan_id == scan.id, ScanEvent.kind == "page_review_requested")
                .order_by(ScanEvent.created_at)
                .limit(1)
            )
            self.page_review = (
                request.data if request and request.data.get("version") == 1 else None
            )
            self.autopilot = (
                db.scalar(
                    select(ScanEvent.id)
                    .where(ScanEvent.scan_id == scan.id, ScanEvent.kind == "autopilot_requested")
                    .limit(1)
                )
                is not None
            )
        self.target = canonicalize(scan.target)
        self.limits = dict(scan.limits)
        if self.page_review:
            # Enforce these again in the worker, independent of API admission.
            self.limits.update(
                request_budget=min(self.limits["request_budget"], 200),
                url_cap=min(self.limits["url_cap"], 80),
                max_depth=min(self.limits["max_depth"], 1),
                max_rps=min(self.limits["max_rps"], 2),
                max_concurrency=min(self.limits["max_concurrency"], 3),
            )
        self.guard = ScopeGuard(scan.scope_snapshot)
        self.http = SafeHTTPClient(scan.id, self.guard, self.limits)
        self.queue = deque()
        self.queued = set()
        self.known = set()
        self.visited = set()
        self.depth = 0
        self.current_asset = None
        self.directory_candidates = set()
        self.directory_candidate_limit = min(
            20 if self.page_review else 200, self.limits["url_cap"]
        )
        self.directory_candidates_seen = set()
        self.evidence_seen = set()
        self.skipped_url_admissions = 0
        self.skipped_depth_admissions = 0
        self.scanner_state = {"probes": set()}

    def page_review_fetch_allowed(self, url, source):
        """Page references are inventory; only selected resources enter its fetch queue."""
        if not self.page_review:
            return True
        if source in {
            "html:a",
            "html:area",
            "html:form",
            "html:iframe",
            "browser:link",
            "browser:form",
            "browser:iframe",
            "browser:canonical",
        }:
            return False
        return (
            (source == "manual" and url == self.target)
            or source in {"scanner:directory", "html:script", "browser:script"}
            or source in {"html:img", "html:video", "html:audio", "html:source", "html:object"}
            or source in {"browser:image", "browser:media"}
            or source == "javascript:sourcemap"
            or (source == "javascript" and urlsplit(url).path.lower().endswith((".js", ".mjs")))
            or metadata_only(url, source)
        )

    def enqueue_url(self, url, source, enqueue):
        if enqueue is False or not self.page_review_fetch_allowed(url, source):
            return
        passive_fetch = source == "manual" or (
            not self.page_review and urlsplit(url).path in {"/robots.txt", "/sitemap.xml"}
        )
        if url not in self.queued and self.depth > self.limits["max_depth"]:
            self.skipped_depth_admissions += 1
        if (
            url not in self.queued
            and self.depth <= self.limits["max_depth"]
            and (self.profile != "passive" or passive_fetch)
        ):
            self.queue.append((url, self.depth, source))
            self.queued.add(url)

    def add_directory_candidates(self, discovered):
        from app.recon.discovery import parent_directories

        if self.profile == "passive":
            return
        for directory in parent_directories(discovered):
            if not self.page_review:
                if len(self.directory_candidates) < self.directory_candidate_limit:
                    self.directory_candidates.add(directory)
                continue
            if directory in self.directory_candidates_seen:
                continue
            if len(self.directory_candidates_seen) >= self.directory_candidate_limit:
                break
            self.directory_candidates_seen.add(directory)
            self.directory_candidates.add(directory)

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

    async def remember_url(self, url, source="crawl", *, enqueue=None):
        self.check_cancelled()
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
        if metadata_only(url, source) or (
            self.page_review and source in {"browser:image", "browser:media"}
        ):
            self.http.metadata_only_urls.add(url)
        if url in self.known:
            # A link may be catalogued before the same URL is observed as a script.
            if self.page_review:
                self.enqueue_url(url, source, enqueue)
            return False
        if len(self.known) >= self.limits["url_cap"]:
            self.skipped_url_admissions += 1
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
        if self.page_review:
            # Disable site-wide seed discovery, including for referenced CDN origins.
            from app.scanners.base import origin

            self.scanner_state["probes"].update(
                {"discovery:" + origin(url), "exposure_directories:" + origin(url)}
            )
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
        self.enqueue_url(url, source, enqueue)
        return True

    async def browser_observation(self):
        """Treat user-captured DOM metadata as hints, never confirmed HTTP evidence."""
        if not self.page_review:
            return None
        snapshot = self.page_review.get("browser_snapshot")
        if not isinstance(snapshot, dict) or snapshot.get("url") != self.target:
            return None
        links = []
        self.depth = 1
        kinds = {
            "link",
            "script",
            "stylesheet",
            "image",
            "media",
            "iframe",
            "canonical",
            "form",
            "api",
        }
        references = [
            item
            for item in snapshot.get("references", [])[:200]
            if isinstance(item, dict) and item.get("kind") in kinds
        ]
        # Do not let navigation menus exhaust the inventory cap before page resources.
        references.sort(key=lambda item: item["kind"] not in {"script", "image", "media"})
        for reference in references:
            if not isinstance(reference, dict) or reference.get("kind") not in kinds:
                continue
            url = reference.get("url")
            if not isinstance(url, str):
                continue
            if await self.remember_url(url, "browser:" + reference["kind"]):
                links.append(url)
                if reference["kind"] in {"image", "media", "script"}:
                    self.add_directory_candidates(url)
        self.depth = 0
        return sanitize(
            {
                "url": self.target,
                "provenance": "browser_snapshot_unverified",
                "researcher_focus": str(self.page_review.get("focus", ""))[:1000],
                "discovered_urls": links[:20],
                "form_summary": {
                    key: max(0, min(10000, value))
                    for key, value in (snapshot.get("forms") or {}).items()
                    if key in {"total", "auth_inputs", "file_inputs"} and type(value) is int
                },
                "secure_context": bool(snapshot.get("secure_context")),
            }
        )

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
        if not ctx.page_review:
            await ctx.remember_url(origin + "/robots.txt", "robots")
            await ctx.remember_url(origin + "/sitemap.xml", "sitemap")
        ctx.set_stage("probing")
        observations = []
        browser_observation = await ctx.browser_observation()
        if browser_observation:
            observations.append(browser_observation)
        while True:
            ctx.check_cancelled()
            if not ctx.queue:
                if ctx.profile != "passive" and ctx.directory_candidates:
                    directories = sorted(ctx.directory_candidates)
                    ctx.directory_candidates.clear()
                    if ctx.page_review:
                        ctx.depth = 1
                    for directory in directories:
                        await ctx.remember_url(
                            directory, "scanner:directory" if ctx.page_review else "scanner"
                        )
                    if ctx.queue:
                        continue
                ctx.set_stage("analyzing")
                # Final AI discoveries remain part of this scan's guarded queue.
                # Treat a permitted follow-up as one discovery hop, never as an
                # unrestricted fresh crawl; the original caps stay authoritative.
                ctx.depth = 1
                before_round = ctx.ai.progress["round"]
                followups = await ctx.ai.review(observations, force=True)
                for page in followups:
                    observations.append(
                        sanitize(
                            {
                                "url": page.url,
                                "status": page.status,
                                "content_type": page.headers.get("content-type", ""),
                            }
                        )
                    )
                observations = observations[-200:]
                if ctx.queue or ctx.directory_candidates:
                    continue
                if (
                    followups
                    and not ctx.ai.stopped
                    and ctx.ai.progress["round"] > before_round
                    and ctx.ai.progress["round"] < ctx.ai.round_limit
                ):
                    continue
                break
            url, depth, source = ctx.queue.popleft()
            if url in ctx.visited:
                continue
            ctx.visited.add(url)
            ctx.depth = depth + 1
            ctx.set_stage("crawling")
            try:
                suffix = urlsplit(url).path.lower()
                # Images/archives become metadata only; never mass-download media or dumps.
                only_metadata = metadata_only(url, source) or url in ctx.http.metadata_only_urls
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
                if ctx.page_review:
                    links.sort(key=lambda item: not ctx.page_review_fetch_allowed(*item))
                for discovered, link_source in links:
                    if ctx.page_review or depth < ctx.limits["max_depth"]:
                        await ctx.remember_url(discovered, link_source)
                    else:
                        # Still evaluate discovered scope and record excluded URLs.
                        try:
                            ctx.guard.check_url(discovered)
                        except (ScopeDenied, ValueError) as exc:
                            ctx.event(
                                "discovered_out_of_scope", {"url": discovered, "reason": str(exc)}
                            )
                    ctx.add_directory_candidates(discovered)
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
                            **(
                                {
                                    "researcher_focus": str(ctx.page_review.get("focus", ""))[
                                        :1000
                                    ],
                                    "provenance": "guarded_http",
                                }
                                if ctx.page_review
                                else {}
                            ),
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
        ctx.ai.finish()
        ctx.counts()
        from app.workers.completion import draft_reports, record_completion

        draft_reports(ctx)
        record_completion(ctx)
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
        from app.workers.completion import draft_reports, record_completion

        draft_reports(ctx)
        record_completion(ctx, budget_reached=True)
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
