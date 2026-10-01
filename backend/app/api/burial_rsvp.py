"""Burial event RSVP handling endpoints."""

import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, delete
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_db, async_session
from app.core.config import settings
from app.models.guest import Guest
from app.models.event import Event
from app.models.flier import FlierAsset
from app.models.invite import InviteBatch, InviteMessage
from app.models.qr_code import QRCode
from app.models.checkin import CheckIn
from app.api.qr_codes import get_or_create_guest_qr
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp
from app.services.whatsapp_cloud_service import send_whatsapp_cloud
from app.services.qr_service import qr_to_url

router = APIRouter()


# Pydantic models
class BurialRSVPRequest(BaseModel):
    name: str
    phone: str
    email: str = ""
    invited_by: str = ""
    response: str = "accepted"


EXCLUDED_TEST_GUEST_IDS = {54, 55}


class HostStats(BaseModel):
    name: str
    total_guests: int
    accepted: int
    declined: int
    pending: int


class GuestListItem(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]
    rsvp_status: str
    qr_sent: bool
    created_at: Optional[str]


async def _send_whatsapp(to: str, message: str, media_url: str | None = None, content_vars: dict | None = None) -> tuple[bool, str | None]:
    """Send WhatsApp message — Twilio for templates, Meta Cloud for plain messages."""
    if content_vars:
        return await send_whatsapp(to, message, media_url, content_vars=content_vars)
    if settings.WHATSAPP_CLOUD_TOKEN and settings.WHATSAPP_CLOUD_PHONE_ID:
        ok, provider_id = await send_whatsapp_cloud(to, message, media_url)
        if ok:
            return ok, provider_id
    return await send_whatsapp(to, message, media_url)


def _absolute_url(url: str | None) -> str | None:
    """Convert relative URL to absolute."""
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return f"{settings.FRONTEND_URL}{url}"
    return url


def _upload_path_from_url(url: str) -> str:
    """Convert URL to local upload path."""
    import os
    upload_base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    if "/uploads/" in url:
        relative = url.rstrip("/").split("/uploads/")[-1]
    elif url.startswith("/uploads/"):
        relative = url[len("/uploads/"):]
    else:
        relative = url.lstrip("/")
    return os.path.join(upload_base, relative)


def _format_date(date_val) -> str:
    """Convert date to 'Friday 24th July, 2026' format."""
    from datetime import date
    if isinstance(date_val, str):
        try:
            date_val = date.fromisoformat(date_val)
        except ValueError:
            return date_val
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    day = date_val.day
    if 10 <= day <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(day % 10, "th")
    return f"{days[date_val.weekday()]} {day}{suffix} {months[date_val.month - 1]}, {date_val.year}"


def _format_time(time_val, tz: str = "WAT") -> str:
    """Convert time to 12-hour format like '8:00 PM (WAT)'."""
    from datetime import time
    if isinstance(time_val, str):
        try:
            parts = time_val.split(":")
            time_val = time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
        except (ValueError, IndexError):
            return time_val
    hour = time_val.hour
    minute = time_val.minute
    ampm = "AM" if hour < 12 else "PM"
    hour12 = hour if hour <= 12 else hour - 12
    if hour12 == 0:
        hour12 = 12
    minute_str = f":{minute:02d}" if minute else ""
    return f"{hour12}{minute_str} {ampm} ({tz})"


def _normalize_phone(phone: str) -> str:
    """Normalize phone number to +234 format."""
    phone = phone.strip()
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


