import asyncio
from datetime import UTC, datetime

from sqlalchemy import select, update

from app.core.database import SessionLocal
from app.models import Scan
from app.workers.celery_app import celery
from app.workers.pipeline import purge_expired_evidence, run_scan


@celery.task(name="app.workers.scan_tasks.dispatch_scan")
def dispatch_scan(scan_id):
    asyncio.run(run_scan(scan_id))


@celery.task(name="app.workers.scan_tasks.recover_queued")
def recover_queued():
    with SessionLocal() as db:
        ids = list(
            db.scalars(
                select(Scan.id)
                .where(Scan.status == "queued", Scan.cancel_requested.is_(False))
                .limit(100)
            )
        )
    for scan_id in ids:
        dispatch_scan.delay(scan_id)


@celery.task(name="app.workers.scan_tasks.purge_evidence")
def purge_evidence():
    purge_expired_evidence()


def recover_interrupted():
    # Deployment starts a single worker. Never silently resume a partially executed scan.
    with SessionLocal() as db:
        db.execute(
            update(Scan)
            .where(Scan.status.not_in(["queued", "complete", "cancelled", "failed"]))
            .values(
                status="failed",
                finished_at=datetime.now(UTC),
                errors=[
                    {
                        "scanner": "worker",
                        "error_type": "WorkerInterrupted",
                        "message": "Worker restarted; create a new scan to retry",
                    }
                ],
            )
        )
        db.commit()
