import os
import hmac
import hashlib
import logging
from pydantic_settings import BaseSettings
from typing import Literal

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    APP_NAME: str = "Accredit.vip API"

    # CRITICAL: Environment-based debug setting
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    DATABASE_URL: str = "sqlite+aiosqlite:///./accredit.db"

    # CRITICAL: Strong SECRET_KEY must be set in production
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "")

    ALGORITHM: str = "HS256"

    # Token expiration: 7 days (refresh token handles rotation)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SESSION_IDLE_TIMEOUT_MINUTES: int = 30

    # Security: Max failed login attempts before lockout
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 15

    REDIS_URL: str = "redis://localhost:6379/0"
    PAYSTACK_SECRET_KEY: str = ""
    PAYSTACK_PUBLIC_KEY: str = ""
    PAYSTACK_TEST_MODE: bool = False
    # Test keys used ONLY for the owner's own dashboard payments
    PAYSTACK_TEST_SECRET_KEY: str = ""
    PAYSTACK_TEST_PUBLIC_KEY: str = ""
    PAYSTACK_TEST_OWNER_EMAIL: str = "sodushileomodolapoodunayo@gmail.com"
    FLUTTERWAVE_SECRET_KEY: str = ""

    OPENAI_API_KEY: str = ""
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""
    WHATSAPP_CLOUD_TOKEN: str = ""
    WHATSAPP_CLOUD_PHONE_ID: str = ""
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = ""
    TWILIO_WHATSAPP_CONTENT_SID: str = ""
    TWILIO_WHATSAPP_INVITE_CONTENT_SID: str = ""
    TWILIO_WHATSAPP_QR_CONTENT_SID: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 465
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    # Fallback SMTP senders (tried in order when the primary fails).
    SMTP2_HOST: str = ""
    SMTP2_PORT: int = 465
    SMTP2_USERNAME: str = ""
    SMTP2_PASSWORD: str = ""
    SMTP3_HOST: str = ""
    SMTP3_PORT: int = 587
    SMTP3_USERNAME: str = ""
    SMTP3_PASSWORD: str = ""
    SMTP4_HOST: str = ""
    SMTP4_PORT: int = 465
    SMTP4_USERNAME: str = ""
    SMTP4_PASSWORD: str = ""
    # Co-developer accreditation portal (BLACK MARKET event 77 only).
    PARTNER_TICKET_API_URL: str = "https://blackmarketmovie.accredit.vip/ticket-sale-api/"
    EMAIL_FROM: str = "ACCREDIT INTERACTIVE <invites@accredit.vip>"
    RESEND_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "ACCREDIT INTERACTIVE <invites@accredit.vip>"
    TERMII_API_KEY: str = ""
    AFRICASTALKING_API_KEY: str = ""
    AFRICASTALKING_USERNAME: str = ""

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FACEBOOK_CLIENT_ID: str = ""
    FACEBOOK_CLIENT_SECRET: str = ""
    APPLE_CLIENT_ID: str = ""
    APPLE_CLIENT_SECRET: str = ""

    EVOLUTION_API_URL: str = ""
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE: str = ""

    PLATFORM_FEE_PERCENT: float = 5.0
    VAT_PERCENT: float = 2.5

    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    PICKUP_ADMIN_EMAIL: str = "lajokes@accredit.vip"
    PICKUP_ADMIN_PASSWORD: str = ""
    PICKUP_JWT_SECRET: str = ""
    PICKUP_FLYER_CONTENT_SID: str = ""

    # Security: Allowed hosts for CORS
    ALLOWED_HOSTS: list = [
        "accredit.vip",
        "www.accredit.vip",
        "api.accredit.vip",
        "app.accredit.vip",
    ]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def __init__(self, **data):
        super().__init__(**data)

        # CRITICAL: Validate SECRET_KEY is set in production
        if not self.SECRET_KEY:
            if self.DEBUG:
                self.SECRET_KEY = "dev-only-key-change-in-production"
                logger.warning("⚠️ Using development SECRET_KEY - CHANGE IN PRODUCTION!")
            else:
                raise ValueError(
                    "CRITICAL: SECRET_KEY must be set via environment variable. "
                    "Generate with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )

        # CRITICAL: Validate ENCRYPTION_KEY for data protection
        if not self.ENCRYPTION_KEY and not self.DEBUG:
            raise ValueError(
                "CRITICAL: ENCRYPTION_KEY must be set via environment variable. "
                "Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )

        # WARN: Debug mode in production
        if self.DEBUG:
            logger.warning("⚠️⚠️⚠️ DEBUG MODE IS ENABLED - DO NOT USE IN PRODUCTION ⚠️⚠️⚠️")

    def paystack_secret_key(self, user_email: str | None = None) -> str:
        """Live key for everyone; test key only when the requester is the owner."""
        if (
            user_email
            and self.PAYSTACK_TEST_SECRET_KEY
            and user_email.strip().lower() == self.PAYSTACK_TEST_OWNER_EMAIL.strip().lower()
        ):
            return self.PAYSTACK_TEST_SECRET_KEY
        return self.PAYSTACK_SECRET_KEY

    def paystack_signature_valid(self, body: bytes, signature: str) -> bool:
        """Accept webhook signatures from either live or test Paystack keys."""
        if not signature:
            return False
        for key in (self.PAYSTACK_SECRET_KEY, self.PAYSTACK_TEST_SECRET_KEY):
            if not key:
                continue
            expected = hmac.new(key.encode(), body, hashlib.sha512).hexdigest()
            if hmac.compare_digest(signature, expected):
                return True
        return False


settings = Settings()
