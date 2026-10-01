from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.models.subscription import Subscription

router = APIRouter()


class SubscribeRequest(BaseModel):
    email: str | None = None
    phone: str | None = None
    channels: str = "email"


@router.post("/subscribe")
async def subscribe(
    req: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
):
    if not req.email and not req.phone:
        raise HTTPException(status_code=400, detail="Provide email or phone")

    if req.email:
        result = await db.execute(select(Subscription).where(Subscription.email == req.email))
        existing = result.scalar_one_or_none()
        if existing:
            if not existing.is_active:
                existing.is_active = True
                await db.commit()
            return {"message": "Already subscribed", "id": existing.id}

    sub = Subscription(email=req.email, phone=req.phone, channels=req.channels)
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {"message": "Subscribed", "id": sub.id}


@router.post("/unsubscribe")
async def unsubscribe(
    email: str | None = None,
    phone: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if email:
        result = await db.execute(select(Subscription).where(Subscription.email == email))
        sub = result.scalar_one_or_none()
    elif phone:
        result = await db.execute(select(Subscription).where(Subscription.phone == phone))
        sub = result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=400, detail="Provide email or phone")

    if sub:
        sub.is_active = False
        await db.commit()
    return {"message": "Unsubscribed"}