@router.get("/rsvp/burial/{event_slug}")
async def get_burial_event_info(
    event_slug: str,
    host: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Get burial event details and host list for public RSVP form."""
    event_result = await db.execute(
        select(Event).where(Event.slug == event_slug)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.event_type != "burial":
        raise HTTPException(status_code=400, detail="This endpoint is for burial events only")

    hosts = event.event_hosts or []
    host_data = []
    if hosts and isinstance(hosts[0], dict):
        for h in hosts:
            host_info = {"name": h.get("name", ""), "allocation": h.get("allocation")}
            if host and h.get("name", "").lower() == host.lower():
                host_data.insert(0, host_info)
            else:
                host_data.append(host_info)
    else:
        host_data = [{"name": h, "allocation": None} for h in (hosts if isinstance(hosts, list) else [])]
        if host:
            host_data.sort(key=lambda x: 0 if x["name"].lower() == host.lower() else 1)

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
            "theme_color": getattr(event, "theme_color", "#1a1a1a") or "#1a1a1a",
            "deceased_photo_url": getattr(event, "deceased_photo_url", None),
            "burial_flyer_url": getattr(event, "burial_flyer_url", None) or event.cover_image,
        },
        "hosts": host_data,
    }


async def _get_host_allocation(event, host_name: str) -> int | None:
    """Get allocation threshold for a host. Returns None if no limit."""
    hosts = event.event_hosts or []
    if not isinstance(hosts, list):
        return None
    for h in hosts:
        if isinstance(h, dict) and h.get("name", "").lower() == host_name.lower():
            return h.get("allocation")
    return None


async def _check_host_threshold(event_id: int, host_name: str, allocation: int | None, db: AsyncSession):
    """Check if host has reached guest threshold. Returns True if under limit."""
    if allocation is None:
        return True
    count_result = await db.execute(
        select(func.count(Guest.id)).where(
            and_(
                Guest.event_id == event_id,
                func.lower(Guest.invited_by) == host_name.lower(),
                Guest.rsvp_status == "accepted",
                ~Guest.id.in_(EXCLUDED_TEST_GUEST_IDS),
            )
        )
    )
    current_count = count_result.scalar() or 0
    return current_count < allocation


@router.post("/rsvp/burial/{event_slug}")
async def submit_burial_rsvp(
    event_slug: str,
    rsvp_data: BurialRSVPRequest,
    host: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Submit RSVP for burial event. Creates/updates guest record.

    If `host` query param is provided, it overrides `invited_by` in the body.
    """
    event_result = await db.execute(
        select(Event).where(Event.slug == event_slug)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.event_type != "burial":
        raise HTTPException(status_code=400, detail="This endpoint is for burial events only")

    effective_host = host or rsvp_data.invited_by
    if not effective_host:
        raise HTTPException(status_code=400, detail="Host is required. Please use the link provided by your host.")

    # Check threshold if host has an allocation limit
    allocation = await _get_host_allocation(event, effective_host)
    if allocation is not None:
        within_limit = await _check_host_threshold(event.id, effective_host, allocation, db)
        if not within_limit:
            raise HTTPException(
                status_code=400,
                detail="Error occured, kindly contact your host"
            )

    normalized_phone = _normalize_phone(rsvp_data.phone)

    existing_guest = None
    if normalized_phone:
        existing_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event.id,
                    Guest.phone == normalized_phone
                )
            )
        )
        existing_guest = existing_result.scalar_one_or_none()

    if not existing_guest and rsvp_data.email:
        existing_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event.id,
                    Guest.email == rsvp_data.email
                )
            )
        )
        existing_guest = existing_result.scalar_one_or_none()

    if not existing_guest:
        existing_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event.id,
                    func.lower(Guest.name) == rsvp_data.name.strip().lower()
                )
            )
        )
        existing_guest = existing_result.scalar_one_or_none()

    if existing_guest and existing_guest.rsvp_status in ("accepted", "declined"):
        raise HTTPException(
            status_code=409,
            detail=f"The name, email, or phone number provided is already registered for this event. You previously {'indicated attendance' if existing_guest.rsvp_status == 'accepted' else 'declined'}. No need to RSVP again."
        )

    if existing_guest:
        guest = existing_guest
        guest.name = rsvp_data.name
        guest.phone = normalized_phone
        guest.email = rsvp_data.email
        guest.invited_by = effective_host
    else:
        guest = Guest(
            event_id=event.id,
            name=rsvp_data.name,
            phone=normalized_phone,
            email=rsvp_data.email,
            invited_by=effective_host,
        )
        db.add(guest)

    response_lower = rsvp_data.response.lower()
    if response_lower == "accepted" or response_lower == "yes":
        guest.rsvp_status = "accepted"
    elif response_lower == "declined" or response_lower == "no":
        guest.rsvp_status = "declined"
    else:
        guest.rsvp_status = "pending"

    guest.rsvped_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(guest)

    return {
        "status": "success",
        "guest_id": guest.id,
        "guest_name": guest.name,
        "response": response_lower,
        "message": "Your attendance has been recorded. Look out for your confirmation message in the next 72 hours. If you don't receive it, please contact the family member who invited you. The confirmatory message will contain your QR code for entry."
            if guest.rsvp_status == "accepted"
            else "Your response has been recorded. Thank you.",
    }


