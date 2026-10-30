"""Admin control of multi-day event schedules.

Everything an operator needs to run a multi-day event without a deploy lives
here: add or remove days, open or close accreditation for a day, and read the
per-day accreditation totals. The gate and the reports read the same rows, so a
change made here is live on the next scan.

An event with no rows is a single-day event and is untouched by all of this.
"""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_action
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.checkin import CheckIn
from app.models.event import Event
from app.models.event_day import EventDay
from app.models.guest import Guest
from app.models.user import User
from app.services.event_days import day_payload, parse_day_date

router = APIRouter()


async def check_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class DayCreate(BaseModel):
    date: str
    label: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    accreditation_open: bool = True
    note: str | None = None


class DayUpdate(BaseModel):
    date: str | None = None
    label: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    accreditation_open: bool | None = None
    is_active: bool | None = None
    note: str | None = None


class DayBulkCreate(BaseModel):
    start_date: str
    count: int = 2
    label: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    # When true, an existing day on a date in the range is updated rather than
    # rejected, so re-running the bulk add is safe.
    skip_existing: bool = True


async def _get_event(db: AsyncSession, event_id: int) -> Event:
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


async def _day_summary(db: AsyncSession, event: Event) -> dict:
    """Every active day plus per-day accreditation counts and the event-wide
    totals the admin card shows next to them."""
    days = list((await db.execute(
        select(EventDay)
        .where(EventDay.event_id == event.id)
        .order_by(EventDay.date.asc(), EventDay.day_number.asc())
    )).scalars().all())

    rows = (await db.execute(
        select(CheckIn.event_day_id, func.count(func.distinct(CheckIn.guest_id)))
        .where(CheckIn.event_id == event.id, CheckIn.event_day_id.isnot(None))
        .group_by(CheckIn.event_day_id)
    )).all()
    by_day = {row[0]: row[1] for row in rows}

    total_guests = await db.scalar(
        select(func.count(Guest.id)).where(Guest.event_id == event.id, Guest.deleted_at == None)
    )
    total_checked_in = await db.scalar(
        select(func.count(func.distinct(CheckIn.guest_id))).where(CheckIn.event_id == event.id)
    )

    return {
        "event_id": event.id,
        "event_title": event.title,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "multi_day": len(days) > 0,
        "total_guests": total_guests or 0,
        "total_checked_in": total_checked_in or 0,
        "days": [day_payload(d, checked_in=by_day.get(d.id, 0)) for d in days],
    }


def _renumber(days: list[EventDay]) -> None:
    for i, d in enumerate(sorted(days, key=lambda x: (x.date, x.id)), start=1):
        d.day_number = i


