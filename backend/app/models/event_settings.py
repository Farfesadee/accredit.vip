from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, func
from app.core.database import Base


class EventSetting(Base):
    __tablename__ = "event_settings"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    qr_mode = Column(String, default="with_qr")
    delivery_channel = Column(String, nullable=False)
    allow_rsvp = Column(Boolean, default=True)
    send_reminders = Column(Boolean, default=False)
    custom_fields = Column(JSON, nullable=True, default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
