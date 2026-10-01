"""Guest management API endpoints for invite delivery."""

import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.guest import Guest
from app.models.event import Event
from app.models.event_settings import EventSetting
from app.services.phone_validator import PhoneValidator, validate_email

router = APIRouter()


class GuestCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    custom_data: Optional[dict] = None


class GuestUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    custom_data: Optional[dict] = None


class GuestResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_normalized: Optional[str] = None
    phone_country_code: Optional[str] = None
    phone_country_flag: str = "🌍"
    phone_valid: bool = False
    email_valid: bool = False
    rsvp_status: Optional[str] = None
    rsvp_token: str
    invite_sent: bool
    invite_attempts: int
    invite_viewed_at: Optional[str] = None
    custom_data: Optional[dict] = None

    class Config:
        from_attributes = True


@router.post("/guests/{event_id}/add")
async def add_guest(
    event_id: int,
    guest: GuestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a single guest to an event."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check guest quota
    guests_count = await db.execute(
        select(Guest).where(Guest.event_id == event_id)
    )
    import re
    range_numbers = [int(x) for x in re.findall(r"\d+", event.guest_count_range or "0")]
    max_guests = max(range_numbers) if range_numbers else 0
    if len(guests_count.scalars().all()) >= max_guests:
        raise HTTPException(status_code=400, detail="Guest quota exceeded")

    # Validate and normalize phone
    phone_normalized = None
    phone_country_code = None
    phone_valid = False

    if guest.phone:
        phone_info = PhoneValidator.validate_and_format(guest.phone)
        phone_normalized = phone_info["normalized"]
        phone_country_code = phone_info["country_code"]
        phone_valid = phone_info["is_valid"]

    # Validate email
    email_valid = validate_email(guest.email) if guest.email else False

    new_guest = Guest(
        event_id=event_id,
        name=guest.name,
        email=guest.email,
        email_valid=email_valid,
        phone=guest.phone,
        phone_normalized=phone_normalized,
        phone_country_code=phone_country_code,
        phone_valid=phone_valid,
        custom_data=guest.custom_data or {},
    )
    db.add(new_guest)
    await db.commit()
    await db.refresh(new_guest)

    # Build response with computed flag
    response = GuestResponse.from_orm(new_guest)
    response.phone_country_flag = PhoneValidator.get_country_flag(phone_country_code)
    return response


@router.post("/guests/{event_id}/upload")
async def upload_guests(
    event_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload guests via CSV file."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Parse CSV
    contents = await file.read()
    csv_reader = csv.DictReader(io.StringIO(contents.decode()))

    guests_to_add = []
    errors = []

    for idx, row in enumerate(csv_reader, start=2):
        try:
            name = row.get("name", "").strip()
            email = row.get("email", "").strip() or None
            phone = row.get("phone", "").strip() or None

            if not name:
                errors.append(f"Row {idx}: Name is required")
                continue

            if not email and not phone:
                errors.append(f"Row {idx}: Email or phone is required")
                continue

            # Validate and normalize phone
            phone_normalized = None
            phone_country_code = None
            phone_valid = False

            if phone:
                phone_info = PhoneValidator.validate_and_format(phone)
                phone_normalized = phone_info["normalized"]
                phone_country_code = phone_info["country_code"]
                phone_valid = phone_info["is_valid"]

            # Validate email
            email_valid = validate_email(email) if email else False

            guest = Guest(
                event_id=event_id,
                name=name,
                email=email,
                email_valid=email_valid,
                phone=phone,
                phone_normalized=phone_normalized,
                phone_country_code=phone_country_code,
                phone_valid=phone_valid,
            )
            guests_to_add.append(guest)
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")

    # Check quota
    existing = await db.execute(
        select(Guest).where(Guest.event_id == event_id)
    )
    total = len(existing.scalars().all()) + len(guests_to_add)
    import re
    max_guests = max([int(x) for x in re.findall(r"\d+", event.guest_count_range or "0")] or [0])

    if total > max_guests:
        raise HTTPException(
            status_code=400,
            detail=f"Total guests ({total}) exceeds quota ({max_guests}). {len(errors)} rows had errors."
        )

    # Add all guests
    db.add_all(guests_to_add)
    await db.commit()

    return {
        "added": len(guests_to_add),
        "errors": errors,
        "total_guests": total,
        "validation_warnings": [
            f"Row {idx}: Phone number is invalid or incomplete"
            for idx, g in enumerate(guests_to_add, start=2)
            if not g.phone_valid
        ] if any(not g.phone_valid for g in guests_to_add) else []
    }


@router.get("/guests/{event_id}")
async def list_guests(
    event_id: int,
    rsvp_status: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all guests for an event with optional filtering, sorted alphabetically."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Trial events have a placeholder guest, don't show in dashboard list
    if event.status == "trial":
        return []

    query = select(Guest).where(Guest.event_id == event_id, Guest.deleted_at == None)
    if rsvp_status:
        query = query.where(Guest.rsvp_status == rsvp_status)

    # Order alphabetically by name
    query = query.order_by(Guest.name)

    result = await db.execute(query)
    guests = result.scalars().all()

    # Build responses with flags
    responses = []
    for g in guests:
        response = GuestResponse.from_orm(g)
        response.phone_country_flag = PhoneValidator.get_country_flag(g.phone_country_code)
        responses.append(response)

    return responses


@router.put("/guests/{guest_id}")
async def update_guest(
    guest_id: int,
    guest: GuestUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update guest information."""
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id)
    )
    db_guest = result.scalar_one_or_none()
    if not db_guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Verify ownership
    event_result = await db.execute(
        select(Event).where(Event.id == db_guest.event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = guest.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_guest, key, value)

    await db.commit()
    await db.refresh(db_guest)
    return GuestResponse.from_orm(db_guest)


@router.delete("/guests/{guest_id}")
async def delete_guest(
    guest_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    permanent: bool = Query(False, description="Hard-delete instead of soft-delete"),
):
    """Delete a guest."""
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id)
    )
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Verify ownership
    event_result = await db.execute(
        select(Event).where(Event.id == guest.event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    if permanent:
        await db.delete(guest)
    else:
        guest.deleted_at = func.now()

    await db.commit()
    return {"status": "deleted"}


@router.post("/guests/{guest_id}/restore")
async def restore_guest(
    guest_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore a soft-deleted guest."""
    result = await db.execute(
        select(Guest).where(Guest.id == guest_id)
    )
    guest = result.scalar_one_or_none()
    if not guest or not guest.deleted_at:
        raise HTTPException(status_code=404, detail="Guest not found or not deleted")

    # Verify ownership
    event_result = await db.execute(
        select(Event).where(Event.id == guest.event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    guest.deleted_at = None
    await db.commit()
    return {"status": "restored"}


@router.get("/guests/{event_id}/stats")
async def get_guest_stats(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get guest statistics for an event."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Trial events don't count toward dashboard RSVP stats
    if event.status == "trial":
        return {"total": 1, "invited": 1, "not_responded": 1, "accepted": 0, "declined": 0, "pending": 0}

    guests = await db.execute(select(Guest).where(Guest.event_id == event_id))
    all_guests = guests.scalars().all()

    return {
        "total": len(all_guests),
        "invited": len([g for g in all_guests if g.invite_sent]),
        "not_responded": len([g for g in all_guests if not g.invite_sent]),
        "accepted": len([g for g in all_guests if g.rsvp_status == "accepted"]),
        "declined": len([g for g in all_guests if g.rsvp_status == "declined"]),
        "pending": len([g for g in all_guests if g.rsvp_status == "pending"]),
    }


@router.get("/events/{event_id}/custom-fields")
async def get_custom_fields(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get custom fields configuration for an event."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    settings_result = await db.execute(
        select(EventSetting).where(EventSetting.event_id == event_id)
    )
    settings = settings_result.scalar_one_or_none()

    if not settings:
        return {"custom_fields": []}

    return {"custom_fields": settings.custom_fields or []}


class CustomField(BaseModel):
    name: str
    label: str
    type: str  # text, select, checkbox, textarea, email, number, etc.
    required: bool = False
    options: Optional[List[str]] = None
    placeholder: Optional[str] = None


class CustomFieldsUpdate(BaseModel):
    custom_fields: List[CustomField]


@router.put("/events/{event_id}/custom-fields")
async def update_custom_fields(
    event_id: int,
    data: CustomFieldsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update custom fields configuration for an event."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    settings_result = await db.execute(
        select(EventSetting).where(EventSetting.event_id == event_id)
    )
    settings = settings_result.scalar_one_or_none()

    if not settings:
        settings = EventSetting(event_id=event_id, delivery_channel="email")
        db.add(settings)

    settings.custom_fields = [field.dict() for field in data.custom_fields]
    await db.commit()
    await db.refresh(settings)

    return {"custom_fields": settings.custom_fields}