async def _send_burial_qr(guest_id: int, event_id: int, custom_message: str | None = None, qr_message: str | None = None, message_type: str = "confirmation"):
    """Fire-and-forget task to send burial QR code to a guest."""
    async with async_session() as db:
        try:
            print("BACKGROUND TASK STARTED for guest", guest_id, "event", event_id)
            guest_result = await db.execute(select(Guest).where(Guest.id == guest_id))
            guest = guest_result.scalar_one_or_none()
            event_result = await db.execute(select(Event).where(Event.id == event_id))
            event = event_result.scalar_one_or_none()

            if not guest or not event:
                return

            qr = await get_or_create_guest_qr(db, event_id, guest_id)
            qr_token_url = f"{settings.FRONTEND_URL}/qr/{qr.token}"

            import os as _os
            _qr_embed_path = _os.path.join(
                _os.path.dirname(_os.path.dirname(_os.path.dirname(__file__))),
                "uploads", "burial", f"deceased_{event_id}.jpg"
            )
            if not _os.path.exists(_qr_embed_path):
                _deceased_photo = getattr(event, "deceased_photo_url", None)
                _qr_embed_path = _upload_path_from_url(_deceased_photo) if _deceased_photo else None

            qr_image_url = qr_to_url(qr_token_url, image_path=_qr_embed_path, size=250)

            channels = []
            if guest.email:
                channels.append("email")
            if guest.phone:
                channels.append("whatsapp")

            for ch in channels:
                batch = InviteBatch(event_id=event_id, channel=ch)
                db.add(batch)
                await db.flush()

                msg = InviteMessage(batch_id=batch.id, guest_id=guest.id, channel=ch, message_type=message_type)
                db.add(msg)

                try:
                    print(f"[Burial Send] Guest: {guest.name} ({guest.id}), Channel: {ch}, Type: {message_type}, Phone: {guest.phone}, Email: {guest.email}")

                    if ch == "email" and guest.email:
                        from_addr = "THE LAWAL - OBELAWO FAMILY <noreply@wristbandsng.com>"

                        if message_type == "confirmation":
                            subject = f"Attendance Confirmed: {event.title}"
                            nav_flier = "https://drive.google.com/uc?export=view&id=1vPOcOLG9XblVBOZsDVo7cqCBWD_n8Zdl"
                            invite_flier = "https://drive.google.com/uc?export=view&id=13LCDgOQcbF91ixwRt7W6_DkbH_GkhKcF"
                            html = (
                                '<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#1a1a2e">'
                                f'<img src="{nav_flier}" alt="" style="width:100%;max-width:600px;height:auto;display:block">'
                                '<div style="padding:32px 28px;background:#ffffff">'
                                f'<p style="font-size:16px;color:#333">Dear {guest.name},</p>'
                                '<p style="font-size:14px;color:#555;line-height:1.6">'
                                'Thank you for confirming your attendance.</p>'
                                f'<img src="{invite_flier}" alt="Invitation Flier" style="width:100%;max-width:600px;height:auto;display:block;margin:16px 0">'
                                f'<p style="font-size:14px;color:#555;line-height:1.6">'
                                f'<strong>Date:</strong> {_format_date(event.event_date)}<br>'
                                f'<strong>Time:</strong> {_format_time(event.event_time, event.timezone or "WAT")}<br>'
                                f'<strong>Venue:</strong> {event.venue}</p>'
                                '<p style="font-size:13px;font-weight:bold;color:#c0392b;line-height:1.6">'
                                'Please note, this invite admits only one person.</p>'
                                '<p style="font-size:14px;color:#555;line-height:1.6">'
                                'Please look out for your QR code — it will be sent to you shortly before the event. '
                                'Present the QR code at the venue for check-in.</p>'
                                '<p style="font-size:14px;color:#555;line-height:1.6">'
                                'If you have any questions, please contact the family member who invited you.</p>'
                                '<p style="font-size:14px;color:#555">Warm regards,<br>THE LAWAL - OBELAWO FAMILY</p>'
                                '</div>'
                                '<div style="background:#07182f;color:#d9e8f7;padding:20px;text-align:center;font-size:11px">'
                                '<p style="margin:0">Accredit.vip — Premium Event Infrastructure</p>'
                                '</div>'
                                '</div>'
                            )
                        else:
                            from app.api.messaging import _build_qr_message
                            subject, _, html = _build_qr_message(guest, event, qr_image_url, custom_message=custom_message, qr_message=qr_message, message_type=message_type)

                        print(f"[Email Send] To: {guest.email}, Subject: {subject[:50]}")
                        ok = await asyncio.wait_for(send_email(guest.email, subject, html, from_addr=from_addr), timeout=15)
                        print(f"[Email Result] OK: {ok}")

                    elif ch == "whatsapp" and guest.phone:
                        if message_type == "confirmation":
                            invite_flier = "https://drive.google.com/uc?export=view&id=13LCDgOQcbF91ixwRt7W6_DkbH_GkhKcF"
                            whatsapp_msg = (
                                f"Dear {guest.name},\n\n"
                                f"Thank you for confirming your attendance for the Funeral Rites of Prince Amuda Youssouf Lawal-Obelawo, OON.\n\n"
                                f"📅 DATE: {_format_date(event.event_date)}\n"
                                f"🕐 TIME: {_format_time(event.event_time, event.timezone or 'WAT')}\n"
                                f"📍 VENUE: {event.venue}\n\n"
                                f"Please note, this invite admits only one person.\n\n"
                                f"Your QR code for check-in will be sent to you shortly before the event. "
                                f"If you don't receive it within 72 hours, kindly contact the family member who invited you.\n\n"
                                f"Warm regards,\n"
                                f"THE LAWAL - OBELAWO FAMILY"
                            )
                            print(f"[WhatsApp Send] To: {guest.phone}, Type: {message_type} - Text + Flyer")
                            confirm_sid = "HXb0df4712fa90f63db815b8152bf52e83"
                            cv = {"_content_sid": confirm_sid, "1": guest.name}
                            ok, provider_id = await _send_whatsapp(guest.phone, whatsapp_msg, content_vars=cv)
                        else:
                            from app.api.messaging import _build_qr_message
                            _, body, _ = _build_qr_message(guest, event, qr_image_url, custom_message=custom_message, qr_message=qr_message, message_type=message_type)
                            whatsapp_msg = body
                            media_url = _absolute_url(qr_image_url) if qr_image_url else None
                            print(f"[WhatsApp Send] To: {guest.phone}, Type: {message_type}, Media: {media_url is not None}")
                            ok, provider_id = await _send_whatsapp(guest.phone, whatsapp_msg, media_url=media_url)
                        print(f"[WhatsApp Result] OK: {ok}, Provider ID: {provider_id}")
                        if provider_id:
                            msg.provider_message_id = provider_id
                        elif not ok:
                            msg.error = provider_id
                    else:
                        msg.status = "skipped"
                        await db.flush()
                        continue

                    msg.status = "delivered" if ok else "failed"
                    if ok:
                        msg.sent_at = func.now()
                except Exception as e:
                    msg.status = "failed"
                    msg.error = str(e)

                await db.flush()

            await db.commit()
        except Exception as e:
            print(f'[Burial QR ERROR] {e}', flush=True)
            import traceback; traceback.print_exc()
            await db.rollback()


