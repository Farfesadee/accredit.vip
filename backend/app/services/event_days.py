"""Multi-day event helpers shared by the gate, the reports and the admin API.

A single-day event has no `event_days` rows at all and every helper here returns
the neutral answer, so nothing about an existing event changes.
"""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select

from app.models.event_day import EventDay

# Nigeria has no daylight saving, so a fixed offset is exact and keeps the server
# free of a tzdata dependency.
WAT = timezone(timedelta(hours=1))

NO_DAY_TODAY = "no_day_today"
DAY_CLOSED = "day_closed"
INVALID_DAY = "invalid_day"


def local_today() -> date:
    return datetime.now(WAT).date()


def local_now() -> datetime:
    return datetime.now(WAT)


def day_name(day) -> str:
    """The custom label, else "Day N"."""
    if day is None:
        return ""
    return (day.label or "").strip() or f"Day {day.day_number}"


def day_heading(day) -> str:
    """`Day 2 (Sat 12 Dec)` for guest and operator messages."""
    if day is None:
        return ""
    return f"{day_name(day)} ({day.date.strftime('%a %d %b')})"


def parse_day_date(raw):
    if not raw:
        return None
    if isinstance(raw, date):
        return raw
    try:
        return datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


async def list_days(db, event_id: int, include_inactive: bool = False):
    stmt = select(EventDay).where(EventDay.event_id == event_id)
    if not include_inactive:
        stmt = stmt.where(EventDay.is_active.is_(True))
    stmt = stmt.order_by(EventDay.date.asc(), EventDay.day_number.asc())
    return list((await db.execute(stmt)).scalars().all())


async def resolve_day(db, event, day_id=None, day_date=None):
    """Work out which day a scan or a report belongs to.

    Returns `(day, error, days)`:
      day    the resolved EventDay, or None for a single-day event
      error  None, NO_DAY_TODAY, DAY_CLOSED or INVALID_DAY
      days    every active day on the event (empty for single-day events)
    """
    days = await list_days(db, event.id)
    if not days:
        return None, None, days

    wanted = parse_day_date(day_date)
    if day_id not in (None, ""):
        try:
            wanted_id = int(day_id)
        except (TypeError, ValueError):
            return None, INVALID_DAY, days
        day = next((d for d in days if d.id == wanted_id), None)
    elif wanted:
        day = next((d for d in days if d.date == wanted), None)
    else:
        day = next((d for d in days if d.date == local_today()), None)
        if day is None:
            return None, NO_DAY_TODAY, days

    if day is None:
        return None, INVALID_DAY, days
    if not day.accreditation_open:
        return day, DAY_CLOSED, days
    return day, None, days


def event_window_end(event, days=None):
    """Last moment the event still counts as live, so a three-day run is not
    blocked the morning after day one."""
    candidates = [d.date for d in (days or []) if d.date]
    if event.event_date:
        candidates.append(event.event_date)
    if not candidates:
        return None
    return datetime.combine(max(candidates), time.max, tzinfo=timezone.utc)


def day_payload(day, checked_in=None):
    """Shape one day for an API response."""
    if day is None:
        return None
    payload = {
        "id": day.id,
        "day_number": day.day_number,
        "date": day.date.isoformat(),
        "label": day.label,
        "name": day_name(day),
        "heading": day_heading(day),
        "start_time": day.start_time,
        "end_time": day.end_time,
        "accreditation_open": bool(day.accreditation_open),
        "is_active": bool(day.is_active),
        "is_today": day.date == local_today(),
        "note": day.note,
    }
    if checked_in is not None:
        payload["checked_in"] = checked_in
    return payload


def day_error_message(error, day=None) -> str:
    """Operator-facing wording for the three blocking states."""
    if error == DAY_CLOSED:
        return f"Accreditation is closed for {day_heading(day)}."
    if error == INVALID_DAY:
        return "That day is not part of this event."
    return (
        "This is a multi-day event and no day is open for today. "
        "Pick the day you are accrediting from the day selector."
    )
