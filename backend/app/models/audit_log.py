"""Audit logging for security events"""

from sqlalchemy import Column, Integer, String, DateTime, Text, func, ForeignKey
from sqlalchemy.dialects.postgresql import JSON
from app.core.database import Base
from datetime import datetime


class AuditLog(Base):
    """Track all security-relevant events"""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # User and context
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(50), index=True, nullable=False)  # login, logout, event_created, payment_received, etc.
    resource_type = Column(String(50), nullable=False)  # user, event, payment, withdrawal
    resource_id = Column(Integer, nullable=True, index=True)

    # Details
    description = Column(Text, nullable=True)
    changes = Column(JSON, nullable=True)  # What changed

    # Request context
    ip_address = Column(String(45), index=True, nullable=False)  # Support IPv4 and IPv6
    user_agent = Column(String(500), nullable=True)

    # Status
    status = Column(String(20), default="success")  # success, failure, warning
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AuditLog {self.id}: {self.action} on {self.resource_type}/{self.resource_id}>"