@router.get("/admin/events/{event_id}/days")
async def admin_list_event_days(
    event_id: int,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await _get_event(db, event_id)
    return await _day_summary(db, event)


@router.post("/admin/events/{event_id}/days")
async def admin_add_event_day(
    event_id: int,
    req: DayCreate,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await _get_event(db, event_id)
    day_date = parse_day_date(req.date)
    if not day_date:
        raise HTTPException(status_code=400, detail="Use a date in the form YYYY-MM-DD")

    exists = await db.scalar(
        select(EventDay).where(EventDay.event_id == event_id, EventDay.date == day_date)
    )
    if exists:
        raise HTTPException(status_code=409, detail=f"{day_date.isoformat()} is already a day on this event")

    day = EventDay(
        event_id=event_id,
        date=day_date,
        label=(req.label or "").strip() or None,
        start_time=(req.start_time or "").strip() or None,
        end_time=(req.end_time or "").strip() or None,
        accreditation_open=req.accreditation_open,
        note=(req.note or "").strip() or None,
    )
    db.add(day)
    await db.flush()
    all_days = list((await db.execute(
        select(EventDay).where(EventDay.event_id == event_id)
    )).scalars().all())
    _renumber(all_days)
    await log_action(
        db, admin.id, "event_day_added", "event", event_id,
        f"Added {day_date.isoformat()}" + (f" ({day.label})" if day.label else ""),
    )
    await db.commit()
    await db.refresh(day)
    return {"ok": True, "day": day_payload(day), **(await _day_summary(db, event))}


@router.post("/admin/events/{event_id}/days/bulk")
async def admin_bulk_add_event_days(
    event_id: int,
    req: DayBulkCreate,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    """Schedule a run of consecutive days in one move (a 3 day festival is one
    call with count=3)."""
    event = await _get_event(db, event_id)
    start = parse_day_date(req.start_date)
    if not start:
        raise HTTPException(status_code=400, detail="Use a start date in the form YYYY-MM-DD")
    if req.count < 1 or req.count > 60:
        raise HTTPException(status_code=400, detail="Count must be between 1 and 60")

    existing = list((await db.execute(
        select(EventDay).where(EventDay.event_id == event_id)
    )).scalars().all())
    existing_dates = {d.date for d in existing}
    added, skipped = 0, []

    for offset in range(req.count):
        day_date = start + timedelta(days=offset)
        if day_date in existing_dates:
            skipped.append(day_date.isoformat())
            continue
        db.add(EventDay(
            event_id=event_id,
            date=day_date,
            label=(req.label or "").strip() or None,
            start_time=(req.start_time or "").strip() or None,
            end_time=(req.end_time or "").strip() or None,
            accreditation_open=True,
        ))
        added += 1

    await db.flush()
    all_days = list((await db.execute(
        select(EventDay).where(EventDay.event_id == event_id)
    )).scalars().all())
    _renumber(all_days)
    await log_action(
        db, admin.id, "event_days_bulk_added", "event", event_id,
        f"Scheduled {added} day(s) from {start.isoformat()}",
    )
    await db.commit()
    return {"ok": True, "added": added, "skipped": skipped, **(await _day_summary(db, event))}


@router.patch("/admin/events/{event_id}/days/{day_id}")
async def admin_update_event_day(
    event_id: int,
    day_id: int,
    req: DayUpdate,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    event = await _get_event(db, event_id)
    day = await db.get(EventDay, day_id)
    if not day or day.event_id != event_id:
        raise HTTPException(status_code=404, detail="Day not found for this event")

    changes: list[str] = []
    if req.date is not None:
        new_date = parse_day_date(req.date)
        if not new_date:
            raise HTTPException(status_code=400, detail="Use a date in the form YYYY-MM-DD")
        clash = await db.scalar(
            select(EventDay).where(
                EventDay.event_id == event_id, EventDay.date == new_date, EventDay.id != day_id
            )
        )
        if clash:
            raise HTTPException(status_code=409, detail=f"{new_date.isoformat()} is already a day on this event")
        changes.append(f"date {day.date.isoformat()} -> {new_date.isoformat()}")
        day.date = new_date
    if req.label is not None:
        day.label = req.label.strip() or None
        changes.append(f"label {day.label or 'Day N'}")
    if req.start_time is not None:
        day.start_time = req.start_time.strip() or None
    if req.end_time is not None:
        day.end_time = req.end_time.strip() or None
    if req.note is not None:
        day.note = req.note.strip() or None
    if req.accreditation_open is not None:
        changes.append("accreditation " + ("open" if req.accreditation_open else "closed"))
        day.accreditation_open = req.accreditation_open
    if req.is_active is not None:
        changes.append("day " + ("active" if req.is_active else "inactive"))
        day.is_active = req.is_active

    all_days = list((await db.execute(
        select(EventDay).where(EventDay.event_id == event_id)
    )).scalars().all())
    _renumber(all_days)
    await log_action(
        db, admin.id, "event_day_updated", "event", event_id,
        "; ".join(changes) or "day updated",
    )
    await db.commit()
    await db.refresh(day)
    return {"ok": True, "day": day_payload(day), **(await _day_summary(db, event))}


@router.delete("/admin/events/{event_id}/days/{day_id}")
async def admin_delete_event_day(
    event_id: int,
    day_id: int,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a day. Check-ins recorded against it are kept (the column is
    SET NULL) so deleting a day never destroys attendance history."""
    event = await _get_event(db, event_id)
    day = await db.get(EventDay, day_id)
    if not day or day.event_id != event_id:
        raise HTTPException(status_code=404, detail="Day not found for this event")

    snapshot = {"date": day.date.isoformat(), "label": day.label}
    await db.delete(day)
    await db.flush()

    all_days = list((await db.execute(
        select(EventDay).where(EventDay.event_id == event_id)
    )).scalars().all())
    _renumber(all_days)

    # Tell the operator when the schedule is now empty, because the event has
    # silently gone back to single-day behaviour.
    await log_action(
        db, admin.id, "event_day_deleted", "event", event_id,
        f"Removed {snapshot['date']}" + (f" ({snapshot['label']})" if snapshot["label"] else ""),
    )
    await db.commit()
    return {"ok": True, **(await _day_summary(db, event))}