@router.get("/events/{event_id}/hosts", tags=["Burial"])
async def get_event_hosts(
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get all hosts for a burial event with guest counts (organizer view)."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or event.event_type != "burial":
        raise HTTPException(status_code=404, detail="Burial event not found")

    event_hosts = event.event_hosts or []
    all_host_names = []
    host_allocation_map = {}
    if event_hosts and isinstance(event_hosts[0], dict):
        for h in event_hosts:
            name = h.get("name", "")
            if name:
                all_host_names.append(name)
                host_allocation_map[name] = h.get("allocation")
    else:
        all_host_names = event_hosts

    from sqlalchemy import case
    agg_result = await db.execute(
        select(
            Guest.invited_by,
            func.count(Guest.id).label("total"),
            func.count(case((Guest.rsvp_status == "accepted", 1), else_=None)).label("accepted"),
            func.count(case((Guest.rsvp_status == "declined", 1), else_=None)).label("declined"),
        ).where(
            and_(Guest.event_id == event_id, Guest.invited_by.in_(all_host_names))
        ).group_by(Guest.invited_by)
    )
    rows = {r.invited_by: r for r in agg_result.all()}

    hosts_with_counts = []
    for host_name in all_host_names:
        row = rows.get(host_name)
        if row:
            total = row.total
            accepted = row.accepted
            declined = row.declined
        else:
            total = accepted = declined = 0
        pending = total - accepted - declined
        allocation = host_allocation_map.get(host_name)
        hosts_with_counts.append({
            "name": host_name,
            "allocation": allocation,
            "total_guests": total,
            "accepted": accepted,
            "declined": declined,
            "pending": pending,
        })

    return {
        "event": {
            "id": event.id,
            "title": event.title,
            "theme_color": getattr(event, "theme_color", "#1a1a1a") or "#1a1a1a",
        },
        "hosts": hosts_with_counts,
    }


@router.get("/events/{event_id}/hosts/{host_name}/guests", tags=["Burial"])
async def get_host_guests(
    event_id: int,
    host_name: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all guests for a specific host (organizer view)."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or event.event_type != "burial":
        raise HTTPException(status_code=404, detail="Burial event not found")

    guests_result = await db.execute(
        select(Guest).where(
            and_(Guest.event_id == event_id, Guest.invited_by == host_name)
        ).order_by(Guest.rsvp_status.desc(), Guest.name)
    )
    guests = guests_result.scalars().all()

    guest_ids = [g.id for g in guests]
    msg_rows = []

    # Get message counts per guest per message_type
    message_counts: dict[int, dict[str, int]] = {}
    if guest_ids:
        count_result = await db.execute(
            select(
                InviteMessage.guest_id,
                InviteMessage.message_type,
                func.count(InviteMessage.id).label('cnt'),
            ).where(
                InviteMessage.guest_id.in_(guest_ids)
            ).group_by(InviteMessage.guest_id, InviteMessage.message_type)
        )
        for row in count_result.all():
            gid = row.guest_id
            if gid not in message_counts:
                message_counts[gid] = {}
            mt = row.message_type or "unknown"
            message_counts[gid][mt] = row.cnt

    if guest_ids:
        latest_subq = (
            select(
                InviteMessage.id,
                InviteMessage.guest_id,
                InviteMessage.channel,
                InviteMessage.message_type,
                InviteMessage.status,
                InviteMessage.sent_at,
                InviteMessage.delivered_at,
                InviteMessage.opened_at,
                InviteMessage.error,
                func.row_number().over(
                    partition_by=[InviteMessage.guest_id, InviteMessage.channel, InviteMessage.message_type],
                    order_by=InviteMessage.id.desc()
                ).label('rn')
            )
            .where(InviteMessage.guest_id.in_(guest_ids))
            .subquery()
        )
        messages_result = await db.execute(
            select(
                latest_subq.c.guest_id,
                latest_subq.c.channel,
                latest_subq.c.message_type,
                latest_subq.c.status,
                latest_subq.c.sent_at,
                latest_subq.c.delivered_at,
                latest_subq.c.opened_at,
                latest_subq.c.error,
            ).where(latest_subq.c.rn == 1)
        )
        msg_rows = messages_result.all()

    msg_map: dict[int, list] = {}
    for row in msg_rows:
        opened = row.opened_at is not None
        status = "read" if opened else (row.status or "queued")
        msg_map.setdefault(row.guest_id, []).append({
            "channel": row.channel,
            "message_type": row.message_type or "invite",
            "status": status,
            "sent_at": row.sent_at.isoformat() if row.sent_at else None,
            "delivered_at": row.delivered_at.isoformat() if row.delivered_at else None,
            "opened_at": row.opened_at.isoformat() if row.opened_at else None,
            "error": row.error,
        })

    def _msg_status(msgs: list, msg_type: str, channel: str) -> str:
        filtered = [m for m in msgs if m["message_type"] == msg_type and m["channel"] == channel]
        if not filtered:
            return "none"
        if any(m["status"] == "read" for m in filtered):
            return "read"
        if any(m["status"] == "delivered" for m in filtered):
            return "delivered"
        if any(m["status"] == "pending" for m in filtered):
            return "pending"
        if any(m["status"] == "failed" for m in filtered):
            return "failed"
        if any(m["status"] == "sent" for m in filtered):
            return "sent"
        return "pending"

    guest_list = []
    for guest in guests:
        qr_sent = len(guest.qr_codes) > 0 if guest.qr_codes else False
        msgs = msg_map.get(guest.id, [])
        counts = message_counts.get(guest.id, {})

        delivery_status = "none"
        if msgs:
            statuses = [m["status"] for m in msgs]
            if any(s == "read" for s in statuses):
                delivery_status = "read"
            elif any(s == "delivered" for s in statuses):
                delivery_status = "delivered"
            elif any(s == "sent" for s in statuses):
                delivery_status = "sent"
            elif any(s == "pending" for s in statuses):
                delivery_status = "pending"
            elif any(s == "failed" for s in statuses):
                delivery_status = "failed"
            else:
                delivery_status = "none"

        guest_list.append({
            "id": guest.id,
            "name": guest.name,
            "phone": guest.phone,
            "email": guest.email,
            "rsvp_status": guest.rsvp_status,
            "qr_sent": qr_sent,
            "delivery_status": delivery_status,
            "delivery_confirmatory_whatsapp": _msg_status(msgs, "confirmation", "whatsapp"),
            "delivery_confirmatory_email": _msg_status(msgs, "confirmation", "email"),
            "delivery_qr_whatsapp": _msg_status(msgs, "qr_only", "whatsapp"),
            "delivery_qr_email": _msg_status(msgs, "qr_only", "email"),
            "message_counts": counts,
            "messages": msgs,
            "created_at": guest.created_at.isoformat() if guest.created_at else None,
        })

    return {"host": host_name, "guests": guest_list}


@router.post("/events/{event_id}/hosts/{host_name}/guests/confirm", tags=["Burial"])
async def confirm_host_guests(
    event_id: int,
    host_name: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Bulk confirm guests for a host."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or event.event_type != "burial":
        raise HTTPException(status_code=404, detail="Burial event not found")

    guest_ids = data.get("guest_ids", [])

    if guest_ids:
        guests_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event_id,
                    Guest.invited_by == host_name,
                    Guest.id.in_(guest_ids)
                )
            )
        )
    else:
        guests_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event_id,
                    Guest.invited_by == host_name,
                    Guest.rsvp_status == "pending"
                )
            )
        )

    guests = guests_result.scalars().all()
    for guest in guests:
        guest.rsvp_status = "accepted"

    await db.commit()

    return {
        "status": "success",
        "confirmed_count": len(guests),
        "message": f"Confirmed {len(guests)} guest(s) for {host_name}",
    }


