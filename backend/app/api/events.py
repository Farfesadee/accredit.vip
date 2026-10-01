import re, math, unicodedata
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from pydantic import BaseModel
from datetime import date, time, datetime, timezone
from typing import Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.services.event_review import scan_for_keywords, compute_review_status
from app.services.trial_enforcement import TrialEnforcementService

router = APIRouter()


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    text = re.sub(r"[-\s]+", "-", text)
    return text[:80]


async def generate_unique_slug(title: str, db: AsyncSession) -> str:
    base = slugify(title) or "event"
    slug = base
    counter = 1
    while True:
        result = await db.execute(select(Event).where(Event.slug == slug))
        if not result.scalar_one_or_none():
            return slug
        slug = f"{base}-{counter}"
        counter += 1


class EventCreateRequest(BaseModel):
    title: str
    event_type: str
    host_name: str
    event_date: date
    event_time: time
    venue: str
    city: str | None = None
    state: str | None = None
    country: str = "Nigeria"
    latitude: float | None = None
    longitude: float | None = None
    map_link: str | None = None
    dress_code: str | None = None
    male_dress_code: str | None = None
    female_dress_code: str | None = None
    description: str | None = None
    cover_image: str | None = None
    timezone: str = "WAT"
    guest_count_range: str
    is_public: bool = False
    category: str | None = None
    ticket_price: int | None = None
    currency: str = "NGN"
    tickets_available: int | None = None
    pass_packages: list[dict[str, Any]] | None = None
    lineup: list[dict[str, Any]] | None = None
    after_party_enabled: bool = False
    after_party_location: str | None = None
    after_party_time: str | None = None
    qr_delivery: str | None = None
    qr_style: str | None = None
    qr_message: str | None = None
    invite_subject: str | None = None
    invite_body: str | None = None


class InviteMessageRequest(BaseModel):
    invite_subject: str | None = None
    invite_body: str | None = None


class EventPublicResponse(BaseModel):
    id: int
    organizer_id: int
    title: str
    slug: str | None
    event_type: str
    host_name: str
    event_date: date
    event_time: time
    timezone: str
    venue: str
    city: str | None
    state: str | None
    country: str
    latitude: float | None
    longitude: float | None
    map_link: str | None
    dress_code: str | None
    male_dress_code: str | None
    female_dress_code: str | None
    description: str | None
    cover_image: str | None
    guest_count_range: str
    status: str
    is_public: bool
    category: str | None
    ticket_price: int | None
    currency: str
    tickets_available: int | None
    pass_packages: list[dict[str, Any]] | None
    lineup: list[dict[str, Any]] | None
    after_party_enabled: bool
    after_party_location: str | None
    after_party_time: str | None
    review_status: str
    review_note: str | None
    flagged_keywords: list[str] | None
    spotlight: bool = False
    created_at: datetime | None
    updated_at: datetime | None
    distance_km: float | None = None

    model_config = {"from_attributes": True}


