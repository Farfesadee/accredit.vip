"""Platform-wide announcements for dashboard users."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.announcement import Announcement

router = APIRouter()


async def check_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class AnnouncementUpsert(BaseModel):
    title: str | None = None
    body: str | None = None
    active: bool | None = None


@router.get("/announcements/active")
async def list_active_announcements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Latest active announcements for the dashboard banner."""
    result = await db.execute(
        select(Announcement).where(Announcement.active == True).order_by(Announcement.id.desc()).limit(3)
    )
    items = result.scalars().all()
    return {"announcements": [{"id": a.id, "title": a.title, "body": a.body} for a in items]}


@router.get("/admin/announcements")
async def admin_list_announcements(
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Announcement).order_by(Announcement.id.desc()).limit(50))
    items = result.scalars().all()
    return {"announcements": [
        {"id": a.id, "title": a.title, "body": a.body, "active": a.active,
         "created_at": a.created_at.isoformat() if a.created_at else None}
        for a in items
    ]}


@router.post("/admin/announcements")
async def admin_create_announcement(
    req: AnnouncementUpsert,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    if not (req.title or "").strip() or not (req.body or "").strip():
        raise HTTPException(status_code=400, detail="Title and body are required")
    a = Announcement(title=req.title.strip(), body=req.body.strip(),
                     active=req.active if req.active is not None else True,
                     created_by=admin.id)
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"announcement": {"id": a.id, "title": a.title, "body": a.body, "active": a.active}}


@router.patch("/admin/announcements/{announcement_id}")
async def admin_update_announcement(
    announcement_id: int,
    req: AnnouncementUpsert,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    a = (await db.execute(select(Announcement).where(Announcement.id == announcement_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    if req.title is not None:
        a.title = req.title.strip()
    if req.body is not None:
        a.body = req.body.strip()
    if req.active is not None:
        a.active = req.active
    await db.commit()
    await db.refresh(a)
    return {"announcement": {"id": a.id, "title": a.title, "body": a.body, "active": a.active}}


@router.delete("/admin/announcements/{announcement_id}")
async def admin_delete_announcement(
    announcement_id: int,
    admin: User = Depends(check_admin),
    db: AsyncSession = Depends(get_db),
):
    a = (await db.execute(select(Announcement).where(Announcement.id == announcement_id))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Announcement not found")
    await db.delete(a)
    await db.commit()
    return {"message": "Announcement deleted"}
