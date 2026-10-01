from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func

from app.core.database import Base


class STDMessageBatch(Base):
    __tablename__ = "std_message_batches"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    channel = Column(String, nullable=False)
    total_sent = Column(Integer, default=0)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class STDMessage(Base):
    __tablename__ = "std_messages"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("std_message_batches.id"), nullable=False)
    guest_id = Column(Integer, ForeignKey("guests.id"), nullable=False)
    channel = Column(String, nullable=False)
    status = Column(String, default="queued")
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(String, nullable=True)
    provider_message_id = Column(String, nullable=True)
    webhook_payload = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
