from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "accredit",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Lagos",
    enable_utc=True,
)


@celery_app.task(bind=True, max_retries=3)
def send_invite_batch(self, batch_id: int):
    pass


@celery_app.task(bind=True, max_retries=3)
def send_single_invite(self, invite_id: int):
    pass
