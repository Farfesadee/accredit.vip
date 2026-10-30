import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, time
from pydantic import BaseModel

from app.core.database import get_db
from app.models.qr_code import QRCode
from app.models.checkin import CheckIn
from app.models.guest import Guest
from app.models.event import Event
from app.models.scan_attempt import ScanAttempt
from app.models.event_day import EventDay
from app.core.security import get_current_user, verify_password, create_access_token
from app.models.user import User
from app.core.config import settings
from app.services.event_days import (
    day_error_message,
    day_payload,
    event_window_end,
    list_days,
    resolve_day,
)

router = APIRouter()


def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return phone
    cleaned = re.sub(r'\D', '', phone)
    if len(cleaned) <= 6:
        return cleaned[:3] + '***' + cleaned[-1:] if len(cleaned) > 3 else cleaned
    return cleaned[:4] + '***' + cleaned[-3:]


def _mask_email(email: str | None) -> str | None:
    if not email or '@' not in email:
        return email
    local, domain = email.rsplit('@', 1)
    if len(local) <= 2:
        return local[0] + '***@' + domain
    return local[0] + '***' + local[-1] + '@' + domain


def _clean_gate_name(name: str | None) -> str:
    """Trim + collapse whitespace. Returns '' when there is no real name."""
    return re.sub(r"\s+", " ", (name or "").strip())


def _normalize_gate_phone(phone: str | None) -> str | None:
    """Best-effort E.164 normalization (Nigeria default). Returns the
    stripped original when it cannot be confidently normalized."""
    if not phone:
        return None
    compact = re.sub(r"[\s().-]", "", phone.strip())
    if not compact:
        return None
    if compact.startswith("+"):
        digits = re.sub(r"\D", "", compact[1:])
        return f"+{digits}" if 7 <= len(digits) <= 15 else compact
    digits = re.sub(r"\D", "", compact)
    if len(digits) == 11 and digits.startswith("0"):
        return "+234" + digits[1:]
    if len(digits) == 10 and digits.startswith(("7", "8", "9")):
        return "+234" + digits
    if len(digits) == 13 and digits.startswith("234"):
        return "+" + digits
    if 7 <= len(digits) <= 15:
        return "+" + digits
    return compact


def _clean_gate_email(email: str | None) -> str | None:
    cleaned = (email or "").strip().lower()
    if not cleaned or "@" not in cleaned or " " in cleaned:
        return None
    return cleaned


