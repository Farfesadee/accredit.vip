from sqlalchemy import Column, DateTime, Integer, String, Text, UniqueConstraint, func
from app.core.database import Base


class TrialUsage(Base):
    __tablename__ = "trial_usages"
    __table_args__ = (
        UniqueConstraint("fingerprint_hash", "trial_type", name="uq_trial_fingerprint_type"),
        UniqueConstraint("client_hash", "trial_type", name="uq_trial_client_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    trial_type = Column(String, nullable=False)
    fingerprint_hash = Column(String, nullable=False, index=True)
    client_hash = Column(String, nullable=False, index=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
