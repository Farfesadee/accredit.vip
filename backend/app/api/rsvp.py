"""RSVP handling endpoints."""

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db, async_session
from app.core.config import settings
from app.models.guest import Guest
from app.models.event import Event
from app.models.flier import FlierAsset
from app.models.invite import InviteBatch, InviteMessage
from app.api.qr_codes import get_or_create_guest_qr
from app.services.email_service import send_email
from app.services.sms_service import send_sms
from app.services.whatsapp_service import send_whatsapp
from app.services.whatsapp_cloud_service import send_whatsapp_cloud
from app.services.qr_service import qr_to_url

router = APIRouter()


class RSVPResponse(BaseModel):
    response: str
    note: str | None = None


async def _send_whatsapp(to: str, message: str, media_url: str | None = None) -> tuple[bool, str | None]:
    if settings.WHATSAPP_CLOUD_TOKEN and settings.WHATSAPP_CLOUD_PHONE_ID:
        ok = await send_whatsapp_cloud(to, message, media_url)
        if ok:
            return ok, None
    return await send_whatsapp(to, message, media_url)


def _absolute_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return f"{settings.FRONTEND_URL}{url}"
    return url


def _upload_path_from_url(url: str) -> str:
    import os
    upload_base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    if "/uploads/" in url:
        relative = url.rstrip("/").split("/uploads/")[-1]
    elif url.startswith("/uploads/"):
        relative = url[len("/uploads/"):]
    else:
        relative = url.lstrip("/")
    return os.path.join(upload_base, relative)


async def _send_qr_after_rsvp(guest_id: int, event_id: int):
    """Fire-and-forget task to send QR code to a guest after they RSVP 'yes'."""
    async with async_session() as db:
        try:
            guest_result = await db.execute(select(Guest).where(Guest.id == guest_id))
            guest = guest_result.scalar_one_or_none()
            event_result = await db.execute(select(Event).where(Event.id == event_id))
            event = event_result.scalar_one_or_none()
            if not guest or not event:
                return

            qr = await get_or_create_guest_qr(db, event_id, guest_id)
            qr_token_url = f"{settings.FRONTEND_URL}/qr/{qr.token}"

            flyer_result = await db.execute(
                select(FlierAsset).where(FlierAsset.event_id == event_id).order_by(FlierAsset.created_at.desc())
            )
            flyer = flyer_result.scalar_one_or_none()
            flyer_url = flyer.url if flyer else event.cover_image
            qr_image_path = _upload_path_from_url(flyer_url) if flyer_url else None
            qr_image_url = qr_to_url(qr_token_url, image_path=qr_image_path, size=250)

            channels = []
            if guest.email:
                channels.append("email")
            if guest.phone:
                channels.append("whatsapp")

            for ch in channels:
                batch = InviteBatch(event_id=event_id, channel=ch)
                db.add(batch)
                await db.flush()

                from app.api.messaging import _build_qr_message, _send_whatsapp as _shared_send_whatsapp
                subject, body, html = _build_qr_message(guest, event, qr_image_url, flyer_url=flyer_url)

                msg = InviteMessage(batch_id=batch.id, guest_id=guest.id, channel=ch)
                db.add(msg)

                try:
                    if ch == "email" and guest.email:
                        from_addr = f"{event.title} <noreply@wristbandsng.com>"
                        ok = await asyncio.wait_for(send_email(guest.email, subject, html, from_addr=from_addr), timeout=15)
                    elif ch == "whatsapp" and guest.phone:
                        qr_media_url = _absolute_url(qr_image_url)
                        flyer_media_url = _absolute_url(flyer_url)
                        media_urls = [m for m in (flyer_media_url, qr_media_url) if m]
                        qr_content_sid = settings.TWILIO_WHATSAPP_QR_CONTENT_SID
                        # Best-effort: deliver the flyer + QR image directly (free-form).
                        # This sends the actual QR code (with flyer) whenever the 24h
                        # free-form window is open. For cold contacts it fails, so we
                        # fall back to the approved template (which carries the flyer as
                        # a header image): Meta rejects dynamic QR images/links in
                        # templates, so the template points the guest to their email for
                        # the QR code itself.
                        ok = False
                        provider_id = None
                        if media_urls:
                            media_kwargs = {"media_urls": media_urls} if len(media_urls) > 1 else {"media_url": media_urls[0]}
                            ok, provider_id = await _shared_send_whatsapp(guest.phone, body, **media_kwargs)
                        if not ok and qr_content_sid:
                            content_vars = {"1": guest.name or "", "_content_sid": qr_content_sid}
                            ok, provider_id = await _shared_send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
                        elif not ok:
                            ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=qr_media_url)
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
        except Exception:
            await db.rollback()


@router.get("/rsvp/{token}")
async def get_rsvp_data(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Get event and guest data for RSVP link."""
    guest_result = await db.execute(
        select(Guest).where(Guest.rsvp_token == token)
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="This QR code is from a test preview: it isn't linked to any real event. Create an account at Accredit.vip to generate real QR codes for your guests!")

    event_result = await db.execute(
        select(Event).where(Event.id == guest.event_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return {
        "event_title": event.title,
        "event_date": str(event.event_date),
        "event_time": str(event.event_time),
        "venue": event.venue,
        "host_name": event.host_name,
        "guest_name": guest.name,
        "cover_image": event.cover_image or None,
        "event_theme_color": getattr(event, "theme_color", "#E91E8C") or "#E91E8C",
        "rsvp_status": guest.rsvp_status,
        "rsvp_note": guest.rsvp_note,
        "rsvp_open": getattr(event, "rsvp_open", True),
    }


@router.post("/rsvp/{token}")
async def submit_rsvp(
    token: str,
    rsvp: RSVPResponse,
    db: AsyncSession = Depends(get_db),
):
    """Submit RSVP response. On 'yes', triggers QR code delivery."""
    guest_result = await db.execute(
        select(Guest).where(Guest.rsvp_token == token)
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="This QR code is from a test preview: it isn't linked to any real event. Create an account at Accredit.vip to generate real QR codes for your guests!")

    event_result = await db.execute(
        select(Event).where(Event.id == guest.event_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if getattr(event, "rsvp_open", True) is False:
        raise HTTPException(status_code=403, detail="RSVP for this event is closed.")

    response_lower = rsvp.response.lower()
    if response_lower == "yes":
        guest.rsvp_status = "accepted"
    elif response_lower == "no":
        guest.rsvp_status = "declined"
    else:
        raise HTTPException(status_code=400, detail="Invalid response. Use 'yes' or 'no'")

    if rsvp.note:
        guest.rsvp_note = rsvp.note

    from datetime import datetime
    guest.rsvped_at = datetime.utcnow()

    await db.commit()

    # Fire QR delivery asynchronously for accepted responses
    if response_lower == "yes":
        asyncio.create_task(_send_qr_after_rsvp(guest.id, event.id))

    return {
        "status": "success",
        "guest_name": guest.name,
        "response": response_lower,
        "message": "Your attendance has been recorded" if response_lower == "yes" else "Your response has been recorded",
    }
