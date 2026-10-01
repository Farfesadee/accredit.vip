"""Endpoints for failed message reports across all events."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.invite import InviteBatch, InviteMessage

router = APIRouter(prefix="/api/v1", tags=["Failed Messages"])

ERROR_MEANINGS: dict[str, str] = {
    "63016": "WhatsApp 24-hour window expired: recipient must message the business number first to open a new window.",
    "63024": "WhatsApp sender pending production approval: complete Meta Business verification or use an approved sender.",
    "63012": "WhatsApp message undeliverable: number may be invalid or not registered on WhatsApp.",
    "invalid phone": "Phone number format is invalid: must include country code (e.g. +234XXXXXXXXXX).",
    "no email": "Guest has no email address on record.",
    "no phone": "Guest has no phone number on record.",
    "smtp auth": "Email SMTP authentication failed: check SMTP username/password in settings.",
    "smtp connect": "Could not connect to email server: check SMTP host, port, and firewall.",
    "timed out": "Message sending timed out: server may be slow or unreachable.",
    "gmail rejected": "Gmail rejected the message: may be flagged as spam or sender domain lacks SPF/DKIM.",
    "blocked": "Message blocked by recipient's email provider.",
    "spam": "Message flagged as spam by recipient's provider.",
    "invalid email": "Email address format is invalid.",
    "rate limit": "Too many messages sent too quickly: rate limit exceeded. Try again later.",
    "network error": "Network error: check internet connection and try again.",
    "authentication": "Authentication failed: check API keys or credentials.",
    "not found": "Recipient contact could not be found.",
}


def _get_error_meaning(error: str | None) -> str:
    if not error:
        return ""
    error_lower = error.lower()
    for key, meaning in ERROR_MEANINGS.items():
        if key in error_lower:
            return meaning
    return f"Unknown error. {error}"


@router.get("/failed-messages")
async def get_failed_messages(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    event_id: int | None = Query(None, description="Filter by event ID"),
    channel: str = Query("all", description="Filter: all, email, whatsapp, sms"),
):
    """Return failed messages as JSON for the frontend table."""
    events_subq = select(Event.id).where(Event.organizer_id == user.id).subquery()

    query = (
        select(
            InviteMessage.id,
            InviteMessage.channel,
            InviteMessage.status,
            InviteMessage.error,
            InviteMessage.sent_at,
            InviteMessage.created_at,
            Guest.name.label("guest_name"),
            Guest.email.label("guest_email"),
            Guest.phone.label("guest_phone"),
            Event.title.label("event_title"),
            Event.id.label("event_id"),
        )
        .join(InviteBatch, InviteMessage.batch_id == InviteBatch.id)
        .join(Guest, InviteMessage.guest_id == Guest.id)
        .join(Event, InviteBatch.event_id == Event.id)
        .where(InviteMessage.status == "failed")
        .where(Event.id.in_(events_subq))
    )
    if event_id:
        query = query.where(Event.id == event_id)
    if channel and channel != "all":
        query = query.where(InviteMessage.channel == channel)
    query = query.order_by(InviteMessage.created_at.desc()).limit(500)

    result = await db.execute(query)
    rows = result.all()

    return [
        {
            "id": r.id,
            "event_id": r.event_id,
            "event_title": r.event_title,
            "guest_name": r.guest_name,
            "channel": r.channel,
            "status": r.status,
            "contact": r.guest_email if r.channel == "email" else r.guest_phone or "",
            "error": r.error or "",
            "error_meaning": _get_error_meaning(r.error),
            "sent_at": r.sent_at.isoformat() if r.sent_at else "",
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.get("/failed-messages/export")
async def export_failed_messages(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    event_id: int | None = Query(None, description="Filter by event ID"),
    channel: str = Query("all", description="Filter: all, email, whatsapp, sms"),
):
    """Export failed messages as CSV."""
    events_subq = select(Event.id).where(Event.organizer_id == user.id).subquery()

    query = (
        select(
            InviteMessage.id,
            InviteMessage.channel,
            InviteMessage.status,
            InviteMessage.error,
            InviteMessage.sent_at,
            InviteMessage.created_at,
            Guest.name.label("guest_name"),
            Guest.email.label("guest_email"),
            Guest.phone.label("guest_phone"),
            Event.title.label("event_title"),
            Event.id.label("event_id"),
        )
        .join(InviteBatch, InviteMessage.batch_id == InviteBatch.id)
        .join(Guest, InviteMessage.guest_id == Guest.id)
        .join(Event, InviteBatch.event_id == Event.id)
        .where(InviteMessage.status == "failed")
        .where(Event.id.in_(events_subq))
    )
    if event_id:
        query = query.where(Event.id == event_id)
    if channel and channel != "all":
        query = query.where(InviteMessage.channel == channel)
    query = query.order_by(InviteMessage.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    import csv, io
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "Event", "Guest Name", "Channel", "Contact", "Status",
        "Error Message", "Error Meaning", "Sent At",
    ])
    for r in rows:
        contact = r.guest_email if r.channel == "email" else r.guest_phone or ""
        writer.writerow([
            r.event_title, r.guest_name, r.channel, contact,
            r.status, r.error or "", _get_error_meaning(r.error),
            r.sent_at.isoformat() if r.sent_at else "",
        ])

    from fastapi.responses import StreamingResponse
    filename = f"failed-messages-{event_id or 'all'}-{channel}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
