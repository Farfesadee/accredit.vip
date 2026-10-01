from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, func
from app.core.database import Base

class RSVPQuestion(Base):
    __tablename__ = "rsvp_questions"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    label = Column(String, nullable=False)
    type = Column(String, default="text")
    required = Column(Integer, default=0)
    options = Column(JSON, nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class RSVPAnswer(Base):
    __tablename__ = "rsvp_answers"

    id = Column(Integer, primary_key=True, index=True)
    rsvp_token = Column(String, nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("rsvp_questions.id"), nullable=False)
    value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
