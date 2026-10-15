"""Evidence-based completion diagnostics and local automatic report drafts."""

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models import Finding, Report, Scan, ScanEvent, ScanFinding


def response_counts(db, scan_id):
    status = ScanEvent.data["status"].as_string()
    rows = db.execute(
        select(status, func.count())
        .where(ScanEvent.scan_id == scan_id, ScanEvent.kind == "response_received")
        .group_by(status)
    )
    return {str(code): count for code, count in rows if str(code).isdigit()}


def saved_completion(db, scan):
    event = db.scalar(
        select(ScanEvent)
        .where(ScanEvent.scan_id == scan.id, ScanEvent.kind == "scan_completed")
        .order_by(ScanEvent.created_at.desc(), ScanEvent.id.desc())
        .limit(1)
    )
    if event:
        return event.data
    if scan.status != "complete":
        return None
    return {
        "reason": "legacy_complete",
        "message": "This scan completed before detailed completion reasons were recorded. Review its AI and request logs.",
        "response_status_counts": response_counts(db, scan.id),
        "requests_sent": scan.requests_sent,
        "request_budget": scan.limits.get("request_budget", 10000),
    }


def record_completion(ctx, *, budget_reached=False):
    budget_reached = budget_reached or ctx.remaining_request_budget() <= 0
    if budget_reached:
        reason, message = (
            "request_budget_reached",
            "The request budget was reached; remaining work was skipped.",
        )
    elif ctx.skipped_url_admissions:
        reason, message = (
            "url_limit_reached",
            "The URL inventory cap prevented additional discovery. All admitted queued work finished.",
        )
    elif ctx.skipped_depth_admissions:
        reason, message = (
            "depth_limit_reached",
            "The crawl depth limit prevented additional discovery. All admitted queued work finished.",
        )
    else:
        reason, message = (
            "queue_exhausted",
            "All admitted URLs and bounded AI follow-ups finished; no new eligible URLs remained.",
        )
    with SessionLocal() as db:
        scan = db.get(Scan, ctx.scan_id)
        statuses = response_counts(db, ctx.scan_id)
        skipped_scope = db.scalar(
            select(func.count())
            .select_from(ScanEvent)
            .where(ScanEvent.scan_id == ctx.scan_id, ScanEvent.kind == "discovered_out_of_scope")
        )
        requests = scan.requests_sent
    ctx.event(
        "scan_completed",
        {
            "reason": reason,
            "message": message,
            "requests_sent": requests,
            "request_budget": ctx.limits["request_budget"],
            "urls_discovered": len(ctx.known),
            "url_cap": ctx.limits["url_cap"],
            "pending_urls": sum(url not in ctx.visited for url, _, _ in ctx.queue),
            "skipped_url_admissions": ctx.skipped_url_admissions,
            "skipped_depth_admissions": ctx.skipped_depth_admissions,
            "scope_skips": skipped_scope,
            "response_status_counts": statuses,
            "ai_status": ctx.ai.progress["status"],
            "ai_rounds_used": ctx.ai.progress["round"],
            "ai_round_limit": ctx.ai.progress["max_rounds"],
            "ai_round_policy": ctx.ai.progress["round_policy"],
            "ai_stop_reason": ctx.ai.progress["stop_reason"],
            "ai_actions_executed": ctx.ai.progress["actions_executed"],
            "profile": ctx.profile,
            "mode": "single_page" if ctx.page_review else "site_scan",
            "autopilot": ctx.autopilot,
        },
    )


def draft_reports(ctx):
    """Create at most 20 pairs of local drafts; never verify or submit a finding."""
    if not ctx.autopilot:
        return
    from app.api.routes import evidence_for
    from app.reports.generator import generate_report

    created = []
    with SessionLocal() as db:
        findings = list(
            db.scalars(
                select(Finding)
                .join(ScanFinding)
                .where(
                    ScanFinding.scan_id == ctx.scan_id,
                    Finding.confidence >= 75,
                    Finding.severity != "informational",
                    Finding.status.in_(["new", "needs_verification", "verified"]),
                )
                .order_by(Finding.confidence.desc())
                .limit(20)
            )
        )
        for finding in findings:
            ctx.check_cancelled()
            evidence = evidence_for(db, finding.id)
            if not evidence:
                continue
            for format_name in ("markdown", "html"):
                report = Report(
                    project_id=finding.project_id,
                    finding_id=finding.id,
                    format=format_name,
                    content=generate_report(finding, evidence, format_name),
                )
                db.add(report)
                db.flush()
                created.append({"id": report.id, "finding_id": finding.id, "format": format_name})
        ctx.check_cancelled()
        db.commit()
    ctx.event(
        "autopilot_reports_created",
        {
            "count": len(created),
            "reports": created,
            "message": "Local evidence-based drafts require researcher verification before submission.",
            "requires_manual_verification": True,
        },
    )