class GateGuestAdd(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    category: str | None = None


class GateBulkAdd(BaseModel):
    guests: list[GateGuestAdd]


class UndoCheckinRequest(BaseModel):
    guest_id: int
    # Optional: undo only this day's check-in on a multi-day event. Omitted on a
    # single-day event, which keeps the old "undo everything" behaviour.
    event_day_id: int | None = None


@router.post("/scanner/checkin/undo")
async def scanner_undo_checkin(
    req: UndoCheckinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reverse a mistaken check-in: removes the check-in record(s) and frees
    the guest's QR code(s) so they scan green again. Same trust model as
    scanner check-in (any authenticated user). Check-in history
    (scan_attempts) is preserved for audit."""
    guest = await db.get(Guest, req.guest_id)
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    ci_stmt = select(CheckIn).where(CheckIn.guest_id == guest.id, CheckIn.event_id == guest.event_id)
    if req.event_day_id:
        ci_stmt = ci_stmt.where(CheckIn.event_day_id == req.event_day_id)
    checkins = (await db.execute(ci_stmt)).scalars().all()
    if not checkins:
        return {"status": "noop", "message": f"{guest.name} is not checked in."}
    for c in checkins:
        await db.delete(c)
    # A day-scoped undo must leave the pass usable for the other days, so the
    # QR is only freed when no check-in remains at all.
    remaining = (await db.execute(
        select(func.count(CheckIn.id)).where(
            CheckIn.guest_id == guest.id, CheckIn.event_id == guest.event_id
        )
    )).scalar() or 0
    if remaining == 0:
        qrs = (await db.execute(
            select(QRCode).where(QRCode.guest_id == guest.id, QRCode.event_id == guest.event_id)
        )).scalars().all()
        for q in qrs:
            q.is_used = False
    await db.commit()
    return {"status": "undone", "message": f"Check-in reversed for {guest.name}."}


def _gate_guest_dict(g: Guest) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "phone": g.phone,
        "email": g.email,
        "category": g.category,
        "rsvp_status": g.rsvp_status,
        "invited_by": g.invited_by,
        "checked_in": False,
    }


@router.post("/scanner/events/{event_id}/guests/quick-add")
async def scanner_quick_add(
    event_id: int,
    req: GateGuestAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Gate walk-in add: creates a guest live so they are immediately
    searchable and check-in-able. Same trust model as scanner check-in
    (any authenticated user)."""
    from app.api.guests import ensure_guest_capacity

    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    name = _clean_gate_name(req.name)
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    await ensure_guest_capacity(db, event, 1)
    guest = Guest(
        event_id=event_id,
        name=name,
        phone=_normalize_gate_phone(req.phone),
        email=_clean_gate_email(req.email),
        category=(req.category or "").strip() or None,
        rsvp_status="accepted",
        invited_by="Gate Quick-Add",
    )
    db.add(guest)
    await db.commit()
    await db.refresh(guest)
    return {"guest": _gate_guest_dict(guest)}


@router.post("/scanner/events/{event_id}/guests/bulk-add")
async def scanner_bulk_add(
    event_id: int,
    req: GateBulkAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bulk gate add (up to 500 rows per call): same cleaning as quick-add,
    skips blank names, dedupes within the batch by name+contact."""
    from app.api.guests import ensure_guest_capacity

    if len(req.guests) > 500:
        raise HTTPException(status_code=400, detail="Max 500 guests per upload")
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await ensure_guest_capacity(db, event, len(req.guests))
    added = []
    skipped = []
    seen = set()
    for idx, row in enumerate(req.guests):
        name = _clean_gate_name(row.name)
        if not name:
            skipped.append({"row": idx + 1, "reason": "blank name"})
            continue
        email = _clean_gate_email(row.email)
        phone = _normalize_gate_phone(row.phone)
        # Same name + same email = same person even if one row lacks the
        # phone; different names sharing an inbox stay separate.
        key = (name.lower(), (email or "").lower()) if email else (name.lower(), phone or "")
        if key in seen:
            skipped.append({"row": idx + 1, "name": name, "reason": "duplicate row"})
            continue
        seen.add(key)
        guest = Guest(
            event_id=event_id,
            name=name,
            phone=phone,
            email=email,
            category=(row.category or "").strip() or None,
            rsvp_status="accepted",
            invited_by="Gate Quick-Add",
        )
        db.add(guest)
        added.append(guest)
    await db.commit()
    for g in added:
        await db.refresh(g)
    return {
        "added": len(added),
        "skipped": skipped,
        "guests": [_gate_guest_dict(g) for g in added[:20]],
    }


@router.get("/scanner/check-access")
async def scanner_check_access(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event_count = await db.scalar(select(func.count(Event.id)).where(Event.organizer_id == user.id))
    return {
        "access_granted": True,
        "event_count": event_count or 0,
        "message": "Accreditation access is available on your current plan." if event_count > 0 else "Create an event first to use accreditation.",
    }


ACCREDITATION_CREDENTIALS = {
    "email": "accreditation@accredit.vip",
    "password": "Accredit123!",
}


class AccreditationLoginRequest(BaseModel):
    email: str
    password: str


@router.post("/scanner/accreditation-login")
async def accreditation_login(req: AccreditationLoginRequest, db: AsyncSession = Depends(get_db)):
    if req.email != ACCREDITATION_CREDENTIALS["email"] or req.password != ACCREDITATION_CREDENTIALS["password"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = await db.scalar(select(User).where(User.email == req.email))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "user": {"id": user.id, "email": user.email, "full_name": user.full_name},
    }


class ScanTokenRequest(BaseModel):
    token: str | None = None
    guest_id: int | None = None
    location: str | None = None
    # Which day the gate is accrediting for. Both optional: on a single-day
    # event they are ignored, and on a multi-day event they fall back to today.
    event_day_id: int | None = None
    day_date: str | None = None


def _event_has_passed(event, days=None) -> bool:
    """A multi-day run stays live until its last scheduled day ends."""
    event_end = event_window_end(event, days)
    if event_end is None:
        return False
    return event_end < datetime.now(timezone.utc)


def _event_block(event, day=None) -> dict:
    block = {"id": event.id, "title": event.title}
    if day is not None:
        block["day"] = day_payload(day)
    return block


async def _resolve_guest_and_event(token: str, db: AsyncSession):
    """Resolve guest + event from QR code record or fallback to guest rsvp_token lookup."""
    import urllib.parse
    normalized = urllib.parse.unquote(token)
    variants = [token]
    if normalized != token:
        variants.append(normalized)

    qr = None
    for v in variants:
        result = await db.execute(select(QRCode).where(QRCode.token == v))
        qr = result.scalar_one_or_none()
        if qr:
            break

    guest = None
    event = None

    if qr:
        guest = await db.get(Guest, qr.guest_id)
        event = await db.get(Event, qr.event_id)
    else:
        for v in variants:
            g_result = await db.execute(select(Guest).where(Guest.rsvp_token == v))
            guest = g_result.scalar_one_or_none()
            if guest:
                event = await db.get(Event, guest.event_id)
                break

    # Fallback: if still not found, try matching by card ID from green envelope URLs
    if not qr and not guest:
        for v in variants:
            if "greenvelope.com/card/" in v:
                card_id = v.split("/card/")[-1].split("?")[0].split("%")[0]
                if card_id:
                    result = await db.execute(
                        select(QRCode).where(QRCode.token.ilike("%" + card_id + "%"))
                    )
                    qr = result.scalar_one_or_none()
                    if qr:
                        guest = await db.get(Guest, qr.guest_id)
                        event = await db.get(Event, qr.event_id)
                        break

    return qr, guest, event


@router.post("/scanner/verify")
async def scanner_verify_token(req: ScanTokenRequest, request: Request, db: AsyncSession = Depends(get_db)):
    raw_token = req.token.strip()
    qr, guest, event = await _resolve_guest_and_event(raw_token, db)

    if not qr and not guest and "/" in raw_token:
        fallback = raw_token.split("/")[-1]
        qr, guest, event = await _resolve_guest_and_event(fallback, db)

    if not guest or not event:
        return {"valid": False, "reason": "invalid", "message": "Invalid QR code"}

    # Single-day events resolve to day=None and keep their exact old behaviour.
    day, day_error, days = await resolve_day(db, event, req.event_day_id, req.day_date)

    already_checked_in = False
    previous_checkin = None
    if event and guest:
        dup = select(CheckIn).where(CheckIn.guest_id == guest.id, CheckIn.event_id == event.id)
        if day is not None:
            # One scan per guest per day: the same pass is valid again tomorrow.
            dup = dup.where(CheckIn.event_day_id == day.id)
        c = await db.execute(dup.order_by(CheckIn.checked_in_at.desc()).limit(1))
        last_checkin = c.scalar_one_or_none()
        if last_checkin is not None:
            already_checked_in = True
            previous_checkin = {
                "location": getattr(last_checkin, "location", None) or "Unknown",
                "time": last_checkin.checked_in_at.strftime("%I:%M %p") if last_checkin.checked_in_at else "Unknown",
            }

    response_guest = {
        "id": guest.id,
        "name": guest.name,
        "phone": _mask_phone(guest.phone),
        "email": _mask_email(guest.email),
        "rsvp_token": guest.rsvp_token,
        "invited_by": guest.invited_by,
        "category": guest.category,
        "zone": getattr(guest, "zone", None),
        "table_number": getattr(guest, "table_number", None),
        "seat_number": getattr(guest, "seat_number", None),
        "table_designation": getattr(guest, "table_designation", None),
    }

    if guest.rsvp_status == "declined":
        return {
            "valid": False,
            "reason": "declined",
            "message": f"{guest.name} declined the invitation and cannot be checked in.",
            "guest": {**response_guest, "checked_in": False},
            "event": _event_block(event, day),
        }

    # A closed day, a day that is not on this event, or a multi-day event with
    # nothing scheduled today all stop the gate before any duplicate logic.
    if day_error:
        return {
            "valid": False,
            "reason": day_error,
            "message": day_error_message(day_error, day),
            "guest": {**response_guest, "checked_in": already_checked_in},
            "event": _event_block(event, day),
            "days": [day_payload(d) for d in days],
            "previous_checkin": previous_checkin,
        }

    if already_checked_in and event.id != 71:
        return {
            "valid": False,
            "reason": "used",
            "message": (
                f"{guest.name} is already checked in for {day_payload(day)['name']}."
                if day is not None
                else f"{guest.name} is already checked in."
            ),
            "guest": {**response_guest, "checked_in": True},
            "event": _event_block(event, day),
            "previous_checkin": previous_checkin,
        }

    # The single `is_used` flag cannot describe several days, so a resolved day
    # relies on its own check-in row above instead.
    if qr and qr.is_used and event.id != 71 and day is None:
        return {
            "valid": False,
            "reason": "used",
            "message": "Already checked in",
            "guest": {**response_guest, "checked_in": True},
            "event": _event_block(event, day),
            "previous_checkin": previous_checkin,
        }

    if _event_has_passed(event, days):
        return {
            "valid": False,
            "reason": "event_ended",
            "message": f"The event '{event.title}' has already ended.",
            "guest": {**response_guest, "checked_in": False},
            "event": _event_block(event, day),
        }

    return {
        "valid": True,
        "reason": "verified",
        "message": f"{guest.name} can be checked in.",
        "guest": {**response_guest, "rsvp_status": guest.rsvp_status, "checked_in": already_checked_in},
        "event": _event_block(event, day),
        "days": [day_payload(d) for d in days],
        "previous_checkin": previous_checkin if already_checked_in else None,
    }


@router.post("/scanner/checkin")
async def scanner_checkin(req: ScanTokenRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    location = req.location  # optional location from frontend
    qr, guest, event = None, None, None
    raw_token = ""

    if req.guest_id:
        guest = await db.get(Guest, req.guest_id)
        if guest:
            event = await db.get(Event, guest.event_id)
    elif req.token:
        raw_token = req.token.split("/").pop() if "/" in req.token else req.token
        qr, guest, event = await _resolve_guest_and_event(raw_token, db)
    else:
        return {"status": "error", "message": "No token or guest_id provided"}

    if not guest or not event:
        return {"status": "error", "message": "Invalid QR code or guest not found"}

    day, day_error, days = await resolve_day(db, event, req.event_day_id, req.day_date)
    day_id = day.id if day is not None else None

    def _attempt(status: str):
        return ScanAttempt(
            guest_id=guest.id,
            event_id=event.id,
            event_day_id=day_id,
            token=raw_token,
            status=status,
            device_info=ua,
            ip_address=ip,
            location=location,
        )

    existing_q = select(CheckIn.id).where(CheckIn.guest_id == guest.id, CheckIn.event_id == event.id)
    if day is not None:
        existing_q = existing_q.where(CheckIn.event_day_id == day.id)
    existing = await db.execute(existing_q.limit(1))
    if existing.first() is not None and event.id != 71:
        return {
            "status": "error",
            "message": (
                f"{guest.name} is already checked in for {day_payload(day)['name']}."
                if day is not None
                else f"{guest.name} is already checked in."
            ),
            "day": day_payload(day),
        }

    if guest.rsvp_status == "declined":
        db.add(_attempt("declined"))
        await db.commit()
        return {"status": "declined", "message": f"{guest.name} declined the invitation and cannot be checked in."}

    if day_error:
        db.add(_attempt(day_error))
        await db.commit()
        return {
            "status": day_error,
            "message": day_error_message(day_error, day),
            "day": day_payload(day),
            "days": [day_payload(d) for d in days],
        }

    if _event_has_passed(event, days):
        db.add(_attempt("event_ended"))
        await db.commit()
        return {"status": "event_ended", "message": f"The event '{event.title}' has already ended."}

    # See the note in verify: a resolved day is guarded by its own check-in row,
    # so the single-event `is_used` flag must not reject day two.
    if qr and qr.is_used and event.id != 71 and day is None:
        return {"status": "error", "message": "Already checked in"}

    if qr:
        qr.is_used = True
    db.add(CheckIn(guest_id=guest.id, event_id=event.id, event_day_id=day_id, location=location))
    db.add(_attempt("checked_in"))
    await db.commit()
    return {"status": "approved", "message": "Check-in successful", "day": day_payload(day)}


@router.get("/scanner/events")
async def scanner_events(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Event).order_by(Event.event_date.desc())
    )
    events = result.scalars().all()
    day_rows = (await db.execute(
        select(EventDay.event_id, func.count(EventDay.id))
        .where(EventDay.is_active.is_(True))
        .group_by(EventDay.event_id)
    )).all()
    day_counts = {row[0]: row[1] for row in day_rows}
    return [
        {
            "id": e.id,
            "title": e.title,
            "event_date": str(e.event_date),
            "status": e.status,
            "day_count": day_counts.get(e.id, 0),
            "multi_day": day_counts.get(e.id, 0) > 0,
        }
        for e in events
    ]


@router.get("/scanner/events/{event_id}/days")
async def scanner_event_days(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The days of a multi-day event, with live check-in counts per day.

    Returns an empty list for a single-day event, which is what tells the gate
    to hide the day selector and keep using `events.event_date`.
    """
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    days = await list_days(db, event_id)
    if not days:
        return {"event_id": event_id, "multi_day": False, "days": []}

    counts = (await db.execute(
        select(CheckIn.event_day_id, func.count(func.distinct(CheckIn.guest_id)))
        .where(CheckIn.event_id == event_id, CheckIn.event_day_id.isnot(None))
        .group_by(CheckIn.event_day_id)
    )).all()
    by_day = {row[0]: row[1] for row in counts}
    return {
        "event_id": event_id,
        "multi_day": True,
        "days": [day_payload(d, checked_in=by_day.get(d.id, 0)) for d in days],
    }


@router.get("/scanner/events/{event_id}/stats")
async def scanner_event_stats(
    event_id: int,
    date: str = "",
    event_day_id: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    day = None
    if event_day_id:
        day = await db.get(EventDay, event_day_id)
        if day is None or day.event_id != event_id:
            raise HTTPException(status_code=404, detail="Day not found for this event")

    date_filter = None
    if date:
        from datetime import datetime as dt
        try:
            date_filter = dt.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            pass

    if day is not None:
        checked_in = await db.scalar(
            select(func.count(func.distinct(CheckIn.guest_id))).where(
                CheckIn.event_id == event_id,
                CheckIn.event_day_id == day.id,
            )
        )
    elif date_filter:
        checked_in = await db.scalar(
            select(func.count(func.distinct(CheckIn.guest_id))).where(
                CheckIn.event_id == event_id,
                func.date(CheckIn.checked_in_at) == date_filter,
            )
        )
    else:
        checked_in = await db.scalar(
            select(func.count(func.distinct(CheckIn.guest_id))).where(CheckIn.event_id == event_id)
        )
    total = await db.scalar(select(func.count(Guest.id)).where(Guest.event_id == event_id))
    return {
        "checked_in": checked_in or 0,
        "total_guests": total or 0,
        "date": date or "all",
        "day": day_payload(day),
    }


@router.get("/scanner/events/{event_id}/location-stats")
async def scanner_location_stats(
    event_id: int,
    event_day_id: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    stmt = (
        select(ScanAttempt.location, func.count(ScanAttempt.id))
        .where(ScanAttempt.event_id == event_id, ScanAttempt.status == "checked_in")
    )
    if event_day_id:
        stmt = stmt.where(ScanAttempt.event_day_id == event_day_id)
    result = await db.execute(stmt.group_by(ScanAttempt.location))
    location_counts = {row[0] or "unassigned": row[1] for row in result.all()}
    total_checked_in = sum(location_counts.values())
    return {"locations": location_counts, "total_checked_in": total_checked_in}


@router.get("/scanner/events/{event_id}/location-guests")
async def scanner_location_guests(
    event_id: int,
    location: str = "",
    event_day_id: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    query = (
        select(
            ScanAttempt.id,
            ScanAttempt.guest_id,
            Guest.name,
            Guest.phone,
            Guest.email,
            Guest.invited_by,
            ScanAttempt.location,
            ScanAttempt.created_at.label("checked_in_at"),
        )
        .join(Guest, ScanAttempt.guest_id == Guest.id)
        .where(ScanAttempt.event_id == event_id, ScanAttempt.status == "checked_in")
        .order_by(ScanAttempt.created_at.desc())
    )

    if event_day_id:
        query = query.where(ScanAttempt.event_day_id == event_day_id)

    if location and location.lower() != "all":
        query = query.where(ScanAttempt.location.ilike(location))

    result = await db.execute(query)
    rows = result.all()
    return {
        "guests": [
            {
                "id": r.id,
                "guest_id": r.guest_id,
                "name": r.name,
                "phone": _mask_phone(r.phone),
                "email": _mask_email(r.email),
                "invited_by": r.invited_by,
                "checked_in_at": r.checked_in_at.isoformat() if r.checked_in_at else None,
                "location": r.location,
            }
            for r in rows
        ],
        "total": len(rows),
        "location": location or "all",
    }


@router.get("/scanner/events/{event_id}/guests")
async def scanner_search_guests(
    event_id: int,
    q: str = "",
    event_day_id: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not q.strip():
        return {"guests": []}
    stmt = select(Guest).where(
        Guest.event_id == event_id,
        Guest.deleted_at == None,
        (Guest.name.ilike(f"%{q}%")) | (Guest.rsvp_token.ilike(f"%{q}%")) | (Guest.email.ilike(f"%{q}%")) | (Guest.phone.ilike(f"%{q}%")),
    ).limit(20)
    result = await db.execute(stmt)
    guests = result.scalars().all()
    checked_in_ids = set()
    if guests:
        ci_stmt = select(CheckIn.guest_id).where(CheckIn.event_id == event_id, CheckIn.guest_id.in_([g.id for g in guests]))
        if event_day_id:
            ci_stmt = ci_stmt.where(CheckIn.event_day_id == event_day_id)
        checkin_result = await db.execute(ci_stmt)
        checked_in_ids = {row[0] for row in checkin_result.all()}
    return {
        "guests": [
            {
                "id": g.id,
                "name": g.name,
                "phone": _mask_phone(g.phone),
                "email": _mask_email(g.email),
                "rsvp_status": g.rsvp_status,
                "rsvp_token": g.rsvp_token,
                "checked_in": g.id in checked_in_ids,
                "invited_by": g.invited_by,
                "category": g.category,
                "zone": getattr(g, "zone", None),
                "table_number": getattr(g, "table_number", None),
                "seat_number": getattr(g, "seat_number", None),
                "table_designation": getattr(g, "table_designation", None),
            }
            for g in guests
        ]
    }


@router.get("/scanner/events/{event_id}/activity")
async def scanner_recent_activity(
    event_id: int,
    page: int = 1,
    per_page: int = 20,
    q: str = "",
    date: str = "",
    event_day_id: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    date_filter = None
    if date:
        from datetime import datetime as dt
        try:
            date_filter = dt.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            pass

    base_query = (
        select(CheckIn, Guest.name, Guest.phone, Guest.email, Guest.invited_by, Guest.category, ScanAttempt.location)
        .join(Guest, CheckIn.guest_id == Guest.id)
        .join(
            ScanAttempt,
            (ScanAttempt.guest_id == CheckIn.guest_id)
            & (ScanAttempt.event_id == CheckIn.event_id)
            & (ScanAttempt.status == "checked_in")
            # Same day only, so a guest accredited on day 1 and day 2 does not
            # appear twice. NULL (single-day) coalesces to 0 so nothing changes.
            & (
                func.coalesce(ScanAttempt.event_day_id, 0)
                == func.coalesce(CheckIn.event_day_id, 0)
            ),
            isouter=True,
        )
        .where(CheckIn.event_id == event_id)
    )

    if event_day_id:
        base_query = base_query.where(CheckIn.event_day_id == event_day_id)
    elif date_filter:
        base_query = base_query.where(func.date(CheckIn.checked_in_at) == date_filter)

    if q:
        like = f"%{q}%"
        base_query = base_query.where(
            Guest.name.ilike(like) | Guest.email.ilike(like) | Guest.phone.ilike(like)
        )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        base_query
        .order_by(CheckIn.checked_in_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.all()
    return {
        "activity": [
            {
                "id": r.CheckIn.id,
                "guest_id": r.CheckIn.guest_id,
                "guest_name": r.name,
                "guest_phone": _mask_phone(r.phone),
                "guest_email": _mask_email(r.email),
                "invited_by": r.invited_by,
                "category": r.category,
                "checked_in_at": r.CheckIn.checked_in_at.isoformat() if r.CheckIn.checked_in_at else None,
                "location": r.location,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/scanner/events/{event_id}/category-stats")
async def scanner_category_stats(
    event_id: int,
    event_day_id: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Real-time accreditation analytics grouped by guest category.

    Returns per-category guest totals + checked-in counts for dashboards.
    Guests without a category are grouped under "Uncategorized".
    """
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guests_result = await db.execute(
        select(Guest.id, Guest.category).where(
            Guest.event_id == event_id, Guest.deleted_at == None
        )
    )
    guest_rows = guests_result.all()

    ci_stmt = select(func.distinct(CheckIn.guest_id)).where(CheckIn.event_id == event_id)
    if event_day_id:
        ci_stmt = ci_stmt.where(CheckIn.event_day_id == event_day_id)
    checked_result = await db.execute(ci_stmt)
    checked_in_ids = {row[0] for row in checked_result.all()}

    by_category: dict[str, dict] = {}
    for gid, cat in guest_rows:
        name = (cat or "").strip() or "Uncategorized"
        entry = by_category.setdefault(name, {"category": name, "total": 0, "checked_in": 0})
        entry["total"] += 1
        if gid in checked_in_ids:
            entry["checked_in"] += 1

    categories = sorted(by_category.values(), key=lambda e: e["total"], reverse=True)
    return {
        "event_id": event_id,
        "total_guests": len(guest_rows),
        "checked_in": len(checked_in_ids),
        "categories": categories,
    }


