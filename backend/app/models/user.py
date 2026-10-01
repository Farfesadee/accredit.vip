from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from app.core.database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, unique=True, nullable=True)
    full_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="organizer")
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    verification_channel = Column(String, default="email")
    oauth_provider = Column(String, nullable=True)
    oauth_id = Column(String, nullable=True)

    # SECURITY: Account lockout protection
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String, nullable=True)

    # SECURITY: Trial enforcement (one-time per account)
    trial_invite_used = Column(Boolean, default=False)
    trial_event_used = Column(Boolean, default=False)
    trial_fingerprint_hash = Column(String, nullable=True, index=True)
    trial_used_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
