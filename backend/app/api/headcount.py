"""Headcount events.

Some events have no guest list at all. A single QR is printed on every
wristband, the accreditation team scans it at the gate, and every scan is one
person in. Nothing is matched, nothing is deduplicated, and the only output
that matters is the running count.

Everything in this module is scoped to events whose `headcount_mode` flag is
on. Every other event keeps the guest-based flow it already has.
"""

import csv
import io
from datetime import datetime, time, timedelta, timezone
from urllib.parse import parse_qs, unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.event import Event
from app.models.headcount import HeadcountScan
from app.models.headcount_code import HeadcountCode
from app.models.user import User
from app.services.event_days import (
    DAY_CLOSED,
    INVALID_DAY,
    NO_DAY_TODAY,
    WAT,
    day_error_message,
    day_payload,
    list_days,
    local_now,
    local_today,
    parse_day_date,
)
from app.services.qr_service import generate_qr_code

router = APIRouter()

ADMIN_ROLES = {"admin", "super_admin"}

# A club night that starts at 7 PM is still running at 00:30. Up to this hour
# the gate keeps counting against the previous night instead of closing.
SPILLOVER_HOUR = 6


class HeadcountScanRequest(BaseModel):
    token: str
    location: str | None = None
    event_day_id: int | None = None
    day_date: str | None = None


class HeadcountUndoRequest(BaseModel):
    scan_id: int | None = None
    event_day_id: int | None = None


def _is_admin(user: User) -> bool:
    return (user.role or "") in ADMIN_ROLES


async def _owned_event(db: AsyncSession, event_id: int, user: User) -> Event:
    """An event the caller may administrate. 404 for everyone else so an
    organizer cannot probe another account's dashboard."""
    event = await db.get(Event, event_id)
    if not event or not event.headcount_mode:
        raise HTTPException(status_code=404, detail="Headcount event not found")
    if event.organizer_id != user.id and not _is_admin(user):
        raise HTTPException(status_code=404, detail="Headcount event not found")
    return event


def _event_payload(event: Event) -> dict:
    return {
        "id": event.id,
        "title": event.title,
        "slug": event.slug,
        "venue": event.venue,
        "city": event.city,
        "host_name": event.host_name,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "event_time": event.event_time.strftime("%H:%M") if event.event_time else None,
        "theme_color": event.theme_color or "#E31E24",
        "cover_image": event.cover_image,
        "target": event.headcount_target,
    }


def qr_target(event: Event) -> str:
    base = (settings.FRONTEND_URL or "https://accredit.vip").rstrip("/")
    return f"{base}/h/{event.slug}"


def _slug_from_token(token: str) -> str:
    """Accept the QR as printed (`https://accredit.vip/h/slug`), the bare URL
    path, or the plain slug, and pull the slug out of any of them."""
    raw = unquote((token or "").strip())
    raw = raw.split("?")[0].split("#")[0].rstrip("/")
    if "/h/" in raw:
        return raw.split("/h/")[-1].strip("/")
    if raw.startswith("http"):
        return raw.split("/")[-1]
    if "/" in raw:
        return raw.split("/")[-1]
    return raw


def _code_from_token(token: str) -> str | None:
    """Pull the unique wristband code out of a QR URL's query string."""
    raw = unquote((token or "").strip())
    parsed = urlparse(raw)
    for key, value in parse_qs(parsed.query).items():
        if key.lower() == "c" and value and value[0].strip():
            return value[0].strip().upper()
    return None


async def _free_scan_code(db: AsyncSession, scan: HeadcountScan) -> None:
    """Undo releases that wristband so it can be scanned again."""
    if not scan.code:
        return
    wristband = (
        await db.execute(
            select(HeadcountCode).where(
                HeadcountCode.code == scan.code, HeadcountCode.event_id == scan.event_id
            )
        )
    ).scalars().first()
    if wristband is not None:
        wristband.is_used = False
        wristband.used_at = None


async def _headcount_event_for_token(db: AsyncSession, token: str) -> Event | None:
    slug = _slug_from_token(token)
    if not slug:
        return None
    event = (
        await db.execute(select(Event).where(Event.slug == slug))
    ).scalars().first()
    if event is None:
        event = (
            await db.execute(select(Event).where(func.lower(Event.slug) == slug.lower()))
        ).scalars().first()
    if event is None or not event.headcount_mode:
        return None
    return event


