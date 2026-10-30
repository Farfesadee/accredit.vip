from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from app.core.database import Base


class EventDay(Base):
    """One dated day of a multi-day event.

    An event with no rows here is a single-day event and behaves exactly as it
    always has: the gate and the reports use `events.event_date`. Rows exist only
    once somebody schedules more than one day, and from then on they are what the
    gate, the check-in records and the reports scope to.

    Everything an operator needs at the door lives here, so a day can be opened or
    closed from the admin page without a deploy:
      - accreditation_open  : is the gate accepting scans on this day
      - is_active           : does the day still form part of the schedule
    """

    __tablename__ = "event_days"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    day_number = Column(Integer, nullable=False, default=1)
    date = Column(Date, nullable=False)
    label = Column(String, nullable=True)
    start_time = Column(String, nullable=True)
    end_time = Column(String, nullable=True)
    accreditation_open = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    note = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("event_id", "date", name="uq_event_days_event_date"),
    )
