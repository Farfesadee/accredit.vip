from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.core.database import get_db
from app.models.rsvp_question import RSVPQuestion, RSVPAnswer
from app.models.event import Event
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()


class QuestionCreate(BaseModel):
    label: str
    type: str = "text"
    required: bool = False
    options: list[str] | None = None


class AnswerSubmit(BaseModel):
    token: str
    answers: list[dict]


@router.get("/rsvp-questions/{event_id}")
async def get_questions(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RSVPQuestion).where(RSVPQuestion.event_id == event_id).order_by(RSVPQuestion.sort_order)
    )
    return [{"id": q.id, "label": q.label, "type": q.type, "required": bool(q.required), "options": q.options} for q in result.scalars().all()]


@router.post("/rsvp-questions/{event_id}")
async def save_questions(event_id: int, questions: list[QuestionCreate], user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event or event.organizer_id != user.id:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.execute(delete(RSVPQuestion).where(RSVPQuestion.event_id == event_id))
    for i, q in enumerate(questions):
        db.add(RSVPQuestion(event_id=event_id, label=q.label, type=q.type, required=1 if q.required else 0, options=q.options, sort_order=i))
    await db.commit()
    return {"message": "Questions saved"}


@router.post("/rsvp-answers/submit")
async def submit_answers(req: AnswerSubmit, db: AsyncSession = Depends(get_db)):
    for ans in req.answers:
        db.add(RSVPAnswer(rsvp_token=req.token, question_id=ans["question_id"], value=ans.get("value")))
    await db.commit()
    return {"message": "Answers submitted"}
