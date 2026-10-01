from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from app.core.database import Base


class FlierAsset(Base):
    __tablename__ = "flier_assets"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    variant = Column(String, nullable=False)
    url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
