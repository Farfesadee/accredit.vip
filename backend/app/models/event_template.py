from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON, func
from app.core.database import Base

class EventTemplate(Base):
    __tablename__ = "event_templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    mode = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