def _resolve_night(days, day_id=None, day_date=None):
    """Work out which night a scan belongs to.

    Mirrors the multi-day resolver used by the guest gate, with one addition:
    between midnight and 6 AM the previous night stays open, so a wristband
    scanned at 00:40 still lands on the Monday it belongs to.
    """
    if not days:
        return None, None

    wanted = parse_day_date(day_date)
    if day_id not in (None, ""):
        try:
            wanted_id = int(day_id)
        except (TypeError, ValueError):
            return None, INVALID_DAY
        day = next((d for d in days if d.id == wanted_id), None)
    elif wanted:
        day = next((d for d in days if d.date == wanted), None)
    else:
        now = local_now()
        day = next((d for d in days if d.date == now.date()), None)
        if day is None and now.hour < SPILLOVER_HOUR:
            yesterday = now.date() - timedelta(days=1)
            day = next((d for d in days if d.date == yesterday), None)
        if day is None:
            return None, NO_DAY_TODAY

    if day is None:
        return None, INVALID_DAY
    if not day.accreditation_open:
        return day, DAY_CLOSED
    return day, None


def _night_window(day_date):
    start = datetime.combine(day_date, time.min, tzinfo=WAT)
    return start, start + timedelta(days=1)


def _hour_window(counts: list[int]) -> list[int]:
    """The hours worth drawing for one night.

    A 7 PM party produces data between 19 and 23 plus the odd 0-2. Showing all
    24 bars is mostly blank, so the biggest empty stretch is cut out and the
    remaining hours are returned in the order a guest experiences them.
    """
    if not any(counts):
        return [18, 19, 20, 21, 22, 23, 0, 1]

    n = 24
    best_start, best_len = 0, 0
    i = 0
    while i < n:
        if counts[i] == 0:
            j = i
            while j < n and counts[j] == 0:
                j += 1
            if j - i > best_len:
                best_len, best_start = j - i, i
            i = j
        else:
            i += 1

    lead = 0
    while lead < n and counts[lead] == 0:
        lead += 1
    trail = 0
    while trail < n and counts[n - 1 - trail] == 0:
        trail += 1
    if lead < n and lead + trail > best_len:
        best_len, best_start = lead + trail, n - trail

    if best_len <= 1:
        return list(range(n))

    start = (best_start + best_len) % n
    length = n - best_len
    return [(start + idx) % n for idx in range(length)]


async def _last_scanned_day(db: AsyncSession, event_id: int):
    row = (
        await db.execute(
            select(HeadcountScan.event_day_id)
            .where(HeadcountScan.event_id == event_id)
            .order_by(HeadcountScan.created_at.desc())
            .limit(1)
        )
    ).first()
    return row[0] if row else None


async def _scope_day(db: AsyncSession, event: Event, days, day_id=None, day_date=None):
    """Which night the dashboard and the gate open on by default.

    Today's night if there is one, otherwise the night that was last scanned
    (a Tuesday morning still shows Monday's numbers), otherwise the next night
    coming up.
    """
    if day_id not in (None, ""):
        try:
            wanted = int(day_id)
        except (TypeError, ValueError):
            return None
        return next((d for d in days if d.id == wanted), None)
    wanted_date = parse_day_date(day_date)
    if wanted_date:
        return next((d for d in days if d.date == wanted_date), None)

    today = local_today()
    today_day = next((d for d in days if d.date == today), None)
    if today_day:
        return today_day

    last_id = await _last_scanned_day(db, event.id)
    if last_id:
        last_day = next((d for d in days if d.id == last_id), None)
        if last_day and last_day.date >= today - timedelta(days=8):
            return last_day

    upcoming = [d for d in days if d.date > today]
    if upcoming:
        return upcoming[0]
    return days[-1] if days else None


