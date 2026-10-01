import asyncio
from collections import deque
from sqlalchemy import event
from sqlalchemy.orm import Session as SyncSession
from app.models.guest import Guest

_guest_sync_queue: deque[int] = deque()
_worker_task: asyncio.Task | None = None


@event.listens_for(SyncSession, "after_flush")
def _detect_new_guests(session, flush_context):
    for obj in session.new:
        if isinstance(obj, Guest):
            _guest_sync_queue.append(obj.id)


async def _sync_worker():
    while True:
        while _guest_sync_queue:
            guest_id = _guest_sync_queue.popleft()
            try:
                from app.core.database import async_session
                from app.services.audience import sync_single_guest
                async with async_session() as db:
                    guest = await db.get(Guest, guest_id)
                    if guest:
                        await sync_single_guest(db, guest)
            except Exception:
                pass
        await asyncio.sleep(1)


def start_guest_sync_worker():
    global _worker_task
    try:
        loop = asyncio.get_running_loop()
        _worker_task = loop.create_task(_sync_worker())
    except RuntimeError:
        pass


def stop_guest_sync_worker():
    global _worker_task
    if _worker_task:
        _worker_task.cancel()
        _worker_task = None
