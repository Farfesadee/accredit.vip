from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, func
from app.core.database import Base

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    code = Column(String, nullable=False, index=True)
    discount_percent = Column(Integer, nullable=True)
    discount_fixed = Column(Integer, nullable=True)
    max_uses = Column(Integer, default=0)
    used_count = Column(Integer, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
