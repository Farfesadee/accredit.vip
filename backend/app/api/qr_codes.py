import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.qr_code import QRCode

router = APIRouter()


async def get_or_create_guest_qr(db: AsyncSession, event_id: int, guest_id: int) -> QRCode:
    existing_result = await db.execute(
        select(QRCode).where(
            QRCode.guest_id == guest_id,
            QRCode.event_id == event_id,
            QRCode.is_used == False,  # noqa: E712
        ).order_by(QRCode.created_at.desc())
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing

    qr = QRCode(
        guest_id=guest_id,
        event_id=event_id,
        token=secrets.token_urlsafe(32),
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(qr)
    await db.flush()
    return qr


@router.post("/{event_id}/guests/{guest_id}/qr")
async def generate_qr(
    event_id: int,
    guest_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")

    guest_result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.event_id == event_id)
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    qr = await get_or_create_guest_qr(db, event_id, guest_id)
    await db.commit()
    await db.refresh(qr)

    return {
        "id": qr.id,
        "token": qr.token,
        "guest": {"id": guest.id, "name": guest.name},
        "expires_at": qr.expires_at.isoformat(),
        "qr_url": f"/api/v1/qr/{qr.token}",
        "animated_qr_url": f"/api/v1/qr/{qr.token}?style=animated",
    }


@router.get("/{event_id}/guests/{guest_id}/qr")
async def get_guest_qr(
    event_id: int,
    guest_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QRCode).where(
            QRCode.guest_id == guest_id,
            QRCode.event_id == event_id,
        ).order_by(QRCode.created_at.desc())
    )
    qr = result.scalar_one_or_none()
    if not qr:
        raise HTTPException(status_code=404, detail="No QR code found")

    return {
        "id": qr.id,
        "token": qr.token,
        "is_used": qr.is_used,
        "expires_at": qr.expires_at.isoformat() if qr.expires_at else None,
    }
