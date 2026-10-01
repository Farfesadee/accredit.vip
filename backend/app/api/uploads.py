import os, uuid, logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.event import Event
from app.models.flier import FlierAsset
from app.services.file_upload_security import FileUploadSecurityService, MAX_UPLOAD_SIZE, resize_and_save

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_MEDIA_TYPES = ALLOWED_TYPES | {"video/mp4", "video/webm", "video/ogg", "video/quicktime"}


@router.post("/{event_id}/upload-cover")
async def upload_cover(
    event_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await FileUploadSecurityService.validate_upload(file)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF allowed")

    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    saved_path = resize_and_save(content, filepath)
    if not saved_path:
        raise HTTPException(status_code=500, detail="Failed to save image")

    url = f"/uploads/{os.path.basename(saved_path)}"
    event.cover_image = url
    await db.commit()

    return {"url": url}


@router.post("/{event_id}/upload-flier")
async def upload_flier(
    event_id: int,
    variant: str = "default",
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await FileUploadSecurityService.validate_upload(file)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, and GIF allowed")

    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    filename = f"flier-{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    saved_path = resize_and_save(content, filepath)
    if not saved_path:
        raise HTTPException(status_code=500, detail="Failed to save image")

    url = f"/uploads/{os.path.basename(saved_path)}"
    asset = FlierAsset(event_id=event.id, variant=variant, url=url)
    db.add(asset)
    await db.commit()

    return {"url": url, "variant": variant}


@router.delete("/{event_id}/cover")
async def delete_cover(
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

    if event.cover_image:
        path = os.path.join(UPLOAD_DIR, os.path.basename(event.cover_image))
        try:
            os.remove(path)
        except OSError:
            pass
        event.cover_image = None
        await db.commit()

    return {"status": "deleted"}


@router.delete("/{event_id}/fliers/{flier_id}")
async def delete_flier(
    event_id: int,
    flier_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")

    f_result = await db.execute(
        select(FlierAsset).where(FlierAsset.id == flier_id, FlierAsset.event_id == event_id)
    )
    flier = f_result.scalar_one_or_none()
    if not flier:
        raise HTTPException(status_code=404, detail="Flier not found")

    try:
        os.remove(os.path.join(UPLOAD_DIR, os.path.basename(flier.url)))
    except OSError:
        pass

    await db.delete(flier)
    await db.commit()
    return {"status": "deleted"}


@router.get("/{event_id}/fliers")
async def list_fliers(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FlierAsset).where(FlierAsset.event_id == event_id)
    )
    return result.scalars().all()


@router.post("/upload-community")
async def upload_community_media(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")

    if file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=400, detail="Only images (JPEG, PNG, WebP, GIF) and videos (MP4, WebM, OGG, MOV) allowed")

    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    filename = f"community-{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    url = f"/uploads/{filename}"
    return {"url": url}
