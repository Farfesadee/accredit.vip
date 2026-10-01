from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base


class TicketPurchase(Base):
    __tablename__ = "ticket_purchases"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    buyer_name = Column(String, nullable=False)
    buyer_email = Column(String, nullable=False)
    buyer_phone = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    amount = Column(Integer, nullable=False)
    reference = Column(String, unique=True, nullable=False)
    status = Column(String, default="pending")
    platform_fee = Column(Integer, nullable=True)
    vat = Column(Integer, nullable=True)
    package_name = Column(String, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    utm_source = Column(String, nullable=True)
    utm_medium = Column(String, nullable=True)
    utm_campaign = Column(String, nullable=True)
