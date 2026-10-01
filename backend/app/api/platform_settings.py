"""Platform-wide settings (pricing, etc.): public read, admin write."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.platform_setting import PlatformSetting

router = APIRouter()


async def check_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class SettingUpsert(BaseModel):
    value: dict


@router.get("/settings/public")
async def public_settings(db: AsyncSession = Depends(get_db)):
    """Public platform settings (pricing channels). Missing keys fall back
    to the frontend's built-in defaults."""
    result = await db.execute(select(PlatformSetting))
    out = {}
    for row in result.scalars().all():
        try:
            out[row.key] = json.loads(row.value)
        except Exception:
            out[row.key] = None
    return {"settings": out}


@router.get("/admin/settings/platform")
async def admin_get_settings(
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PlatformSetting))
    out = {}
    for row in result.scalars().all():
        try:
            out[row.key] = json.loads(row.value)
        except Exception:
            out[row.key] = None
    return {"settings": out}


@router.put("/admin/settings/platform/{key}")
async def admin_set_setting(
    key: str,
    req: SettingUpsert,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    if key not in ("pricing_channels",):
        raise HTTPException(status_code=400, detail="Unknown setting key")
    row = (await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))).scalar_one_or_none()
    if not row:
        row = PlatformSetting(key=key, value="{}")
        db.add(row)
    row.value = json.dumps(req.value)
    await db.commit()
    return {"key": key, "value": req.value}