async def _count(db: AsyncSession, event_id: int, day_id: int | None = None) -> int:
    stmt = select(func.count(HeadcountScan.id)).where(HeadcountScan.event_id == event_id)
    if day_id is not None:
        stmt = stmt.where(HeadcountScan.event_day_id == day_id)
    return int(await db.scalar(stmt) or 0)


async def _stats(db: AsyncSession, event: Event, day=None) -> dict:
    days = await list_days(db, event.id)

    per_day_rows = (
        await db.execute(
            select(HeadcountScan.event_day_id, func.count(HeadcountScan.id))
            .where(HeadcountScan.event_id == event.id)
            .group_by(HeadcountScan.event_day_id)
        )
    ).all()
    per_day = {row[0]: int(row[1]) for row in per_day_rows}

    total = await _count(db, event.id)

    today = local_today()
    today_day = next((d for d in days if d.date == today), None)
    if today_day is not None:
        today_total = per_day.get(today_day.id, 0)
    else:
        start, end = _night_window(today)
        today_total = int(
            await db.scalar(
                select(func.count(HeadcountScan.id)).where(
                    HeadcountScan.event_id == event.id,
                    HeadcountScan.created_at >= start,
                    HeadcountScan.created_at < end,
                )
            )
            or 0
        )

    night_total = per_day.get(day.id, 0) if day is not None else total

    scan_stmt = select(HeadcountScan).where(HeadcountScan.event_id == event.id)
    if day is not None:
        scan_stmt = scan_stmt.where(HeadcountScan.event_day_id == day.id)
    scans = list(
        (await db.execute(scan_stmt.order_by(HeadcountScan.created_at.asc()))).scalars().all()
    )

    counts = [0] * 24
    gates: dict[str, int] = {}
    for scan in scans:
        if scan.created_at is not None:
            counts[scan.created_at.astimezone(WAT).hour] += 1
        gate = (scan.location or "").strip() or "Main gate"
        gates[gate] = gates.get(gate, 0) + 1

    hourly = [{"hour": hour, "count": counts[hour]} for hour in _hour_window(counts)]
    gate_rows = sorted(
        ({"location": name, "count": value} for name, value in gates.items()),
        key=lambda row: (-row["count"], row["location"]),
    )

    recent_scans = []
    staff_ids = {s.scanned_by for s in scans if s.scanned_by}
    staff_names: dict[int, str] = {}
    if staff_ids:
        for user_id, full_name in (
            await db.execute(select(User.id, User.full_name).where(User.id.in_(staff_ids)))
        ).all():
            staff_names[user_id] = full_name

    for scan in list(reversed(scans))[:30]:
        recent_scans.append(
            {
                "id": scan.id,
                "scanned_at": scan.created_at.isoformat() if scan.created_at else None,
                "location": (scan.location or "").strip() or "Main gate",
                "staff": staff_names.get(scan.scanned_by) if scan.scanned_by else None,
                "day_id": scan.event_day_id,
                "code": scan.code,
            }
        )

    last_scan_at = scans[-1].created_at.isoformat() if scans and scans[-1].created_at else None

    day_rows = []
    for d in days:
        payload = day_payload(d)
        payload["count"] = per_day.get(d.id, 0)
        day_rows.append(payload)

    return {
        "headcount": True,
        "event": _event_payload(event),
        "total": total,
        "night_total": night_total,
        "today_total": today_total,
        "selected_day": day_payload(day) if day is not None else None,
        "days": day_rows,
        "hourly": hourly,
        "gates": gate_rows,
        "recent": recent_scans,
        "last_scan_at": last_scan_at,
        "target": event.headcount_target,
        "qr_target": qr_target(event),
    }


@router.get("/headcount/event/{slug}")
async def public_headcount_event(slug: str, db: AsyncSession = Depends(get_db)):
    """Public, anonymous view of a headcount event.

    This is what a guest sees if they point their own phone camera at the
    wristband. It never records anything: counting only happens when the
    accreditation team scans, so a guest opening this page cannot inflate the
    numbers or believe they are already inside.
    """
    event = (
        await db.execute(select(Event).where(Event.slug == slug))
    ).scalars().first()
    if event is None or not event.headcount_mode:
        raise HTTPException(status_code=404, detail="Event not found")

    days = [d for d in await list_days(db, event.id) if d.date >= local_today()]
    return {
        **_event_payload(event),
        "headcount": True,
        "next_dates": [
            {"date": d.date.isoformat(), "label": d.label, "start_time": d.start_time}
            for d in days[:8]
        ],
        "qr_target": qr_target(event),
    }


