from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base


class StaffAssignment(Base):
    __tablename__ = "staff_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    role = Column(String, default="accreditation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
