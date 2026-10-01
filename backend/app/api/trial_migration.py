"""Trial event migration - moves localStorage trial data to dashboard after signup."""

import base64, os, re, logging
from datetime import date, time
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.services.file_upload_security import resize_and_save

logger = logging.getLogger(__name__)

router = APIRouter()


class TrialFormData(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    timezone: str = "UTC"
    venue: Optional[str] = None
    delivery_channels: List[str] = []
    template: Optional[str] = None
    extra_data: Optional[dict] = None


class TrialEventMigration(BaseModel):
    mode: str  # 'invite' or 'event'
    form: TrialFormData
    pass_packages: Optional[List[dict]] = None
    social_handles: Optional[List[dict]] = None
    lineup: Optional[List[dict]] = None
    uploaded_image_data: Optional[str] = None


@router.post("/trial/migrate")
async def migrate_trial_events(
    migrations: List[TrialEventMigration],
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Migrate trial localStorage events to database as drafts after user signup."""
    created_events = []

    for trial in migrations:
        try:
            ev_date = trial.form.event_date
            ev_time = trial.form.event_time
            parsed_date = None
            parsed_time = None
            if ev_date:
                try:
                    parsed_date = date.fromisoformat(ev_date.replace("Z", "+00:00")[:10])
                except (ValueError, TypeError):
                    logger.warning("Could not parse event_date: %s", ev_date)
            if ev_time:
                try:
                    ev_time_clean = ev_time.strip()
                    ampm = re.search(r'\s*(AM|PM)\s*$', ev_time_clean, re.IGNORECASE)
                    if ampm:
                        clean = ev_time_clean[:ampm.start()].strip()
                        parts = clean.split(':')
                        hour = int(parts[0])
                        minute = int(parts[1]) if len(parts) > 1 else 0
                        if ampm.group(1).upper() == 'PM' and hour != 12:
                            hour += 12
                        if ampm.group(1).upper() == 'AM' and hour == 12:
                            hour = 0
                        parsed_time = time(hour, minute)
                    else:
                        if len(ev_time_clean) == 5:
                            ev_time_clean += ":00"
                        parsed_time = time.fromisoformat(ev_time_clean)
                except (ValueError, TypeError):
                    logger.warning("Could not parse event_time: %s", ev_time)
            if parsed_date is None:
                parsed_date = date.today()
            if parsed_time is None:
                parsed_time = time(18, 0, 0)

            event = Event(
                organizer_id=user.id,
                title=trial.form.title,
                description=trial.form.description,
                event_date=parsed_date,
                event_time=parsed_time,
                timezone=trial.form.timezone,
                venue=trial.form.venue,
                event_type="invite" if trial.mode == "invite" else "event",
                host_name=trial.form.venue or "Trial Event",
                guest_count_range="50-500",
                status="draft",
            )

            db.add(event)
            await db.flush()

            if trial.pass_packages:
                event.pass_packages = trial.pass_packages
            if trial.lineup:
                event.lineup = trial.lineup
            if trial.uploaded_image_data:
                try:
                    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
                    os.makedirs(upload_dir, exist_ok=True)
                    img_data = trial.uploaded_image_data
                    if "," in img_data:
                        img_data = img_data.split(",")[1]
                    decoded = base64.b64decode(img_data)
                    img_filename = f"trial_upload_{event.id}.png"
                    saved = resize_and_save(decoded, os.path.join(upload_dir, img_filename))
                    if saved:
                        event.cover_image = f"/uploads/{os.path.basename(saved)}"
                except Exception as img_err:
                    logger.warning("Failed to save trial image for event %s: %s", event.id, img_err)

            created_events.append({
                "id": event.id,
                "title": event.title,
                "type": trial.mode,
                "status": "draft",
            })

        except Exception as e:
            logger.exception("Failed to migrate trial event")
            continue

    await db.commit()

    return {
        "migrated": len(created_events),
        "events": created_events,
        "message": f"Successfully migrated {len(created_events)} trial event(s) to your dashboard",
    }


@router.get("/trial/status")
async def check_trial_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if user has draft events from trial migration."""
    from sqlalchemy import select

    result = await db.execute(
        select(Event).where(
            Event.organizer_id == user.id,
            Event.status == "draft",
        )
    )
    events = result.scalars().all()

    return {
        "has_trial_events": len(events) > 0,
        "count": len(events),
        "events": [
            {
                "id": e.id,
                "title": e.title,
                "type": e.event_type,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }
