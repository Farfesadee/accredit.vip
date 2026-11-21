from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, JSON
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
    provider_ref = Column(String, nullable=True)
    # Table / seat selection (event 105 and any future seated event).
    # ``table_numbers`` holds the table codes the buyer picked (["S-01", ...])
    # and ``seat_assignments`` the seat numbers on those tables ([1, 3, 5]).
    # Both stay NULL for plain admission tickets, so every other event is
    # unaffected.
    table_numbers = Column(JSON, nullable=True)
    seat_assignments = Column(JSON, nullable=True)
