"""Comprehensive admin dashboard for monitoring all activities."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.payment import Payment
from app.models.invite import InviteMessage

router = APIRouter()


class ClientSummary(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    total_events: int
    total_guests: int
    total_paid: float
    active_events: int
    created_at: Optional[str] = None


class EventSummary(BaseModel):
    id: int
    title: str
    organizer_email: str
    event_date: str
    guest_count: int
    status: str
    created_at: Optional[str] = None


async def verify_admin(user: User = Depends(get_current_user)):
    """Verify user is admin."""
    if not hasattr(user, 'role') or user.role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/dashboard/overview")
async def get_dashboard_overview(
    admin: User = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get comprehensive dashboard overview."""
    
    total_users = await db.execute(select(func.count(User.id)))
    total_users = total_users.scalar() or 0
    
    total_events = await db.execute(select(func.count(Event.id)))
    total_events = total_events.scalar() or 0
    
    total_guests = await db.execute(select(func.count(Guest.id)))
    total_guests = total_guests.scalar() or 0
    
    active_events = await db.execute(
        select(func.count(Event.id)).where(Event.event_date >= datetime.now(timezone.utc).date())
    )
    active_events = active_events.scalar() or 0
    
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_users = await db.execute(
        select(func.count(User.id)).where(User.created_at >= week_ago)
    )
    new_users = new_users.scalar() or 0
    
    revenue_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "paid")
    )
    total_revenue = float(revenue_result.scalar() or 0)

    return {
        "total_users": total_users,
        "total_events": total_events,
        "total_guests": total_guests,
        "active_events": active_events,
        "total_revenue": total_revenue,
        "new_users_7days": new_users,
    }


@router.get("/dashboard/clients")
async def list_all_clients(
    admin: User = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
):
    """List all clients with summary."""
    
    users_result = await db.execute(
        select(User).order_by(desc(User.created_at)).limit(limit).offset(offset)
    )
    users = users_result.scalars().all()
    
    clients = []
    for user in users:
        events_result = await db.execute(
            select(func.count(Event.id)).where(Event.organizer_id == user.id)
        )
        total_events = events_result.scalar() or 0
        
        active_result = await db.execute(
            select(func.count(Event.id)).where(
                Event.organizer_id == user.id,
                Event.event_date >= datetime.now(timezone.utc).date()
            )
        )
        active_events = active_result.scalar() or 0
        
        guest_result = await db.execute(
            select(func.count(Guest.id)).where(
                Guest.event_id.in_(
                    select(Event.id).where(Event.organizer_id == user.id)
                )
            )
        )
        total_guests = guest_result.scalar() or 0

        paid_result = await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.organizer_id == user.id,
                Payment.status == "paid"
            )
        )
        total_paid = float(paid_result.scalar() or 0)

        clients.append(ClientSummary(
            id=user.id,
            email=user.email,
            name=getattr(user, 'name', None),
            total_events=total_events,
            total_guests=total_guests,
            total_paid=total_paid,
            active_events=active_events,
            created_at=user.created_at.isoformat() if user.created_at else None,
        ))
    
    return clients


@router.get("/dashboard/events")
async def list_all_events(
    admin: User = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
):
    """List all events with summary."""
    
    query = select(Event)
    if status:
        query = query.where(Event.status == status)
    
    query = query.order_by(desc(Event.created_at)).limit(limit).offset(offset)
    
    events_result = await db.execute(query)
    events = events_result.scalars().all()
    
    summaries = []
    for event in events:
        organizer_result = await db.execute(
            select(User).where(User.id == event.organizer_id)
        )
        organizer = organizer_result.scalar_one_or_none()
        
        guest_result = await db.execute(
            select(func.count(Guest.id)).where(Guest.event_id == event.id)
        )
        guest_count = guest_result.scalar() or 0

        summaries.append(EventSummary(
            id=event.id,
            title=event.title,
            organizer_email=organizer.email if organizer else "Unknown",
            event_date=str(event.event_date),
            guest_count=guest_count,
            status=event.status,
            created_at=event.created_at.isoformat() if event.created_at else None,
        ))
    
    return summaries


@router.get("/dashboard/client/{client_id}")
async def get_client_details(
    client_id: int,
    admin: User = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed information about a client."""
    
    user_result = await db.execute(select(User).where(User.id == client_id))
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Client not found")
    
    events_result = await db.execute(
        select(Event).where(Event.organizer_id == user.id)
    )
    events = events_result.scalars().all()
    
    return {
        "client": {
            "id": user.id,
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "events": len(events),
    }


@router.get("/dashboard/event/{event_id}")
async def get_event_details(
    event_id: int,
    admin: User = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed information about an event."""
    
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    organizer_result = await db.execute(select(User).where(User.id == event.organizer_id))
    organizer = organizer_result.scalar_one_or_none()
    
    guests_result = await db.execute(select(func.count(Guest.id)).where(Guest.event_id == event_id))
    guest_count = guests_result.scalar() or 0
    
    rsvp_accepted_result = await db.execute(
        select(func.count(Guest.id)).where(
            Guest.event_id == event_id,
            Guest.rsvp_status == "accepted"
        )
    )
    rsvp_declined_result = await db.execute(
        select(func.count(Guest.id)).where(
            Guest.event_id == event_id,
            Guest.rsvp_status == "declined"
        )
    )

    return {
        "event": {
            "id": event.id,
            "title": event.title,
            "date": str(event.event_date),
            "venue": event.venue,
            "status": event.status,
        },
        "organizer": {
            "email": organizer.email if organizer else "Unknown",
        },
        "statistics": {
            "total_guests": guest_count,
            "rsvp_accepted": rsvp_accepted_result.scalar() or 0,
            "rsvp_declined": rsvp_declined_result.scalar() or 0,
        }
    }
