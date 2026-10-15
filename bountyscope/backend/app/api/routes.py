import asyncio
import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from sqlalchemy import case, delete, func, or_, select, update
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
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
    ScopeRule,
)
from app.schemas import FindingPatch, ProjectInput, ProjectPatch, ReportInput, RuleInput, ScanInput
from app.scope.guard import ScopeDenied, ScopeGuard
from app.utils.redaction import sanitize

router = APIRouter(prefix="/api")
DB = Annotated[Session, Depends(get_db)]


def record(obj):
    return jsonable_encoder({c.key: getattr(obj, c.key) for c in inspect(obj).mapper.column_attrs})


def require(db, model, key):
    obj = db.get(model, key)
    if not obj:
        raise HTTPException(404, f"{model.__name__} not found")
    return obj


def page(db, query, limit, offset):
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
    return {
        "items": [record(x) for x in db.scalars(query.limit(limit).offset(offset))],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def rules_for(db, project_id):
    return [
        record(r) for r in db.scalars(select(ScopeRule).where(ScopeRule.project_id == project_id))
    ]


@router.get("/projects")
def projects(db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return page(db, select(Project).order_by(Project.created_at.desc()), limit, offset)


@router.post("/projects", status_code=201)
def create_project(body: ProjectInput, db: DB):
    p = Project(**{k: sanitize(v) for k, v in body.model_dump(exclude={"scope"}).items()})
    db.add(p)
    db.flush()
    for rule in body.scope:
        db.add(ScopeRule(project_id=p.id, **rule.model_dump()))
    db.commit()
    return {**record(p), "scope": rules_for(db, p.id)}


@router.get("/projects/{project_id}")
def project(project_id: str, db: DB):
    return {**record(require(db, Project, project_id)), "scope": rules_for(db, project_id)}


@router.patch("/projects/{project_id}")
def patch_project(project_id: str, body: ProjectPatch, db: DB):
    p = require(db, Project, project_id)
    for key, value in {
        k: sanitize(v) for k, v in body.model_dump(exclude_unset=True, exclude_none=True).items()
    }.items():
        setattr(p, key, value)
    db.commit()
    return record(p)


@router.get("/projects/{project_id}/scope")
def get_scope(project_id: str, db: DB):
    require(db, Project, project_id)
    return rules_for(db, project_id)


@router.post("/projects/{project_id}/scope")
def set_scope(project_id: str, body: list[RuleInput], db: DB):
    require(db, Project, project_id)
    if len(body) > 500:
        raise HTTPException(422, "At most 500 scope rules")
    db.execute(delete(ScopeRule).where(ScopeRule.project_id == project_id))
    for rule in body:
        db.add(ScopeRule(project_id=project_id, **rule.model_dump()))
    db.commit()
    return rules_for(db, project_id)


@router.get("/scans")
def scans(
    db: DB,
    project_id: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = select(Scan).order_by(Scan.created_at.desc())
    if project_id:
        q = q.where(Scan.project_id == project_id)
    return page(db, q, limit, offset)


@router.post("/scans", status_code=201)
async def create_scan(body: ScanInput, db: DB):
    p = require(db, Project, body.project_id)
    if not p.authorization_confirmed:
        raise HTTPException(403, "Confirm: I am authorized to test these assets.")
    if body.scan_profile == "extended" and not body.extended_confirmed:
        raise HTTPException(422, "Extended profile requires explicit opt-in")
    target = body.target if "://" in body.target else "https://" + body.target
    scope = rules_for(db, p.id)
    try:
        approved = await ScopeGuard(scope).approve(target)
    except (ScopeDenied, OSError, ValueError) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, "Target DNS could not be validated") from exc
    from app.utils.redaction import clean_url

    if clean_url(approved.url) != approved.url:
        raise HTTPException(422, "Targets containing sensitive query values are not accepted")
    limits = {
        k: getattr(p, k)
        for k in ("max_rps", "max_concurrency", "max_depth", "url_cap", "request_budget")
    }
    scan = Scan(
        project_id=p.id,
        target=approved.url,
        scan_profile=body.scan_profile,
        scope_snapshot=scope,
        limits=limits,
    )
    db.add(scan)
    db.commit()
    # Durable queued rows are consumed by the dispatcher even after a broker outage.
    from app.workers.scan_tasks import dispatch_scan

    try:
        dispatch_scan.delay(scan.id)
    except Exception:
        db.add(
            ScanEvent(
                scan_id=scan.id,
                kind="queue_pending",
                data={"reason": "Broker unavailable; dispatcher will retry"},
            )
        )
        db.commit()
    return record(scan)


@router.get("/scans/{scan_id}")
def scan_detail(scan_id: str, db: DB):
    scan = require(db, Scan, scan_id)
    latest = db.scalar(
        select(ScanEvent)
        .where(ScanEvent.scan_id == scan_id, ScanEvent.kind == "ai_progress")
        .order_by(ScanEvent.created_at.desc(), ScanEvent.id.desc())
        .limit(1)
    )
    progress = dict(latest.data) if latest else None
    if progress and scan.status in {"cancelled", "failed"}:
        progress.update(status="unavailable", message="Scan " + scan.status + "; AI work stopped")
    if progress and scan.status == "complete" and progress.get("status") == "analyzing":
        progress.update(
            status="unavailable",
            message="Scan ended before the AI batch completed; review budget and scan events",
        )
    return {**record(scan), "ai_progress": progress}


@router.post("/scans/{scan_id}/cancel")
def cancel_scan(scan_id: str, db: DB):
    scan = require(db, Scan, scan_id)
    if scan.status not in ("complete", "cancelled", "failed"):
        db.execute(
            update(Scan)
            .where(Scan.id == scan_id)
            .values(cancel_requested=True, status="cancelled", finished_at=datetime.now(UTC))
        )
        db.add(
            ScanEvent(
                scan_id=scan_id, kind="scan_cancelled", data={"reason": "Researcher cancelled scan"}
            )
        )
        db.commit()
        db.refresh(scan)
    return record(scan)


@router.get("/scans/{scan_id}/events")
def scan_events(
    scan_id: str,
    db: DB,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    newest_first: bool = False,
):
    require(db, Scan, scan_id)
    return page(
        db,
        select(ScanEvent)
        .where(ScanEvent.scan_id == scan_id)
        .order_by(
            ScanEvent.created_at.desc() if newest_first else ScanEvent.created_at,
            ScanEvent.id.desc() if newest_first else ScanEvent.id,
        ),
        limit,
        offset,
    )


@router.get("/scans/{scan_id}/stream")
def scan_stream(scan_id: str, db: DB):
    require(db, Scan, scan_id)

    async def events():
        last = ""
        for _ in range(1800):
            with SessionLocal() as session:
                data = scan_detail(scan_id, session)
            encoded = json.dumps(data)
            if encoded != last:
                yield "data: " + encoded + "\n\n"
                last = encoded
            else:
                yield ": heartbeat\n\n"
            if data["status"] in ("complete", "failed", "cancelled"):
                break
            await asyncio.sleep(1)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/projects/{project_id}/assets")
def assets(
    project_id: str,
    db: DB,
    search: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    require(db, Project, project_id)
    return page(
        db,
        select(Asset)
        .where(Asset.project_id == project_id, Asset.hostname.contains(search))
        .order_by(Asset.hostname),
        limit,
        offset,
    )


@router.get("/projects/{project_id}/endpoints")
def endpoints(
    project_id: str,
    db: DB,
    search: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    require(db, Project, project_id)
    return page(
        db,
        select(Endpoint)
        .join(Asset)
        .where(Asset.project_id == project_id, Endpoint.url.contains(search))
        .order_by(Endpoint.first_seen.desc()),
        limit,
        offset,
    )


@router.get("/findings")
def findings(
    db: DB,
    project_id: str | None = None,
    scan_id: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    scanner: str | None = None,
    host: str | None = None,
    category: str | None = None,
    confidence_min: int = Query(0, ge=0, le=100),
    sort: Literal["recent", "priority", "confidence", "severity"] = "recent",
    focus: Literal["all", "exposure"] = "all",
    search: str = "",
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    q = (
        select(Finding)
        .where(Finding.confidence >= confidence_min, Finding.title.contains(search))
        .order_by(Finding.created_at.desc())
    )
    if focus == "exposure":
        q = q.where(
            Finding.scanner.in_(["directory_listing", "exposed_files", "javascript"]),
            or_(
                Finding.scanner != "javascript", Finding.cwe != "CWE-540", Finding.confidence >= 75
            ),
        )
    if sort != "recent":
        rank = case(
            {"critical": 5, "high": 4, "medium": 3, "low": 2, "informational": 1},
            value=Finding.severity,
            else_=0,
        )
        order = {
            "priority": Finding.ai_analysis["priority"]["score"].as_integer().desc().nulls_last(),
            "confidence": Finding.confidence.desc(),
            "severity": rank.desc(),
        }[sort]
        q = q.order_by(None).order_by(order, rank.desc(), Finding.confidence.desc(), Finding.id)
    for name, value in {
        "project_id": project_id,
        "severity": severity,
        "status": status,
        "scanner": scanner,
        "category": category,
    }.items():
        if value:
            q = q.where(getattr(Finding, name) == value)
    if scan_id:
        q = q.join(ScanFinding).where(ScanFinding.scan_id == scan_id)
    if host:
        q = q.join(Asset).where(Asset.hostname == host)
    return page(db, q, limit, offset)


def evidence_for(db, finding_id):
    cutoff = datetime.now(UTC) - timedelta(days=settings.evidence_retention_days)
    return [
        record(e)
        for e in db.scalars(
            select(Evidence).where(Evidence.finding_id == finding_id, Evidence.created_at >= cutoff)
        )
    ]


@router.get("/findings/{finding_id}")
def finding_detail(finding_id: str, db: DB):
    return {**record(require(db, Finding, finding_id)), "evidence": evidence_for(db, finding_id)}


@router.patch("/findings/{finding_id}")
def patch_finding(finding_id: str, body: FindingPatch, db: DB):
    finding = require(db, Finding, finding_id)
    for key, value in sanitize(body.model_dump(exclude_none=True)).items():
        setattr(finding, key, value)
    db.commit()
    return record(finding)


@router.post("/findings/{finding_id}/analyze")
async def analyze(finding_id: str, db: DB):
    from app.intelligence.analyzer import analyze_finding

    finding = require(db, Finding, finding_id)
    finding.ai_analysis = {
        **finding.ai_analysis,
        **await analyze_finding(record(finding), evidence_for(db, finding_id)),
    }
    db.commit()
    return record(finding)


@router.post("/reports", status_code=201)
def report_create(body: ReportInput, db: DB):
    from app.reports.generator import generate_report

    finding = require(db, Finding, body.finding_id)
    report = Report(
        project_id=finding.project_id,
        finding_id=finding.id,
        format=body.format,
        content=generate_report(record(finding), evidence_for(db, finding.id), body.format),
    )
    db.add(report)
    db.commit()
    return record(report)


@router.get("/reports")
def reports(db: DB, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
    return page(db, select(Report).order_by(Report.created_at.desc()), limit, offset)


@router.get("/reports/{report_id}")
def report_detail(report_id: str, db: DB):
    return record(require(db, Report, report_id))


@router.get("/settings")
def read_settings():
    return {
        "ai_enabled": settings.ai_enabled,
        "ai_provider": settings.ai_provider,
        "ai_model": settings.openai_model
        if settings.ai_provider == "openai"
        else settings.anthropic_model,
        "ai_max_rounds": min(3, settings.ai_max_rounds),
        "ai_max_actions_per_round": min(20, settings.ai_max_actions_per_round),
        "evidence_retention_days": settings.evidence_retention_days,
        "user_agent": settings.user_agent,
        "authentication_enabled": bool(settings.api_token),
    }


@router.get("/dashboard")
def dashboard(db: DB):
    counts = {
        name: db.scalar(select(func.count()).select_from(model))
        for name, model in [
            ("projects", Project),
            ("scans", Scan),
            ("assets", Asset),
            ("endpoints", Endpoint),
            ("findings", Finding),
        ]
    }
    counts["severity_counts"] = {
        s: db.scalar(select(func.count()).select_from(Finding).where(Finding.severity == s))
        for s in ["critical", "high", "medium", "low", "informational"]
    }
    counts["active_scans"] = db.scalar(
        select(func.count())
        .select_from(Scan)
        .where(Scan.status.not_in(["complete", "failed", "cancelled"]))
    )
    counts["recent_scans"] = [
        record(s) for s in db.scalars(select(Scan).order_by(Scan.created_at.desc()).limit(5))
    ]
    counts["recent_findings"] = [
        record(s) for s in db.scalars(select(Finding).order_by(Finding.created_at.desc()).limit(5))
    ]
    return counts
