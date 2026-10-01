import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator

from app.core.database import get_db
from app.models.coupon import Coupon
from app.models.event import Event
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class CreateCouponRequest(BaseModel):
    event_id: int
    code: str = ""
    discount_percent: int | None = None
    discount_fixed: int | None = None
    max_uses: int = 0
    expires_at: str | None = None

    @field_validator("discount_percent")
    @classmethod
    def cap_discount(cls, v):
        if v is not None and v > 100:
            raise ValueError("discount_percent cannot exceed 100")
        return v


class ApplyCouponRequest(BaseModel):
    event_id: int
    code: str


@router.post("/coupons")
async def create_coupon(req: CreateCouponRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, req.event_id)
    if not event or event.organizer_id != user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    code = req.code.upper() if req.code else secrets.token_hex(4).upper()
    existing = await db.execute(select(Coupon).where(Coupon.event_id == req.event_id, Coupon.code == code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    coupon = Coupon(event_id=req.event_id, code=code, discount_percent=req.discount_percent, discount_fixed=req.discount_fixed, max_uses=req.max_uses)
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return {"id": coupon.id, "code": coupon.code, "discount_percent": coupon.discount_percent, "discount_fixed": coupon.discount_fixed, "max_uses": coupon.max_uses}


@router.post("/coupons/validate")
async def validate_coupon(req: ApplyCouponRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Coupon).where(Coupon.event_id == req.event_id, Coupon.code == req.code.upper(), Coupon.is_active == True)
    )
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if coupon.expires_at and coupon.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Coupon has expired")
    if coupon.max_uses > 0 and coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    return {"valid": True, "discount_percent": coupon.discount_percent, "discount_fixed": coupon.discount_fixed, "code": coupon.code}


@router.get("/coupons/{event_id}")
async def list_coupons(event_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event or event.organizer_id != user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    result = await db.execute(select(Coupon).where(Coupon.event_id == event_id).order_by(Coupon.created_at.desc()))
    return [{"id": c.id, "code": c.code, "discount_percent": c.discount_percent, "discount_fixed": c.discount_fixed, "max_uses": c.max_uses, "used_count": c.used_count, "is_active": c.is_active, "expires_at": str(c.expires_at) if c.expires_at else None} for c in result.scalars().all()]
