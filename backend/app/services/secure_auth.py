"""Secure authentication service with account lockout and logging"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.user import User
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.services.audit import AuditService
from fastapi import HTTPException, status, Request
import logging

logger = logging.getLogger(__name__)


class SecureAuthService:
    """Authentication service with security features"""

    @staticmethod
    async def authenticate_user(
        db: AsyncSession,
        email: str,
        password: str,
        request: Request,
    ) -> tuple[User, str]:
        """
        Authenticate user with account lockout protection
        
        Returns: (user, access_token)
        """
        # Get user
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(f"Login attempt for non-existent user: {email}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if user.is_active is False:
            logger.warning(f"Login attempt on suspended account: {email}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been suspended. Contact support.",
            )

        # Check if account is locked
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            remaining_minutes = int(
                (user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60
            )
            logger.warning(
                f"Login attempt on locked account {email}. Unlock in {remaining_minutes}m"
            )
            
            # Log failed attempt
            await AuditService.log_login(
                db=db,
                user_id=user.id,
                request=request,
                success=False,
                error_message="Account locked due to too many failed attempts",
            )

            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account locked. Try again in {remaining_minutes} minutes.",
            )

        # Verify password
        if not verify_password(password, user.password_hash):
            user.failed_login_attempts += 1

            # Lock account if too many attempts
            if user.failed_login_attempts >= settings.MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(
                    minutes=settings.LOCKOUT_DURATION_MINUTES
                )
                logger.warning(
                    f"Account locked after {settings.MAX_LOGIN_ATTEMPTS} failed attempts: {email}"
                )

            await db.commit()

            # Log failed attempt
            await AuditService.log_login(
                db=db,
                user_id=user.id,
                request=request,
                success=False,
                error_message="Invalid password",
            )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Login successful - reset failed attempts and update last login
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.now(timezone.utc)
        user.last_login_ip = request.client.host if request.client else None

        await db.commit()

        # Log successful login
        await AuditService.log_login(
            db=db,
            user_id=user.id,
            request=request,
            success=True,
        )

        # Create access token
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        return user, access_token

    @staticmethod
    async def unlock_account(db: AsyncSession, user_id: int) -> None:
        """Manually unlock a user account (admin only)"""
        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                failed_login_attempts=0,
                locked_until=None,
            )
        )
        await db.commit()
