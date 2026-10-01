import uuid
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Guest(Base):
    __tablename__ = "guests"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    rsvp_status = Column(String, default="pending")
    rsvp_token = Column(String, unique=True, index=True, default=lambda: str(uuid.uuid4()))
    rsvped_at = Column(DateTime(timezone=True), nullable=True)
    rsvp_note = Column(String, nullable=True)
    invite_sent = Column(Boolean, default=False)
    invite_attempts = Column(Integer, default=0)
    invite_viewed_at = Column(DateTime(timezone=True), nullable=True)
    custom_data = Column(JSON, nullable=True, default={})
    notes = Column(String, nullable=True)
    tags = Column(JSON, nullable=True, default=[])
    invited_by = Column(String, nullable=True)
    zone = Column(String, nullable=True)
    table_number = Column(String, nullable=True)
    category = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    qr_codes = relationship("QRCode", backref="guest", lazy="selectin")

    def to_dict(self):
        qr = self.qr_codes[0] if self.qr_codes else None
        return {
            "id": self.id,
            "event_id": self.event_id,
            "name": self.name,
            "phone": self.phone,
            "email": self.email,
            "rsvp_status": self.rsvp_status,
            "rsvp_token": self.rsvp_token,
            "rsvp_note": self.rsvp_note,
            "invite_sent": self.invite_sent,
            "invite_attempts": self.invite_attempts,
            "invite_viewed_at": self.invite_viewed_at.isoformat() if self.invite_viewed_at else None,
            "custom_data": self.custom_data,
            "notes": self.notes,
            "tags": self.tags or [],
            "zone": self.zone,
            "table_number": self.table_number,
            "category": self.category,
            "qr_token": qr.token if qr else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
