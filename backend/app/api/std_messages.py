"""Save the Date message sending API - Event 46 (ALEX BIRTHDAY BREAKFAST) only."""

import asyncio
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image, ImageDraw, ImageFont

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.std_message import STDMessageBatch, STDMessage
from app.api.messaging import _send_whatsapp
from app.services.email_service import send_email_with_images

router = APIRouter()

STD_EVENT_ID = 46

STD_IMAGE_FILENAME = "std_image.jpeg"
STD_IMAGE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads", STD_IMAGE_FILENAME
)
STD_IMAGE_URL = f"{settings.FRONTEND_URL}/uploads/{STD_IMAGE_FILENAME}"

STD_LOG_FILE = "/tmp/std_messages.log"


def _std_log(msg: str):
    with open(STD_LOG_FILE, "a") as f:
        f.write(f"[{datetime.now(timezone.utc).isoformat()}] {msg}\n")


class SendSTDRequest(BaseModel):
    channels: List[str]
    guest_ids: Optional[List[int]] = None
    force_resend: Optional[bool] = False


def _is_event_46(event_id: int) -> bool:
    return event_id == STD_EVENT_ID


def _overlay_greeting(guest_name: str) -> tuple[str, str]:
    img = Image.open(STD_IMAGE_PATH)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
    except Exception:
        font = ImageFont.load_default()
    text = f"Dear {guest_name},"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (img.width - tw) // 2
    draw.text((x + 2, 42), text, font=font, fill=(0, 0, 0, 80))
    draw.text((x, 40), text, font=font, fill=(255, 255, 255))
    uploads_dir = os.path.dirname(STD_IMAGE_PATH)
    filename = f"std_overlay_{abs(hash(text))}.jpeg"
    filepath = os.path.join(uploads_dir, filename)
    img.save(filepath, "JPEG", quality=92)
    url = f"{settings.FRONTEND_URL}/uploads/{filename}"
    return filepath, url


def _build_std_subject() -> str:
    return "SAVE THE DATE - ALEX\u2019s BIRTHDAY BREAKFAST"


def _build_std_email_html(guest_name: str) -> str:
    return (
        '<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#1a1a2e">'
        '<div style="padding:28px 28px 8px;background:#ffffff;text-align:left;font-size:16px;line-height:1.6">'
        f'Dear {guest_name},<br/><br/>'
        '</div>'
        '<div style="padding:8px 28px 32px;background:#ffffff;text-align:center">'
        '<img src="cid:std_image" alt="Save the Date" style="max-width:100%;height:auto;display:block;margin:0 auto" />'
        '</div>'
        '</div>'
    )


@router.post("/events/{event_id}/send-std")
async def send_std_messages(
    event_id: int,
    req: SendSTDRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send Save the Date messages to guests - Event 46 only."""

    _std_log(f"send_std_messages called for event {event_id}, channels={req.channels}, guest_ids={req.guest_ids}")

    if not _is_event_46(event_id):
        raise HTTPException(status_code=403, detail="STD sending only available for specific events")

    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guests_query = select(Guest).where(Guest.event_id == event_id)
    if req.guest_ids:
        guests_query = guests_query.where(Guest.id.in_(req.guest_ids))

    guests_result = await db.execute(guests_query)
    guests = guests_result.scalars().all()
    _std_log(f"guests_fetched count={len(guests)}")

    if not guests:
        raise HTTPException(status_code=400, detail="No guests to send to")

    std_send_counts = {}
    for guest in guests:
        count_result = await db.execute(
            select(func.count(STDMessage.id)).where(
                STDMessage.guest_id == guest.id,
                STDMessage.batch_id.in_(
                    select(STDMessageBatch.id).where(STDMessageBatch.event_id == event_id)
                )
            )
        )
        std_send_counts[guest.id] = count_result.scalar() or 0

    send_results = {"channels": {}}
    subject = _build_std_subject()
    _std_log(f"starting_channel_loop channels={req.channels}")

    for channel in req.channels:
        if channel not in ["email", "whatsapp"]:
            continue

        send_results["channels"][channel] = {"sent": 0, "failed": 0, "total": 0}

        batch = STDMessageBatch(event_id=event_id, channel=channel)
        db.add(batch)
        await db.flush()

        for guest in guests:
            _std_log(f"processing guest={guest.id} channel={channel} force={req.force_resend} prev_count={std_send_counts.get(guest.id, 0)} email={guest.email} phone={guest.phone}")
            if not req.force_resend and std_send_counts.get(guest.id, 0) >= 3:
                _std_log(f"skipping guest={guest.id} max_resend_reached")
                continue

            has_contact = (channel == "email" and guest.email) or (channel == "whatsapp" and guest.phone)
            if not has_contact:
                _std_log(f"skipping guest={guest.id} no_contact for {channel}")
                continue

            msg = STDMessage(batch_id=batch.id, guest_id=guest.id, channel=channel)
            msg.sent_at = datetime.now(timezone.utc)
            db.add(msg)
            await db.flush()

            success = False
            error_msg = None

            try:
                if channel == "email":
                    guest_name = guest.name or guest.email.split('@')[0]
                    from_addr = f"SAVE THE DATE <noreply@wristbandsng.com>"
                    email_html = _build_std_email_html(guest_name)
                    image_path = STD_IMAGE_PATH
                    _std_log(f"EMAIL guest={guest.id} image_exists={os.path.exists(image_path)}")
                    if os.path.exists(image_path):
                        success = await asyncio.wait_for(
                            send_email_with_images(
                                guest.email, subject, email_html,
                                images=[("std_image", image_path)],
                                from_addr=from_addr
                            ),
                            timeout=20
                        )
                    else:
                        print(f"[STD] Image not found at {image_path}, trying URL fallback")
                        from app.services.email_service import send_email
                        html_fallback = email_html.replace(
                            'src="cid:std_image"',
                            f'src="{STD_IMAGE_URL}"'
                        )
                        success = await asyncio.wait_for(
                            send_email(guest.email, subject, html_fallback, from_addr=from_addr),
                            timeout=15
                        )
                    _std_log(f"EMAIL guest={guest.id} email={guest.email} ok={success}")
                    if not success:
                        error_msg = "Email send failed"

                elif channel == "whatsapp":
                    guest_name = guest.name or "Guest"
                    overlay_path, overlay_url = _overlay_greeting(guest_name)
                    success1, pid1 = await _send_whatsapp(guest.phone, "", media_url=overlay_url)
                    _std_log(f"WA guest={guest.id} phone={guest.phone} image_send=ok={success1} pid={pid1}")
                    title = event.title or "SAVE THE DATE"
                    success2, pid2 = await _send_whatsapp(guest.phone, title, media_url=None)
                    _std_log(f"WA guest={guest.id} phone={guest.phone} text_send=ok={success2} pid={pid2}")
                    success = success1 and success2
                    provider_id = pid1 or pid2
                    if provider_id and success:
                        msg.provider_message_id = provider_id
                    elif not success:
                        error_msg = provider_id or "WhatsApp send failed"
            except Exception as e:
                success = False
                error_msg = str(e)
                print(f"[STD] Exception for guest {guest.id} ({channel}): {e}")

            if success:
                msg.status = "delivered"
                msg.delivered_at = datetime.now(timezone.utc)
                send_results["channels"][channel]["sent"] += 1
            else:
                msg.status = "failed"
                msg.error = error_msg
                send_results["channels"][channel]["failed"] += 1

            # Commit each message individually so status is never lost
            await db.commit()

        send_results["channels"][channel]["total"] = len([g for g in guests if (channel == "email" and g.email) or (channel == "whatsapp" and g.phone)])

    return {
        "status": "success",
        "channels": send_results["channels"],
        "event_id": event_id,
    }


@router.get("/events/{event_id}/std-status")
async def get_std_status(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get STD send status for event 46."""

    if not _is_event_46(event_id):
        raise HTTPException(status_code=403, detail="STD status only available for specific events")

    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guests_result = await db.execute(
        select(Guest).where(Guest.event_id == event_id)
    )
    guests = guests_result.scalars().all()

    guest_std_counts = {}
    for guest in guests:
        count_result = await db.execute(
            select(func.count(STDMessage.id)).where(
                STDMessage.guest_id == guest.id,
                STDMessage.batch_id.in_(
                    select(STDMessageBatch.id).where(STDMessageBatch.event_id == event_id)
                )
            )
        )
        guest_std_counts[guest.id] = count_result.scalar() or 0

    return {"event_id": event_id, "guest_std_counts": guest_std_counts}
