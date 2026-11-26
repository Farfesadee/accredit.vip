from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func

from app.core.database import Base


class HeadcountCode(Base):
    """One unique wristband code for a headcount event.

    Unlike the old shared wristband, each printed QR carries a unique code and
    can contribute one entry. The code is stored so a second presentation is
    refused and the gate can undo a mistaken scan by freeing it again.
    """

    __tablename__ = "headcount_codes"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code = Column(String(16), nullable=False, unique=True, index=True)
    is_used = Column(Boolean, nullable=False, default=False, server_default="false")
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
