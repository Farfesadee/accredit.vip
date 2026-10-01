from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr

from app.core.database import get_db

router = APIRouter()


class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    message: str


@router.post("/contact")
async def contact_form(req: ContactRequest, db: AsyncSession = Depends(get_db)):
    # In production, send email to admin / save to support_tickets table
    # For now, just acknowledge receipt
    return {
        "message": "Thank you for reaching out. We'll get back to you within 24 hours.",
        "sent": True,
    }