@router.post("")
async def create_event(
    req: EventCreateRequest,
    user: User = Depends(get_current_user),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    SECURITY: Create event with trial enforcement
    Users get ONE free POST EVENT trial after signup
    After trial used, they must upgrade subscription
    """
    # Admins bypass trial enforcement
    if user.role != "admin":
        trial_check = await TrialEnforcementService.check_trial_available(
            user=user,
            trial_type="event",
            db=db,
        )

        if not trial_check["allowed"]:
            raise HTTPException(
                status_code=402,  # 402 Payment Required
                detail=trial_check["reason"],
            )

    # Create event
    event = Event(
        organizer_id=user.id,
        slug=await generate_unique_slug(req.title, db),
        **req.model_dump(),
    )

    # Scan for suspicious keywords
    scan_text = f"{req.title} {req.description or ''}"
    flagged_keywords = scan_for_keywords(scan_text)
    event.review_status = compute_review_status(req.is_public or False, flagged_keywords)
    if flagged_keywords:
        event.flagged_keywords = flagged_keywords

    # Mark trial as used (admins bypass this)
    if user.role != "admin":
        user.trial_event_used = True
        user.trial_used_at = datetime.now(timezone.utc)

    db.add(event)
    db.add(user)
    await db.commit()
    await db.refresh(event)
    return event


@router.post("/claim-trial")
async def claim_trial_events(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim trial events that have a guest with the user's email."""
    claimed = 0
    result = await db.execute(select(Event).where(Event.status == "trial"))
    trial_events = result.scalars().all()
    for event in trial_events:
        gref = await db.execute(select(Guest).where(Guest.event_id == event.id, Guest.email.ilike(user.email)))
        if gref.scalar_one_or_none():
            event.organizer_id = user.id
            claimed += 1
    if claimed:
        await db.commit()
    return {"claimed": claimed, "message": f"Claimed {claimed} trial event(s)"}


@router.get("")
async def list_events(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    search: str = Query(None, description="Search by title or venue"),
    category: str = Query(None, description="Filter by category"),
    date_from: str = Query(None, description="Filter events on or after this date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter events on or before this date (YYYY-MM-DD)"),
):
    query = select(Event).where(Event.organizer_id == user.id)
    if search:
        query = query.where(
            or_(Event.title.ilike(f"%{search}%"), Event.venue.ilike(f"%{search}%"))
        )
    if category:
        query = query.where(Event.category == category)
    if date_from:
        query = query.where(Event.event_date >= date.fromisoformat(date_from))
    if date_to:
        query = query.where(Event.event_date <= date.fromisoformat(date_to))
    query = query.order_by(Event.event_date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/public", response_model=list[EventPublicResponse])
async def list_public_events(
    db: AsyncSession = Depends(get_db),
    search: str = Query(None, description="Search by title or venue"),
    category: str = Query(None, description="Filter by category"),
    location: str = Query(None, description="Filter by city or state name"),
    month: int = Query(None, description="Filter by month (1-12)"),
    price_type: str = Query(None, description="Filter by price: free, paid, or all"),
    date_from: str = Query(None, description="Filter events on or after this date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter events on or before this date (YYYY-MM-DD)"),
    near_lat: float = Query(None, description="User's latitude for proximity search"),
    near_lng: float = Query(None, description="User's longitude for proximity search"),
    radius_km: float = Query(50, description="Search radius in km (default 50)"),
    sort: str = Query("latest", description="Sort order: latest, soonest, name"),
    past_only: bool = Query(False, description="Only events whose date has passed (for Previous events)"),
):
    query = select(Event).where(Event.is_public == True, Event.status == "published", Event.review_status != "flagged")
    if search:
        query = query.where(
            or_(Event.title.ilike(f"%{search}%"), Event.venue.ilike(f"%{search}%"))
        )
    if category:
        query = query.where(Event.category == category)
    if location:
        query = query.where(
            or_(Event.city.ilike(f"%{location}%"), Event.state.ilike(f"%{location}%"))
        )
    if month:
        query = query.where(func.extract("month", Event.event_date) == month)
    if price_type == "free":
        query = query.where(
            or_(Event.ticket_price == None, Event.ticket_price == 0)
        )
    elif price_type == "paid":
        query = query.where(Event.ticket_price > 0)
    if date_from:
        query = query.where(Event.event_date >= date.fromisoformat(date_from))
    elif past_only:
        query = query.where(Event.event_date < date.today())
    else:
        query = query.where(Event.event_date >= date.today())
    if date_to:
        query = query.where(Event.event_date <= date.fromisoformat(date_to))
    if sort == "soonest":
        query = query.order_by(Event.event_date.asc())
    elif sort == "name":
        query = query.order_by(Event.title.asc())
    elif past_only:
        query = query.order_by(Event.event_date.desc())
    else:
        query = query.order_by(Event.created_at.desc())
    result = await db.execute(query)
    events = result.scalars().all()

    # Proximity filtering via bounding box + exact distance
    if near_lat is not None and near_lng is not None:
        lat_deg = radius_km / 111.0
        lng_deg = radius_km / (111.0 * math.cos(math.radians(near_lat)))
        filtered = []
        for ev in events:
            if ev.latitude is None or ev.longitude is None:
                continue
            if not (near_lat - lat_deg <= ev.latitude <= near_lat + lat_deg):
                continue
            if not (near_lng - lng_deg <= ev.longitude <= near_lng + lng_deg):
                continue
            d = math.acos(
                math.sin(math.radians(near_lat)) * math.sin(math.radians(ev.latitude)) +
                math.cos(math.radians(near_lat)) * math.cos(math.radians(ev.latitude)) *
                math.cos(math.radians(ev.longitude) - math.radians(near_lng))
            ) * 6371
            if d <= radius_km:
                ev.distance_km = round(d, 1)
                filtered.append(ev)
        filtered.sort(key=lambda e: e.distance_km)
        events = filtered
        if not events:
            return []

    return [EventPublicResponse.model_validate(e) for e in events]


@router.get("/by-slug/{slug}")
async def get_event_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.slug == slug))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("/{event_id}")
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.put("/{event_id}")
async def update_event(
    event_id: int,
    req: EventCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    for key, value in req.model_dump().items():
        setattr(event, key, value)
    if req.title:
        event.slug = await generate_unique_slug(req.title, db)

    # Scan for suspicious keywords
    scan_text = f"{req.title} {req.description or ''}"
    flagged_keywords = scan_for_keywords(scan_text)
    event.review_status = compute_review_status(req.is_public or False, flagged_keywords)
    if flagged_keywords:
        event.flagged_keywords = flagged_keywords
    else:
        event.flagged_keywords = None

    await db.commit()
    await db.refresh(event)
    return event


@router.put("/{event_id}/invite-message")
async def update_invite_message(
    event_id: int,
    req: InviteMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    event.invite_subject = req.invite_subject
    event.invite_body = req.invite_body

    await db.commit()
    await db.refresh(event)
    return {"invite_subject": event.invite_subject, "invite_body": event.invite_body}


@router.post("/{event_id}/submit-approval")
async def submit_event_for_approval(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an event for admin approval"""
    from app.services.notify import send_notification

    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.review_status in ["pending_review", "approved"]:
        raise HTTPException(status_code=400, detail="Event is already submitted or approved")

    # Update event status
    event.review_status = "pending_review"
    event.updated_at = datetime.now()

    db.add(event)
    await db.commit()
    await db.refresh(event)

    # Notify admins about the new submission
    admin_result = await db.execute(
        select(User).where(User.role.in_(["admin", "super_admin"]))
    )
    admins = admin_result.scalars().all()

    import asyncio
    from app.services.email_service import send_email
    from app.core.config import settings

    for admin in admins:
        await send_notification(
            db=db,
            user_id=admin.id,
            type="event_submitted",
            title="New Event Submission",
            message=f"New event '{event.title}' submitted for review by {user.full_name}",
            data={"event_id": event.id},
        )
        if admin.email:
            asyncio.create_task(
                send_email(
                    to=admin.email,
                    subject=f"New Event Submission: {event.title}",
                    html=f"""
                    <h2>New Event Submitted for Review</h2>
                    <p><strong>Event:</strong> {event.title}</p>
                    <p><strong>Organizer:</strong> {user.full_name} ({user.email})</p>
                    <p><strong>Type:</strong> {event.event_type or 'N/A'}</p>
                    <p><strong>Date:</strong> {event.event_date}</p>
                    <p><a href="{settings.FRONTEND_URL}/admin/events" style="display:inline-block;padding:12px 24px;background:#E91E8C;color:white;text-decoration:none;border-radius:8px">Review in Dashboard</a></p>
                    """,
                )
            )

    return {
        "status": "submitted",
        "event_id": event.id,
        "message": "Event submitted for admin approval",
    }


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.delete(event)
    await db.commit()
    return {"message": "Event deleted"}
