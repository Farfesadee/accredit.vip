from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.community_post import CommunityPost

router = APIRouter()


class PostCreate(BaseModel):
    title: str
    excerpt: str | None = None
    content: str | None = None
    tag: str | None = None
    image: str | None = None
    author: str | None = None
    is_published: bool = True


class PostUpdate(BaseModel):
    title: str | None = None
    excerpt: str | None = None
    content: str | None = None
    tag: str | None = None
    image: str | None = None
    author: str | None = None
    is_published: bool | None = None


@router.get("/posts")
async def list_posts(
    published: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    query = select(CommunityPost)
    if published:
        query = query.where(CommunityPost.is_published == True)
    query = query.order_by(CommunityPost.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/posts/{post_id}")
async def get_post(post_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CommunityPost).where(CommunityPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.post("/posts")
async def create_post(
    req: PostCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    post = CommunityPost(**req.model_dump())
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.put("/posts/{post_id}")
async def update_post(
    post_id: int,
    req: PostUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    result = await db.execute(select(CommunityPost).where(CommunityPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(post, k, v)
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    await db.execute(delete(CommunityPost).where(CommunityPost.id == post_id))
    await db.commit()
    return {"message": "Deleted"}
