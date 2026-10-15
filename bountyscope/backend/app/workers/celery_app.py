from celery import Celery

from app.core.config import settings

celery = Celery(
    "bountyscope",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.scan_tasks"],
)
celery.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    beat_schedule={
        "recover-queued-scans": {"task": "app.workers.scan_tasks.recover_queued", "schedule": 15.0},
        "purge-evidence": {"task": "app.workers.scan_tasks.purge_evidence", "schedule": 3600.0},
    },
)
