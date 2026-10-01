"""Public self-registration / RSVP for regular (non-burial) events.

Provides a public form flow where guests fill in name, email, phone and a
Yes/No attendance response. Submitted registrations create Guest records that
appear in the organizer's dashboard Guests tab, where the organizer can send
QR codes and confirmatory messages (which include the event flyer).
"""

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.event import Event
from app.models.guest import Guest
from app.models.flier import FlierAsset

router = APIRouter()


class RegistrationRequest(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    response: str = "accepted"
    organization: str = ""
    sub_department: str = ""
    category: str = ""


def _normalize_phone(phone: str) -> str:
    """Normalize phone. If an explicit country code (+...) is supplied keep it;
    otherwise default to Nigeria (+234)."""
    phone = phone.strip()
    # Explicit country code supplied (e.g. "+1 2025550123" or "+234 8012345678")
    if phone.startswith('+'):
        digits = ''.join(c for c in phone if c.isdigit())
        return '+' + digits

    digits_only = ''.join(c for c in phone if c.isdigit())
    if not digits_only:
        return phone

    if digits_only.startswith('0'):
        digits_only = digits_only[1:]

    if digits_only.startswith('2340'):
        digits_only = '234' + digits_only[4:]

    if not digits_only.startswith('234'):
        digits_only = '234' + digits_only

    return '+' + digits_only


async def _get_event_by_slug(event_slug: str, db: AsyncSession) -> Event:
    result = await db.execute(select(Event).where(Event.slug == event_slug))
    event = result.scalar_one_or_none()
    if not event:
        # Slug alias fallback: event 67's slug has been toggled between the bare
        # form and a "-1" suffix (acamb-30th-anniversary <-> acamb-30th-anniversary-1).
        # Accept both variants so public registration links keep working regardless
        # of which one is currently stored.
        alias = event_slug + "-1" if not event_slug.endswith("-1") else event_slug[:-2]
        result = await db.execute(select(Event).where(Event.slug == alias))
        event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.event_type == "burial":
        raise HTTPException(status_code=400, detail="Use the burial RSVP link for this event")
    return event


def _registration_effectively_open(event: Event) -> bool:
    """Manual toggle AND scheduled auto-close both gate registration."""
    if getattr(event, "registration_open", True) is False:
        return False
    close_at = getattr(event, "registration_close_at", None)
    if close_at is not None:
        from datetime import datetime, timezone as _tz

        now = datetime.now(_tz.utc)
        try:
            if close_at.tzinfo is None:
                close_at = close_at.replace(tzinfo=_tz.utc)
            if now >= close_at:
                return False
        except Exception:
            pass
    return True


def _raise_if_registration_closed(event: Event) -> None:
    """Reject submissions when the organizer has closed registration for the event."""
    if not _registration_effectively_open(event):
        raise HTTPException(
            status_code=403,
            detail="Registration for this event is closed.",
        )


@router.get("/rsvp/register/{event_slug}")
async def get_registration_event_info(
    event_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get event details for the public registration form."""
    event = await _get_event_by_slug(event_slug, db)

    # Event 67 (ACAMB) and event 72 (Annette's BIG 40) use a two-step procedure:
    # the attendance question is shown first, then a details form only for "Yes".
    is_two_step = event.id in (67, 72)

    flyer_result = await db.execute(
        select(FlierAsset).where(FlierAsset.event_id == event.id).order_by(FlierAsset.created_at.desc())
    )
    flyer = flyer_result.scalars().first()
    flyer_url = flyer.url if flyer else None

    return {
        "event": {
            "id": event.id,
            "title": event.title,
            "slug": event.slug,
            "date": str(event.event_date),
            "time": str(event.event_time),
            "venue": event.venue,
            "city": event.city,
            "state": event.state,
            "cover_image": event.cover_image,
            "flyer_url": flyer_url,
            "theme_color": getattr(event, "theme_color", "#E91E8C") or "#E91E8C",
            "host_name": event.host_name,
            "dress_code": event.dress_code,
            "registration_open": _registration_effectively_open(event),
        },
        "two_step": is_two_step,
        "extra_fields": ["organization", "sub_department"] if event.id == 67 else ["category"] if event.id == 74 else [],
    }


@router.post("/rsvp/register/{event_slug}")
async def submit_registration(
    event_slug: str,
    req: RegistrationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit registration. Creates/updates a Guest record for the event."""
    event = await _get_event_by_slug(event_slug, db)
    _raise_if_registration_closed(event)

    is_two_step = event.id in (67, 72)
    response_lower = req.response.lower()
    if response_lower not in ("accepted", "yes", "declined", "no"):
        raise HTTPException(status_code=400, detail="Please choose whether you will attend")

    # Two-step procedure: guests who answer "No" fill no form and are not added to
    # the dashboard: the flow simply ends.
    if is_two_step and response_lower in ("declined", "no"):
        return {
            "status": "success",
            "response": "declined",
            "message": "Your response has been recorded. Thank you.",
        }

    name = req.name.strip()
    email = req.email.strip().lower()
    phone = _normalize_phone(req.phone)
    organization = req.organization.strip()
    sub_department = req.sub_department.strip()
    category = req.category.strip()

    if event.id == 67:
        if not (name and email and phone and organization and sub_department):
            raise HTTPException(
                status_code=400,
                detail="Please provide your full name, email, phone number, organization and sub department.",
            )
    elif event.id == 74:
        if not (name and email and phone and category):
            raise HTTPException(status_code=400, detail="Please provide your full name, email, phone number, and category (Student or Professional)")
        if category not in ("Student", "Professional"):
            raise HTTPException(status_code=400, detail="Category must be either Student or Professional")
    elif not (name and email and phone):
        raise HTTPException(status_code=400, detail="Name, email and phone number are required")

    existing_guest = None
    if phone:
        existing_result = await db.execute(
            select(Guest).where(and_(Guest.event_id == event.id, Guest.phone == phone))
        )
        existing_guest = existing_result.scalars().first()

    if not existing_guest and email:
        existing_result = await db.execute(
            select(Guest).where(and_(Guest.event_id == event.id, func.lower(Guest.email) == email))
        )
        existing_guest = existing_result.scalars().first()

    if not existing_guest:
        existing_result = await db.execute(
            select(Guest).where(
                and_(Guest.event_id == event.id, func.lower(Guest.name) == name.lower())
            )
        )
        existing_guest = existing_result.scalars().first()

    if existing_guest and existing_guest.rsvp_status in ("accepted", "declined"):
        raise HTTPException(
            status_code=409,
            detail="The name, email, or phone number provided is already registered for this event. No need to register again."
        )

    # ACAMB cap: limit accepted registrations to 300 (only counts NEW guests).
    if event.id == 67 and not existing_guest and response_lower in ("accepted", "yes"):
        count_result = await db.execute(
            select(func.count())
            .select_from(Guest)
            .where(Guest.event_id == event.id, Guest.rsvp_status == "accepted")
        )
        accepted_count = count_result.scalar_one()
        if accepted_count >= 300:
            raise HTTPException(
                status_code=409,
                detail="Registration for this event is now full. We have reached the maximum of 300 attendees.",
            )

    if existing_guest:
        guest = existing_guest
        guest.name = name
        guest.phone = phone
        guest.email = email
    else:
        # New registrations respect the event's guest cap (event 67 keeps
        # its own bespoke 300-attendee rule handled below).
        if event.id != 67:
            from app.api.guests import ensure_guest_capacity

            await ensure_guest_capacity(db, event, 1)
        guest = Guest(
            event_id=event.id,
            name=name,
            phone=phone,
            email=email,
            invited_by=event.host_name,
        )
        db.add(guest)

    guest.rsvp_status = "accepted" if response_lower in ("accepted", "yes") else "declined"
    guest.rsvped_at = datetime.now(timezone.utc)

    if event.id == 67 and (organization or sub_department):
        guest.custom_data = {
            **(guest.custom_data or {}),
            "organization": organization,
            "sub_department": sub_department,
        }

    if event.id == 74 and category:
        guest.custom_data = {
            **(guest.custom_data or {}),
            "category": category,
        }
        guest.category = category

    await db.commit()
    await db.refresh(guest)

    # ACAMB-style flow (qr_later): the ONLY thing a registered guest receives is
    # their QR code (with the flyer) via email + WhatsApp. Trigger that delivery
    # here so it fires on registration, not only on the per-guest RSVP "Yes" flow.
    if guest.rsvp_status == "accepted" and getattr(event, "qr_delivery", None) == "qr_later":
        try:
            from app.api.rsvp import _send_qr_after_rsvp
            asyncio.create_task(_send_qr_after_rsvp(guest.id, event.id))
        except Exception:
            pass

    if guest.rsvp_status == "accepted":
        message = "Your attendance has been recorded. You will receive your QR code via email or WhatsApp shortly."
    else:
        message = "Your response has been recorded. Thank you."

    return {
        "status": "success",
        "guest_id": guest.id,
        "guest_name": guest.name,
        "response": guest.rsvp_status,
        "message": message,
    }
