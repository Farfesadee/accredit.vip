"""
Trial Enforcement Service
Prevents abuse of one-time trial features (CREATE INVITE, POST EVENT)
Detects: multiple accounts per user, device fingerprint spoofing, account sharing
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional
from fastapi import Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.config import settings
from app.models.user import User
from app.models.trial_usage import TrialUsage


class TrialEnforcementService:
    """Enforce trial limits and detect abuse patterns"""

    TRIAL_TYPES = {"invite", "event"}
    FINGERPRINT_HASH_ALGORITHM = "sha256"

    @staticmethod
    def _hash(value: str) -> str:
        """Hash value with SECRET_KEY for integrity"""
        return hashlib.sha256(f"{settings.SECRET_KEY}:{value}".encode("utf-8")).hexdigest()

    @staticmethod
    def _fingerprint_hash(fingerprint: str) -> str:
        """Create fingerprint hash"""
        return TrialEnforcementService._hash(f"fingerprint:{fingerprint}")

    @staticmethod
    def _client_hash(request: Request) -> str:
        """Create client hash from IP + user agent"""
        forwarded = request.headers.get("x-forwarded-for", "")
        ip = forwarded.split(",")[0].strip() if forwarded else (
            request.client.host if request.client else "unknown"
        )
        ua = request.headers.get("user-agent", "unknown")
        return TrialEnforcementService._hash(f"client:{ip}:{ua}")

    @staticmethod
    async def check_trial_available(
        user: User,
        trial_type: str,
        db: AsyncSession,
    ) -> dict:
        """
        Check if user can use a trial
        Returns: {allowed: bool, reason: str}
        """
        if trial_type not in TrialEnforcementService.TRIAL_TYPES:
            raise HTTPException(status_code=400, detail="Invalid trial type")

        # Check if user already used this trial
        if trial_type == "invite" and user.trial_invite_used:
            return {
                "allowed": False,
                "reason": "You have already used your free CREATE INVITE trial. Upgrade your account for unlimited invites.",
            }

        if trial_type == "event" and user.trial_event_used:
            return {
                "allowed": False,
                "reason": "You have already used your free POST EVENT trial. Upgrade your account for unlimited events.",
            }

        # Trial is available
        return {"allowed": True, "reason": None}

    @staticmethod
    async def record_trial_usage(
        user: User,
        trial_type: str,
        fingerprint: Optional[str],
        request: Request,
        db: AsyncSession,
    ) -> None:
        """
        Record that user used their trial
        Links trial_usage record to authenticated user account
        """
        if trial_type not in TrialEnforcementService.TRIAL_TYPES:
            raise HTTPException(status_code=400, detail="Invalid trial type")

        fingerprint_hash = None
        if fingerprint:
            fingerprint_hash = TrialEnforcementService._fingerprint_hash(fingerprint)

        client_hash = TrialEnforcementService._client_hash(request)

        # Update user record
        if trial_type == "invite":
            user.trial_invite_used = True
        elif trial_type == "event":
            user.trial_event_used = True

        user.trial_fingerprint_hash = fingerprint_hash
        user.trial_used_at = datetime.now(timezone.utc)

        # Also record in trial_usages table (for future fraud detection)
        usage = TrialUsage(
            trial_type=trial_type,
            fingerprint_hash=fingerprint_hash or "",
            client_hash=client_hash,
            summary=f"User {user.id} ({user.email})",
        )

        db.add(user)
        db.add(usage)
        await db.commit()

    @staticmethod
    async def detect_multi_account_abuse(
        fingerprint: str,
        client_hash_value: str,
        db: AsyncSession,
    ) -> Optional[dict]:
        """
        Detect if this fingerprint/client is already linked to another user account
        Returns: {abuse_detected: bool, message: str, linked_user_id: int}
        Prevents: user creating multiple accounts to get multiple trials
        """
        if not fingerprint:
            return None

        fingerprint_hash = TrialEnforcementService._fingerprint_hash(fingerprint)

        # Check trial_usages table for this fingerprint
        result = await db.execute(
            select(TrialUsage).where(TrialUsage.fingerprint_hash == fingerprint_hash).limit(1)
        )
        trial_record = result.scalar_one_or_none()

        if trial_record:
            # Extract user_id from trial summary
            try:
                summary_parts = trial_record.summary.split()
                if "User" in summary_parts:
                    user_idx = summary_parts.index("User") + 1
                    linked_user_id = int(summary_parts[user_idx])
                    return {
                        "abuse_detected": True,
                        "message": f"This device is already linked to another account. Each device gets one free trial.",
                        "linked_user_id": linked_user_id,
                        "detection_method": "fingerprint_match",
                    }
            except (ValueError, IndexError):
                pass

        # Check client hash
        result = await db.execute(
            select(TrialUsage).where(TrialUsage.client_hash == client_hash_value).limit(10)
        )
        trial_records = result.scalars().all()

        if len(trial_records) >= 3:
            # Same IP/UA used for 3+ trials = suspicious
            return {
                "abuse_detected": True,
                "message": "Multiple trial attempts detected from this network. Please contact support.",
                "detection_method": "client_hash_frequency",
                "attempt_count": len(trial_records),
            }

        return None

    @staticmethod
    async def detect_account_sharing(
        user: User,
        request: Request,
        db: AsyncSession,
    ) -> Optional[dict]:
        """
        Detect if account is being used from unusual locations/devices
        Returns: {sharing_detected: bool, message: str}
        Prevents: user sharing account with others to multiply trials
        """
        current_ip = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip()
            if request.headers.get("x-forwarded-for")
            else (request.client.host if request.client else "unknown")
        )

        # If user last logged in from different IP and it's within 10 minutes,
        # this could be account sharing
        if user.last_login_ip and user.last_login_at:
            time_diff = (datetime.now(timezone.utc) - user.last_login_at).total_seconds()

            if (
                current_ip != user.last_login_ip
                and 0 < time_diff < 600  # Within 10 minutes
            ):
                return {
                    "sharing_detected": True,
                    "message": "Account accessed from multiple locations simultaneously. Possible account sharing.",
                }

        return None

    @staticmethod
    async def generate_fraud_report(
        trial_type: str,
        user: User,
        fingerprint: Optional[str],
        request: Request,
        db: AsyncSession,
    ) -> dict:
        """
        Generate detailed fraud detection report
        Used for monitoring and investigation
        """
        client_hash_value = TrialEnforcementService._client_hash(request)
        multi_account = await TrialEnforcementService.detect_multi_account_abuse(
            fingerprint or "", client_hash_value, db
        )
        account_sharing = await TrialEnforcementService.detect_account_sharing(user, request, db)

        return {
            "user_id": user.id,
            "user_email": user.email,
            "trial_type": trial_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
            "fingerprint": fingerprint,
            "multi_account_abuse": multi_account,
            "account_sharing": account_sharing,
            "risk_level": "high" if (multi_account or account_sharing) else "low",
        }
