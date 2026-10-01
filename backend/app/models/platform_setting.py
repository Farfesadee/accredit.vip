from sqlalchemy import Column, String, Text, DateTime, func
from app.core.database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False, default="{}")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
