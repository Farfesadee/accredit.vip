from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class HeadcountScan(Base):
    """One recorded entry at a headcount event.

    Headcount events have no guest list. One shared QR is printed on every
    wristband, and every time the accreditation team scans it, one person is
    assumed to have walked in. A row here is therefore a person, not a guest
    match: repeat scans of the same code are allowed on purpose, because two
    guests can present two wristbands carrying the same printed code within a
    second of each other.
    """

    __tablename__ = "headcount_scans"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    event_day_id = Column(
        Integer, ForeignKey("event_days.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Who held the scanner. Kept loose so a deactivated staff account does not
    # erase the history of what they counted.
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    location = Column(String, nullable=True)
    device_info = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
