"""Audit logging service for security events"""

from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
from fastapi import Request
import logging

logger = logging.getLogger(__name__)


class AuditService:
    """Service for logging security-relevant events"""

    @staticmethod
    async def log_event(
        db: AsyncSession,
        user_id: int | None,
        action: str,
        resource_type: str,
        resource_id: int | None,
        request: Request,
        description: str | None = None,
        changes: dict | None = None,
        status: str = "success",
        error_message: str | None = None,
    ) -> AuditLog:
        """Log an audit event"""
        try:
            audit_log = AuditLog(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                description=description,
                changes=changes,
                ip_address=request.client.host if request.client else "unknown",
                user_agent=request.headers.get("user-agent", "unknown"),
                status=status,
                error_message=error_message,
            )
            db.add(audit_log)
            await db.commit()
            return audit_log
        except Exception as e:
            logger.error(f"Failed to log audit event: {e}")
            # Don't raise - audit logging failure shouldn't break the app
            return None

    @staticmethod
    async def log_login(
        db: AsyncSession,
        user_id: int,
        request: Request,
        success: bool = True,
        error_message: str | None = None,
    ) -> AuditLog:
        """Log a login attempt"""
        return await AuditService.log_event(
            db=db,
            user_id=user_id if success else None,
            action="login",
            resource_type="user",
            resource_id=user_id,
            request=request,
            description=f"Login {'successful' if success else 'failed'}",
            status="success" if success else "failure",
            error_message=error_message,
        )

    @staticmethod
    async def log_logout(
        db: AsyncSession,
        user_id: int,
        request: Request,
    ) -> AuditLog:
        """Log a logout"""
        return await AuditService.log_event(
            db=db,
            user_id=user_id,
            action="logout",
            resource_type="user",
            resource_id=user_id,
            request=request,
        )

    @staticmethod
    async def log_password_change(
        db: AsyncSession,
        user_id: int,
        request: Request,
    ) -> AuditLog:
        """Log a password change"""
        return await AuditService.log_event(
            db=db,
            user_id=user_id,
            action="password_changed",
            resource_type="user",
            resource_id=user_id,
            request=request,
        )

    @staticmethod
    async def log_event_creation(
        db: AsyncSession,
        user_id: int,
        event_id: int,
        request: Request,
    ) -> AuditLog:
        """Log an event creation"""
        return await AuditService.log_event(
            db=db,
            user_id=user_id,
            action="created",
            resource_type="event",
            resource_id=event_id,
            request=request,
        )

    @staticmethod
    async def log_payment_received(
        db: AsyncSession,
        user_id: int | None,
        event_id: int,
        request: Request,
        amount: float,
    ) -> AuditLog:
        """Log a payment received"""
        return await AuditService.log_event(
            db=db,
            user_id=user_id,
            action="payment_received",
            resource_type="payment",
            resource_id=event_id,
            request=request,
            description=f"Payment of {amount} received",
        )

    @staticmethod
    async def log_withdrawal_request(
        db: AsyncSession,
        user_id: int,
        request: Request,
        amount: float,
    ) -> AuditLog:
        """Log a withdrawal request"""
        return await AuditService.log_event(
            db=db,
            user_id=user_id,
            action="withdrawal_requested",
            resource_type="withdrawal",
            resource_id=None,
            request=request,
            description=f"Withdrawal of {amount} requested",
        )
