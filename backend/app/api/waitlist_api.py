from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.models.waitlist import WaitlistEntry
from app.models.event import Event
from app.models.guest import Guest
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class JoinRequest(BaseModel):
    event_id: int
    name: str
    email: str
    phone: str | None = None
    quantity: int = 1


@router.post("/waitlist/join")
async def join_waitlist(req: JoinRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(WaitlistEntry).where(WaitlistEntry.event_id == req.event_id, WaitlistEntry.email == req.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already on waitlist")
    entry = WaitlistEntry(event_id=req.event_id, name=req.name, email=req.email, phone=req.phone, quantity=req.quantity)
    db.add(entry)
    await db.commit()
    return {"message": "Added to waitlist"}


@router.get("/waitlist/{event_id}")
async def get_waitlist(event_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event or event.organizer_id != user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    result = await db.execute(
        select(WaitlistEntry).where(WaitlistEntry.event_id == event_id).order_by(WaitlistEntry.created_at)
    )
    entries = result.scalars().all()
    return [
        {"id": e.id, "name": e.name, "email": e.email, "phone": e.phone, "quantity": e.quantity, "notified": e.notified, "created_at": str(e.created_at)}
        for e in entries
    ]


@router.post("/waitlist/{entry_id}/notify")
async def mark_notified(entry_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await db.get(WaitlistEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    entry.notified = True
    await db.commit()
    return {"message": "Marked as notified"}


@router.post("/waitlist/{entry_id}/promote")
async def promote_to_guest(entry_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    entry = await db.get(WaitlistEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    event = await db.get(Event, entry.event_id)
    if not event or event.organizer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    existing = await db.execute(
        select(Guest).where(Guest.event_id == entry.event_id, Guest.email == entry.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Guest with this email already exists")
    guest = Guest(
        event_id=entry.event_id,
        name=entry.name,
        email=entry.email,
        phone=entry.phone,
    )
    db.add(guest)
    entry.notified = True
    await db.commit()
    await db.refresh(guest)
    return guest
