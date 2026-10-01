from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, date, time
from pydantic import BaseModel

from app.core.database import get_db
from app.models.qr_code import QRCode
from app.models.checkin import CheckIn
from app.models.guest import Guest
from app.models.event import Event
from app.models.scan_attempt import ScanAttempt
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class ScanRequest(BaseModel):
    token: str


def _event_has_passed(event) -> bool:
    if not event.event_date:
        return False
    event_end = datetime.combine(event.event_date, time.max, tzinfo=timezone.utc)
    return event_end < datetime.now(timezone.utc)


def _get_client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    return ip, ua


async def _resolve_guest_and_event(token: str, db: AsyncSession):
    """Resolve guest + event from QR code record or fallback to guest rsvp_token lookup."""
    result = await db.execute(select(QRCode).where(QRCode.token == token))
    qr = result.scalar_one_or_none()

    guest = None
    event = None

    if qr:
        guest = await db.get(Guest, qr.guest_id)
        event = await db.get(Event, qr.event_id)
    else:
        g_result = await db.execute(select(Guest).where(Guest.rsvp_token == token))
        guest = g_result.scalar_one_or_none()
        if guest:
            event = await db.get(Event, guest.event_id)

    return qr, guest, event


@router.post("/verify")
async def verify_qr(req: ScanRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip, ua = _get_client_info(request)
    qr, guest, event = await _resolve_guest_and_event(req.token, db)

    if not guest or not event:
        scan = ScanAttempt(
            guest_id=None, event_id=0, token=req.token,
            status="invalid_token", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=404, detail="Invalid QR code")

    if qr and qr.is_used:
        scan = ScanAttempt(
            guest_id=qr.guest_id, event_id=qr.event_id, token=req.token,
            status="already_used", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=400, detail="QR code already used")

    if qr and qr.expires_at and qr.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        scan = ScanAttempt(
            guest_id=qr.guest_id, event_id=qr.event_id, token=req.token,
            status="expired", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=400, detail="QR code has expired")

    if _event_has_passed(event):
        scan = ScanAttempt(
            guest_id=guest.id if guest else None, event_id=event.id, token=req.token,
            status="event_ended", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        return {
            "valid": False,
            "reason": "event_ended",
            "message": f"The event '{event.title}' has already ended.",
            "guest": {
                "id": guest.id,
                "name": guest.name,
                "phone": guest.phone,
                "email": guest.email,
                "invited_by": guest.invited_by,
            },
            "event": {
                "id": event.id,
                "title": event.title,
                "event_date": str(event.event_date),
            },
        }

    if guest.rsvp_status == "declined":
        scan = ScanAttempt(
            guest_id=guest.id, event_id=event.id, token=req.token,
            status="declined", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        return {
            "valid": False,
            "reason": "declined",
            "message": f"{guest.name} declined the invitation and cannot be checked in.",
            "guest": {
                "id": guest.id,
                "name": guest.name,
                "phone": guest.phone,
                "email": guest.email,
                "invited_by": guest.invited_by,
            },
            "event": {
                "id": event.id,
                "title": event.title,
                "event_date": str(event.event_date),
            },
        }

    scan = ScanAttempt(
        guest_id=guest.id, event_id=event.id, token=req.token,
        status="verified", device_info=ua, ip_address=ip,
    )
    db.add(scan)
    await db.commit()

    return {
        "valid": True,
        "reason": "verified",
        "message": f"{guest.name} is invited and can be checked in.",
        "guest": {
            "id": guest.id,
            "name": guest.name,
            "phone": guest.phone,
            "email": guest.email,
            "rsvp_status": guest.rsvp_status,
            "invited_by": guest.invited_by,
        },
        "event": {
            "id": event.id,
            "title": event.title,
            "event_date": str(event.event_date),
        },
    }


@router.get("/{token}")
async def qr_token_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Return ticket info when a guest scans their own QR code with a phone camera."""
    result = await db.execute(select(QRCode).where(QRCode.token == token))
    qr = result.scalar_one_or_none()

    guest = None
    event = None

    if qr:
        guest_result = await db.execute(select(Guest).where(Guest.id == qr.guest_id))
        guest = guest_result.scalar_one_or_none()
        event_result = await db.execute(select(Event).where(Event.id == qr.event_id))
        event = event_result.scalar_one_or_none()
    else:
        # Fallback: try looking up the guest directly by rsvp_token (used in trial QRs)
        guest_result = await db.execute(select(Guest).where(Guest.rsvp_token == token))
        guest = guest_result.scalar_one_or_none()
        if guest:
            event_result = await db.execute(select(Event).where(Event.id == guest.event_id))
            event = event_result.scalar_one_or_none()

    if not guest or not event:
        raise HTTPException(status_code=404, detail="Invalid or expired QR code")

    is_used = qr.is_used if qr else False
    is_expired = qr and qr.expires_at and qr.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    event_passed = _event_has_passed(event)

    return {
        "valid": not is_used and not is_expired and not event_passed,
        "guest_name": guest.name,
        "category": guest.category,
        "event_title": event.title,
        "event_date": str(event.event_date),
        "event_time": str(event.event_time),
        "venue": event.venue,
        "rsvp_status": guest.rsvp_status,
        "status": "event_ended" if event_passed else "active",
    }


@router.post("/scan")
async def scan_qr(req: ScanRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip, ua = _get_client_info(request)
    qr, guest, event = await _resolve_guest_and_event(req.token, db)

    if not guest or not event:
        scan = ScanAttempt(
            guest_id=None, event_id=0, token=req.token,
            status="invalid_token", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=404, detail="Invalid QR code")

    if guest.rsvp_status == "declined":
        scan = ScanAttempt(
            guest_id=guest.id, event_id=event.id, token=req.token,
            status="declined", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=403, detail=f"{guest.name} declined the invitation and cannot be checked in.")

    if qr and qr.is_used:
        scan = ScanAttempt(
            guest_id=qr.guest_id, event_id=qr.event_id, token=req.token,
            status="already_used", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=400, detail="QR code already used")

    if qr and qr.expires_at and qr.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        scan = ScanAttempt(
            guest_id=qr.guest_id, event_id=qr.event_id, token=req.token,
            status="expired", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=400, detail="QR code has expired")

    if _event_has_passed(event):
        scan = ScanAttempt(
            guest_id=guest.id, event_id=event.id, token=req.token,
            status="event_ended", device_info=ua, ip_address=ip,
        )
        db.add(scan)
        await db.commit()
        raise HTTPException(status_code=400, detail=f"The event '{event.title}' has already ended.")

    if qr:
        qr.is_used = True
    checkin = CheckIn(guest_id=guest.id, event_id=event.id)
    db.add(checkin)

    scan = ScanAttempt(
        guest_id=guest.id, event_id=event.id, token=req.token,
        status="checked_in", device_info=ua, ip_address=ip,
    )
    db.add(scan)
    await db.commit()

    return {"status": "approved", "message": "Check-in successful"}


@router.get("/events/{event_id}/checkin-stats")
async def checkin_stats(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    checked_in = await db.scalar(
        select(func.count(CheckIn.id)).where(CheckIn.event_id == event_id)
    )
    rsvp_accepted = await db.scalar(
        select(func.count(Guest.id)).where(
            Guest.event_id == event_id, Guest.rsvp_status == "accepted"
        )
    )
    total_guests = await db.scalar(
        select(func.count(Guest.id)).where(Guest.event_id == event_id)
    )

    result = await db.execute(
        select(CheckIn, Guest.name, Guest.phone, Guest.email)
        .join(Guest, CheckIn.guest_id == Guest.id, isouter=True)
        .where(CheckIn.event_id == event_id)
        .order_by(CheckIn.checked_in_at.desc())
        .limit(50)
    )
    checkins = [
        {
            "id": c[0].id,
            "guest_id": c[0].guest_id,
            "checked_in_at": str(c[0].checked_in_at),
            "guest_name": c[1],
            "guest_phone": c[2],
            "guest_email": c[3],
        }
        for c in result.all()
    ]

    return {
        "checked_in": checked_in or 0,
        "rsvp_accepted": rsvp_accepted or 0,
        "total_guests": total_guests or 0,
        "recent_checkins": checkins,
    }


@router.get("/events/{event_id}/accreditation-log")
async def accreditation_log(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(ScanAttempt, Guest.name)
        .join(Guest, ScanAttempt.guest_id == Guest.id, isouter=True)
        .where(ScanAttempt.event_id == event_id)
        .order_by(ScanAttempt.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    attempts = [
        {
            "id": a[0].id,
            "guest_id": a[0].guest_id,
            "guest_name": a[1],
            "token": a[0].token[:20] + "..." if len(a[0].token) > 20 else a[0].token,
            "status": a[0].status,
            "device_info": a[0].device_info,
            "ip_address": a[0].ip_address,
            "location": a[0].location,
            "created_at": str(a[0].created_at),
        }
        for a in result.all()
    ]

    suspicious = [a for a in attempts if a["status"] in ("already_used", "invalid_token", "expired")]

    return {
        "attempts": attempts,
        "suspicious_count": len(suspicious),
        "total": len(attempts),
    }
