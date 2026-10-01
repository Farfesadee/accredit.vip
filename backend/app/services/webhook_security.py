"""Secure webhook signature verification"""

import hmac
import hashlib
import logging
from fastapi import HTTPException, status, Request

logger = logging.getLogger(__name__)


class WebhookSecurityService:
    """Verify webhook signatures to prevent spoofing"""

    @staticmethod
    async def verify_paystack_signature(
        request: Request,
        body: bytes,
        paystack_secret_key: str,
    ) -> dict:
        """
        Verify Paystack webhook signature
        
        Paystack sends signature in x-paystack-signature header
        """
        signature = request.headers.get("x-paystack-signature")

        if not signature:
            logger.warning("Paystack webhook received without signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing webhook signature",
            )

        # Compute expected signature
        expected_signature = hmac.new(
            paystack_secret_key.encode(),
            body,
            hashlib.sha512,
        ).hexdigest()

        # Use constant-time comparison to prevent timing attacks
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning(
                f"Invalid Paystack webhook signature. "
                f"Received: {signature[:10]}... Expected: {expected_signature[:10]}..."
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

        logger.info("Valid Paystack webhook signature verified")
        return await request.json()

    @staticmethod
    async def verify_flutterwave_signature(
        request: Request,
        body: bytes,
        flutterwave_secret_key: str,
    ) -> dict:
        """
        Verify Flutterwave webhook signature
        
        Flutterwave sends signature in verifications header
        """
        signature = request.headers.get("verifications")

        if not signature:
            logger.warning("Flutterwave webhook received without signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing webhook signature",
            )

        # Compute expected signature
        expected_signature = hmac.new(
            flutterwave_secret_key.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        # Use constant-time comparison
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Invalid Flutterwave webhook signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

        logger.info("Valid Flutterwave webhook signature verified")
        return await request.json()

    @staticmethod
    async def verify_generic_signature(
        request: Request,
        body: bytes,
        secret_key: str,
        signature_header: str = "x-signature",
        algorithm: str = "sha256",
    ) -> dict:
        """Verify generic webhook signature"""
        signature = request.headers.get(signature_header)

        if not signature:
            logger.warning(f"Webhook received without {signature_header}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Missing {signature_header}",
            )

        # Determine hash algorithm
        if algorithm == "sha256":
            hash_func = hashlib.sha256
        elif algorithm == "sha512":
            hash_func = hashlib.sha512
        else:
            hash_func = hashlib.sha256

        # Compute expected signature
        expected_signature = hmac.new(
            secret_key.encode(),
            body,
            hash_func,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("Invalid webhook signature")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid signature",
            )

        logger.info("Valid webhook signature verified")
        return await request.json()
