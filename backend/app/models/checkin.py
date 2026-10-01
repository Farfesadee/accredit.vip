from sqlalchemy import Column, Integer, DateTime, ForeignKey, func
from app.core.database import Base


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), server_default=func.now())
