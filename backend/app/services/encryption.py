"""Encryption service for sensitive data protection"""

from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


class EncryptionService:
    """Handle encryption/decryption of sensitive data"""

    def __init__(self):
        if not settings.ENCRYPTION_KEY:
            raise ValueError("ENCRYPTION_KEY not configured")
        try:
            self.cipher = Fernet(settings.ENCRYPTION_KEY.encode())
        except Exception as e:
            logger.error(f"Failed to initialize encryption: {e}")
            raise

    def encrypt(self, data: str) -> str:
        """Encrypt sensitive string data"""
        if not data:
            return ""
        try:
            encrypted = self.cipher.encrypt(data.encode())
            return encrypted.decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt encrypted data"""
        if not encrypted_data:
            return ""
        try:
            decrypted = self.cipher.decrypt(encrypted_data.encode())
            return decrypted.decode()
        except InvalidToken:
            logger.error("Failed to decrypt data - invalid token")
            raise ValueError("Failed to decrypt data - corrupted or invalid")
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise


# Global instance
encryption_service = EncryptionService() if settings.ENCRYPTION_KEY else None
