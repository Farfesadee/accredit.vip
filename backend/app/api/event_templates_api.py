from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.models.event_template import EventTemplate
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class SaveTemplateRequest(BaseModel):
    name: str
    mode: str
    config: dict


@router.post("/event-templates")
async def save_template(req: SaveTemplateRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template = EventTemplate(user_id=user.id, name=req.name, mode=req.mode, config=req.config)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return {"id": template.id, "name": template.name}


@router.get("/event-templates")
async def list_templates(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EventTemplate).where(EventTemplate.user_id == user.id).order_by(EventTemplate.created_at.desc())
    )
    return [{"id": t.id, "name": t.name, "mode": t.mode, "created_at": str(t.created_at)} for t in result.scalars().all()]


@router.get("/event-templates/{template_id}")
async def get_template(template_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    template = await db.get(EventTemplate, template_id)
    if not template or template.user_id != user.id:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"id": template.id, "name": template.name, "mode": template.mode, "config": template.config}
