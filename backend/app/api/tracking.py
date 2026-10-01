from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
from fastapi.responses import Response

from app.core.database import get_db
from app.models.invite import InviteMessage

router = APIRouter()

TRACKING_PIXEL = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00"
    b"\x80\x00\x00\xff\xff\xff\x00\x00\x00"
    b"\x21\xf9\x04\x00\x00\x00\x00\x00"
    b"\x2c\x00\x00\x00\x00\x01\x00\x01\x00"
    b"\x00\x02\x02\x44\x01\x00\x3b"
)


@router.get("/track/open/{message_id}")
async def track_open(message_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(InviteMessage).where(InviteMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if msg and msg.opened_at is None:
        msg.opened_at = datetime.now(timezone.utc)
        await db.commit()
    return Response(content=TRACKING_PIXEL, media_type="image/gif")
