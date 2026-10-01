import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.models.subscription import Subscription
from app.models.event import Event
from app.models.notification import Notification
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp
from app.services.sms_service import send_sms
from app.core.config import settings


async def notify_subscribers(db: AsyncSession, event_id: int) -> int:
    result = await db.execute(
        select(Subscription).where(Subscription.is_active == True)
    )
    subs = result.scalars().all()

    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        return 0

    link = f"{settings.FRONTEND_URL}/events/{event.id}"
    subject = f"New Event: {event.name}"
    body = f"{event.name} is now live on Accredit!\n\n{event.description or 'No description'}\n\nView event: {link}"

    sent = 0
    for sub in subs:
        channels = [c.strip() for c in sub.channels.split(",")]
        try:
            if sub.email and "email" in channels:
                asyncio.create_task(send_email(sub.email, subject, body))
                sent += 1
            if sub.phone and "whatsapp" in channels:
                await send_whatsapp(sub.phone, body)
                sent += 1
            if sub.phone and "sms" in channels:
                await send_sms(sub.phone, body)
                sent += 1
        except Exception:
            pass

    return sent


async def send_notification(
    db: AsyncSession,
    user_id: int,
    type: str,
    title: str,
    message: str,
    data: dict | None = None,
    event_id: int | None = None,
) -> Notification:
    """Create and store a notification for a user"""
    notification = Notification(
        user_id=user_id,
        event_id=event_id,
        title=title,
        message=message,
        notification_type=type,
        data=data or {},
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    return notification
