from sqlalchemy import Column, Integer, String, DateTime, Boolean, func
from app.core.database import Base


class Pickup(Base):
    __tablename__ = "pickups"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    code = Column(String(10), nullable=False, unique=True, index=True)
    qr_token = Column(String(36), nullable=False, unique=True, index=True)
    status = Column(String, default="pending")
    valid_from = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    picked_up_at = Column(DateTime(timezone=True), nullable=True)
    location = Column(String, default="Parkview Estate, Ikoyi")
    venue_phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    email_sent = Column(Boolean, default=False)
    whatsapp_sent = Column(Boolean, default=False)
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    whatsapp_sent_at = Column(DateTime(timezone=True), nullable=True)


class PickupUser(Base):
    __tablename__ = "pickup_users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, default="staff")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