@router.put("/events/{event_id}/hosts/{host_name}/guests/{guest_id}", tags=["Burial"])
async def update_host_guest(
    event_id: int,
    host_name: str,
    guest_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Edit a guest's details."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or event.event_type != "burial":
        raise HTTPException(status_code=404, detail="Burial event not found")

    guest_result = await db.execute(
        select(Guest).where(
            and_(
                Guest.event_id == event_id,
                Guest.invited_by == host_name,
                Guest.id == guest_id,
            )
        )
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    if "name" in data:
        guest.name = data["name"]
    if "phone" in data:
        guest.phone = _normalize_phone(data["phone"])
    if "email" in data:
        guest.email = data["email"]

    await db.commit()
    return {"status": "success", "guest": {"id": guest.id, "name": guest.name, "phone": guest.phone, "email": guest.email}}


@router.delete("/events/{event_id}/hosts/{host_name}/guests/{guest_id}", tags=["Burial"])
async def delete_host_guest(
    event_id: int,
    host_name: str,
    guest_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a guest."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or event.event_type != "burial":
        raise HTTPException(status_code=404, detail="Burial event not found")

    guest_result = await db.execute(
        select(Guest).where(
            and_(
                Guest.event_id == event_id,
                Guest.invited_by == host_name,
                Guest.id == guest_id,
            )
        )
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    await db.execute(
        delete(InviteMessage).where(InviteMessage.guest_id == guest_id)
    )
    await db.execute(
        delete(QRCode).where(QRCode.guest_id == guest_id)
    )
    await db.execute(
        delete(CheckIn).where(CheckIn.guest_id == guest_id)
    )
    await db.delete(guest)
    await db.commit()
    return {"status": "success", "message": "Guest deleted"}


@router.post("/events/{event_id}/hosts/{host_name}/guests/send-message", tags=["Burial"])
async def send_host_guests_message(
    event_id: int,
    host_name: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Send confirmation message and/or QR to guests."""
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event or event.event_type != "burial":
        raise HTTPException(status_code=404, detail="Burial event not found")

    guest_ids = data.get("guest_ids", [])
    message_type = data.get("message_type", "confirmation")
    custom_message = data.get("custom_message", "")
    qr_message = data.get("qr_message", "")
    resend_anyway = data.get("resend_anyway", False)

    if guest_ids:
        guests_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event_id,
                    Guest.invited_by == host_name,
                    Guest.id.in_(guest_ids)
                )
            )
        )
    else:
        guests_result = await db.execute(
            select(Guest).where(
                and_(
                    Guest.event_id == event_id,
                    Guest.invited_by == host_name,
                    Guest.rsvp_status == "accepted"
                )
            )
        )

    guests = guests_result.scalars().all()

    sent_count = 0
    skipped_count = 0
    for guest in guests:
        message_count_result = await db.execute(
            select(func.count(InviteMessage.id)).where(
                and_(
                    InviteMessage.guest_id == guest.id,
                    InviteMessage.message_type == message_type,
                    InviteMessage.channel.in_(["email", "whatsapp"])
                )
            )
        )
        already_sent_count = message_count_result.scalar() or 0

        if already_sent_count >= 3 and not resend_anyway:
            skipped_count += 1
            continue

        asyncio.create_task(
            _send_burial_qr(
                guest.id, event.id,
                custom_message=custom_message or None,
                qr_message=qr_message or None,
                message_type=message_type,
            )
        )
        sent_count += 1

    return {
        "status": "success",
        "batch_id": f"batch_{event_id}_{host_name}_{datetime.now(timezone.utc).timestamp()}",
        "message_count": sent_count,
        "skipped_count": skipped_count,
        "message": f"Sending to {sent_count} guest(s)" + (f", skipped {skipped_count} (already sent 3+ times)" if skipped_count else ""),
    }


@router.get("/host/{token}", tags=["Burial"])
async def get_host_dashboard(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Get host dashboard data by token — no login required."""
    events_result = await db.execute(
        select(Event).where(Event.event_type == "burial")
    )
    all_events = events_result.scalars().all()

    matched_host = None
    matched_event = None
    for event in all_events:
        hosts = event.event_hosts or []
        if isinstance(hosts, list):
            for h in hosts:
                if isinstance(h, dict) and h.get("token") == token:
                    matched_host = h["name"]
                    matched_event = event
                    break
        if matched_host:
            break

    if not matched_host or not matched_event:
        raise HTTPException(status_code=404, detail="Invalid host link")

    guests_result = await db.execute(
        select(Guest).where(
            and_(
                Guest.event_id == matched_event.id,
                Guest.invited_by == matched_host,
            )
        ).order_by(Guest.created_at.desc())
    )
    guests = guests_result.scalars().all()

    total = len(guests)
    accepted = sum(1 for g in guests if g.rsvp_status == "accepted")
    declined = sum(1 for g in guests if g.rsvp_status == "declined")
    pending = total - accepted - declined

    return {
        "event": {
            "id": matched_event.id,
            "title": matched_event.title,
            "theme_color": getattr(matched_event, "theme_color", "#1A2554") or "#1A2554",
            "cover_image": matched_event.cover_image,
            "date": str(matched_event.event_date),
            "venue": matched_event.venue,
        },
        "host": {
            "name": matched_host,
        },
        "stats": {
            "total": total,
            "accepted": accepted,
            "declined": declined,
            "pending": pending,
        },
        "guests": [
            {
                "id": g.id,
                "name": g.name,
                "phone": g.phone,
                "email": g.email,
                "rsvp_status": g.rsvp_status,
                "qr_sent": False,
                "created_at": str(g.created_at) if g.created_at else None,
            }
            for g in guests
        ],
    }