@router.post("/headcount/scan")
async def record_headcount_scan(
    req: HeadcountScanRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record one entry. Every call counts: there is nothing to match.

    Same trust model as the rest of the gate: any signed-in accreditation user
    may count, because the accreditation team does the scanning and is not
    necessarily the organizer. The wristband itself is the credential.
    """
    event = await _headcount_event_for_token(db, req.token)
    if event is None:
        raise HTTPException(status_code=404, detail="This QR is not a headcount pass.")

    # Unique wristband codes admit one person each. A code that is unknown or
    # already used must never add to the running count.
    code = _code_from_token(req.token)
    wristband = None
    if code:
        wristband = (
            await db.execute(
                select(HeadcountCode).where(
                    HeadcountCode.code == code, HeadcountCode.event_id == event.id
                )
            )
        ).scalars().first()
        if wristband is None:
            return {
                "status": "invalid_code",
                "message": f"Wristband code {code} is not recognised.",
                "code": code,
            }
        if wristband.is_used:
            return {
                "status": "already_used",
                "message": f"Wristband code {code} was already used at the gate.",
                "code": code,
                "used_at": wristband.used_at.isoformat() if wristband.used_at else None,
            }

    days = await list_days(db, event.id)
    day, error = _resolve_night(days, req.event_day_id, req.day_date)

    if error:
        return {
            "status": error,
            "message": day_error_message(error, day),
            "day": day_payload(day) if day is not None else None,
            "days": [day_payload(d) for d in days],
        }

    now_utc = datetime.now(timezone.utc)
    last_day = max((d.date for d in days), default=event.event_date)
    if datetime.combine(last_day, time.max, tzinfo=WAT) < now_utc:
        return {
            "status": "event_ended",
            "message": f"'{event.title}' has already ended.",
        }

    scan = HeadcountScan(
        event_id=event.id,
        event_day_id=day.id if day is not None else None,
        scanned_by=user.id,
        location=(req.location or "").strip() or "Main gate",
        device_info=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        code=code,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    if wristband is not None:
        wristband.is_used = True
        wristband.used_at = scan.created_at
        await db.commit()

    night_total = await _count(db, event.id, day.id if day is not None else None)
    total = await _count(db, event.id)

    return {
        "status": "counted",
        "message": "Entry recorded",
        "scan_id": scan.id,
        "scanned_at": scan.created_at.isoformat() if scan.created_at else None,
        "night_total": night_total,
        "total": total,
        "code": code,
        "day": day_payload(day) if day is not None else None,
        "event": _event_payload(event),
    }


@router.get("/scanner/events/{event_id}/headcount")
async def scanner_headcount_stats(
    event_id: int,
    event_day_id: int = 0,
    day_date: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Live numbers for the gate. Same trust model as the rest of the scanner:
    any signed-in accreditation user may read them."""
    event = await db.get(Event, event_id)
    if not event or not event.headcount_mode:
        raise HTTPException(status_code=404, detail="Headcount event not found")

    days = await list_days(db, event.id)
    day = await _scope_day(db, event, days, event_day_id or None, day_date or None)
    return await _stats(db, event, day)


@router.get("/headcount/events/{event_id}")
async def organizer_headcount_stats(
    event_id: int,
    event_day_id: int = 0,
    day_date: str = "",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The organizer dashboard. Owner or platform admin only."""
    event = await _owned_event(db, event_id, user)
    days = await list_days(db, event.id)
    day = await _scope_day(db, event, days, event_day_id or None, day_date or None)
    return await _stats(db, event, day)


@router.post("/headcount/events/{event_id}/undo")
async def undo_headcount_scan(
    event_id: int,
    req: HeadcountUndoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a mistaken entry (a scan of the poster itself, or a double tap)."""
    event = await _owned_event(db, event_id, user)

    if req.scan_id:
        scan = await db.get(HeadcountScan, req.scan_id)
        if scan is None or scan.event_id != event.id:
            raise HTTPException(status_code=404, detail="Scan not found")
    else:
        stmt = select(HeadcountScan).where(HeadcountScan.event_id == event.id)
        if req.event_day_id:
            stmt = stmt.where(HeadcountScan.event_day_id == req.event_day_id)
        scan = (
            await db.execute(stmt.order_by(HeadcountScan.created_at.desc()).limit(1))
        ).scalars().first()
        if scan is None:
            raise HTTPException(status_code=404, detail="There is nothing to undo yet")

    removed_day = scan.event_day_id
    await _free_scan_code(db, scan)
    await db.delete(scan)
    await db.commit()

    days = await list_days(db, event.id)
    day = next((d for d in days if d.id == removed_day), None)
    stats = await _stats(db, event, day)
    return {"removed": True, **stats}


@router.post("/scanner/headcount/undo")
async def scanner_undo_headcount(
    req: HeadcountScanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Undo one entry from the gate.

    A mis-scan (the poster instead of a wristband, or a wristband read through
    a pocket) has to be removable by the person standing at the door, so this
    follows the scanner trust model rather than the organizer one.
    """
    event = await _headcount_event_for_token(db, req.token)
    if event is None:
        raise HTTPException(status_code=404, detail="This QR is not a headcount pass.")

    stmt = select(HeadcountScan).where(HeadcountScan.event_id == event.id)
    if req.event_day_id:
        stmt = stmt.where(HeadcountScan.event_day_id == req.event_day_id)
    scan = (
        await db.execute(stmt.order_by(HeadcountScan.created_at.desc()).limit(1))
    ).scalars().first()
    if scan is None:
        return {"status": "noop", "message": "There is nothing to undo yet."}

    removed_day = scan.event_day_id
    await _free_scan_code(db, scan)
    await db.delete(scan)
    await db.commit()

    days = await list_days(db, event.id)
    day = next((d for d in days if d.id == removed_day), None)
    stats = await _stats(db, event, day)
    return {"status": "undone", "message": "Entry removed", **stats}


@router.get("/headcount/events/{event_id}/export.csv")
async def export_headcount_csv(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await _owned_event(db, event_id, user)
    days = {d.id: d for d in await list_days(db, event.id, include_inactive=True)}

    scans = list(
        (
            await db.execute(
                select(HeadcountScan)
                .where(HeadcountScan.event_id == event.id)
                .order_by(HeadcountScan.created_at.asc())
            )
        ).scalars().all()
    )

    staff_ids = {s.scanned_by for s in scans if s.scanned_by}
    staff_names: dict[int, str] = {}
    if staff_ids:
        for user_id, full_name in (
            await db.execute(select(User.id, User.full_name).where(User.id.in_(staff_ids)))
        ).all():
            staff_names[user_id] = full_name

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Scan ID", "Date (WAT)", "Time (WAT)", "Night", "Gate", "Scanned by", "Wristband code"])
    for scan in scans:
        local = scan.created_at.astimezone(WAT) if scan.created_at else None
        night = days.get(scan.event_day_id) if scan.event_day_id else None
        writer.writerow(
            [
                scan.id,
                local.strftime("%Y-%m-%d") if local else "",
                local.strftime("%H:%M:%S") if local else "",
                (night.label if night and night.label else (night.date.isoformat() if night else "")),
                (scan.location or "").strip() or "Main gate",
                staff_names.get(scan.scanned_by, "") if scan.scanned_by else "",
                scan.code or "",
            ]
        )

    stamp = local_today().strftime("%Y%m%d")
    slug = event.slug or f"event-{event.id}"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{slug}-headcount-{stamp}.csv"'
        },
    )


@router.get("/headcount/events/{event_id}/qr.png")
async def headcount_qr_image(
    event_id: int,
    size: int = 1200,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The shared wristband QR, as a clean PNG.

    Deliberately plain: a logo in the middle of a code this small is what makes
    a phone camera fail on a wristband.
    """
    event = await _owned_event(db, event_id, user)
    clean = max(300, min(int(size or 1200), 2400))
    image = generate_qr_code(qr_target(event), clean)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )
