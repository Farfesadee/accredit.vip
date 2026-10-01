"""Invite sending and delivery tracking API."""

import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.invite import InviteBatch, InviteMessage
from app.services.email_notifications import send_guest_invitation
from app.api.messaging import _send_to_guest

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

router = APIRouter()


class SendInvitesRequest(BaseModel):
    event_id: int
    channels: List[str]
    custom_message: Optional[str] = None
    guest_ids: Optional[List[int]] = None


@router.post("/invites/send")
async def send_invites(
    req: SendInvitesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send invitations to guests."""
    event_result = await db.execute(
        select(Event).where(Event.id == req.event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guests_query = select(Guest).where(Guest.event_id == req.event_id)
    if req.guest_ids:
        guests_query = guests_query.where(Guest.id.in_(req.guest_ids))

    guests_result = await db.execute(guests_query)
    guests = guests_result.scalars().all()

    if not guests:
        raise HTTPException(status_code=400, detail="No guests to send to")

    send_results = []
    invites_sent = 0

    for guest in guests:
        for channel in req.channels:
            try:
                has_contact = (channel == "email" and guest.email) or (channel in ("whatsapp", "sms") and guest.phone)
                if not has_contact:
                    send_results.append({
                        "guest_id": guest.id,
                        "channel": channel,
                        "status": "failed",
                        "reason": f"No {channel} contact info",
                    })
                    continue

                batch = InviteBatch(event_id=event.id, channel=channel)
                db.add(batch)
                await db.flush()

                if channel == "email":
                    rsvp_link = f"{settings.FRONTEND_URL}/rsvp/{guest.rsvp_token}"

                    # Create InviteMessage record for tracking
                    msg = InviteMessage(batch_id=batch.id, guest_id=guest.id, channel="email")
                    db.add(msg)
                    await db.flush()

                    # Read cover image if available
                    image_data = None
                    if event.cover_image:
                        try:
                            image_path = os.path.join(UPLOAD_DIR, os.path.basename(event.cover_image))
                            if os.path.exists(image_path):
                                with open(image_path, 'rb') as f:
                                    image_data = f.read()
                        except Exception as e:
                            print(f"Warning: Failed to read cover image: {e}")

                    ok = await send_guest_invitation(
                        guest_email=guest.email,
                        guest_name=guest.name,
                        event_title=event.title,
                        event_date=str(event.event_date),
                        event_time=str(event.event_time),
                        venue=event.venue,
                        host_name=event.host_name,
                        rsvp_link=rsvp_link,
                        custom_message=req.custom_message,
                        dress_code=event.dress_code,
                        male_dress_code=event.male_dress_code,
                        female_dress_code=event.female_dress_code,
                        image_data=image_data,
                        message_id=msg.id,
                    )
                    if ok:
                        msg.status = "delivered"
                        msg.sent_at = func.now()
                    else:
                        msg.status = "failed"
                        msg.error = "Email send returned failure"
                    guest.invite_sent = True
                    guest.invite_attempts += 1
                    invites_sent += 1
                    send_results.append({
                        "guest_id": guest.id,
                        "channel": channel,
                        "status": msg.status,
                    })
                else:
                    ok, status = await _send_to_guest(guest, event, channel, batch.id, db)
                    if ok:
                        guest.invite_sent = True
                        invites_sent += 1
                    send_results.append({
                        "guest_id": guest.id,
                        "channel": channel,
                        "status": status,
                    })

                batch.total_sent = 1
                batch.status = "completed"
            except Exception as e:
                send_results.append({
                    "guest_id": guest.id,
                    "channel": channel,
                    "status": "failed",
                    "reason": str(e),
                })

    await db.commit()

    return {
        "invites_sent": invites_sent,
        "results": send_results,
    }


@router.get("/invites/{event_id}")
async def list_invites(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all invites for an event."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(InviteMessage).where(InviteMessage.guest_id.in_(
            select(Guest.id).where(Guest.event_id == event_id)
        ))
    )
    invites = result.scalars().all()

    return invites


@router.get("/invites/{event_id}/analytics")
async def get_invite_analytics(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get invite analytics for an event."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(InviteMessage).where(InviteMessage.guest_id.in_(
            select(Guest.id).where(Guest.event_id == event_id)
        ))
    )
    messages = result.scalars().all()

    by_channel = {}
    for channel in ["email", "whatsapp", "sms"]:
        channel_messages = [m for m in messages if m.channel == channel]
        if channel_messages:
            by_channel[channel] = {
                "total": len(channel_messages),
                "sent": len([m for m in channel_messages if m.sent_at]),
                "delivered": len([m for m in channel_messages if m.delivered_at]),
                "opened": len([m for m in channel_messages if m.opened_at]),
                "failed": len([m for m in channel_messages if m.status == "failed"]),
            }

    return {
        "total_invites": len(messages),
        "by_channel": by_channel,
    }
