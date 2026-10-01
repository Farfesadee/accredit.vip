from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.audience import AudienceProfile, is_hvp_email, company_domain
from app.models.user import User
from app.models.ticket_purchase import TicketPurchase
from app.models.guest import Guest


async def sync_audience_from_users(db: AsyncSession):
    result = await db.execute(select(User))
    users = result.scalars().all()

    for u in users:
        email = u.email
        existing = await db.execute(
            select(AudienceProfile).where(
                AudienceProfile.source == "user",
                AudienceProfile.source_id == u.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        profile = AudienceProfile(
            full_name=u.full_name or "",
            email=email,
            phone=u.phone,
            gender=None,
            age_bracket=None,
            location=None,
            source="user",
            source_id=u.id,
            event_id=None,
            organizer_id=u.id,
            is_hvp=is_hvp_email(email),
            company_domain=company_domain(email),
        )
        db.add(profile)
    await db.commit()


async def sync_audience_from_tickets(db: AsyncSession):
    result = await db.execute(select(TicketPurchase))
    tickets = result.scalars().all()

    for t in tickets:
        existing = await db.execute(
            select(AudienceProfile).where(
                AudienceProfile.source == "ticket",
                AudienceProfile.source_id == t.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        profile = AudienceProfile(
            full_name=t.buyer_name or "",
            email=t.buyer_email,
            phone=t.buyer_phone,
            gender=None,
            age_bracket=None,
            location=None,
            source="ticket",
            source_id=t.id,
            event_id=t.event_id,
            organizer_id=None,
            is_hvp=is_hvp_email(t.buyer_email),
            company_domain=company_domain(t.buyer_email),
        )
        db.add(profile)
    await db.commit()


async def sync_audience_from_guests(db: AsyncSession):
    from app.models.event import Event

    result = await db.execute(
        select(Guest, Event.organizer_id)
        .join(Event, Guest.event_id == Event.id)
    )
    rows = result.all()

    for g, org_id in rows:
        existing = await db.execute(
            select(AudienceProfile).where(
                AudienceProfile.source == "guest",
                AudienceProfile.source_id == g.id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        email = g.email
        profile = AudienceProfile(
            full_name=g.name or "",
            email=email,
            phone=g.phone,
            gender=None,
            age_bracket=None,
            location=None,
            source="guest",
            source_id=g.id,
            event_id=g.event_id,
            organizer_id=org_id,
            is_hvp=is_hvp_email(email),
            company_domain=company_domain(email),
        )
        db.add(profile)
    await db.commit()


async def sync_single_guest(db: AsyncSession, guest: Guest, organizer_id: int | None = None):
    from app.models.event import Event
    if organizer_id is None:
        ev = await db.get(Event, guest.event_id)
        organizer_id = ev.organizer_id if ev else None
    existing = await db.execute(
        select(AudienceProfile).where(
            AudienceProfile.source == "guest",
            AudienceProfile.source_id == guest.id,
        )
    )
    if existing.scalar_one_or_none():
        return
    email = guest.email
    profile = AudienceProfile(
        full_name=guest.name or "",
        email=email,
        phone=guest.phone,
        gender=None,
        age_bracket=None,
        location=None,
        source="guest",
        source_id=guest.id,
        event_id=guest.event_id,
        organizer_id=organizer_id,
        is_hvp=is_hvp_email(email),
        company_domain=company_domain(email),
    )
    db.add(profile)
    await db.commit()


async def sync_all_audience(db: AsyncSession):
    await sync_audience_from_users(db)
    await sync_audience_from_tickets(db)
    await sync_audience_from_guests(db)


async def clear_and_resync(db: AsyncSession):
    await db.execute(delete(AudienceProfile))
    await db.commit()
    await sync_all_audience(db)
