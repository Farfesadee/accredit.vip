from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base


class CheckIn(Base):
    __tablename__ = "checkins"

    id = Column(Integer, primary_key=True, index=True)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Which day of a multi-day event this check-in belongs to. NULL on every
    # single-day event, which is why duplicate detection still falls back to
    # "one check-in per guest per event" when no day is set.
    event_day_id = Column(
        Integer, ForeignKey("event_days.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Gate the guest came through. Exists in the table already; declaring it
    # here lets the scanner report where a previous check-in happened instead of
    # silently losing it.
    location = Column(String, nullable=True)
    checked_in_at = Column(DateTime(timezone=True), server_default=func.now())
