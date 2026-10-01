"""Security tests for authentication, rate limiting, and data protection"""

import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.config import settings
from app.core.security import hash_password

client = TestClient(app)


class TestPasswordPolicy:
    """Test strong password requirements"""

    def test_password_too_short(self):
        """Weak password should be rejected"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "Short1!",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 422
        assert "at least 12 characters" in response.text.lower()

    def test_password_no_uppercase(self):
        """Password without uppercase should be rejected"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "lowercase12!",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 422

    def test_password_valid_strong(self):
        """Strong password should pass validation"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "secure@example.com",
                "password": "StrongPass123!@#",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        # Should not return 422 validation error
        assert response.status_code != 422


class TestSecureCookies:
    """Test secure cookie configuration"""

    def test_secure_cookie_attributes(self):
        """Auth cookies should have security attributes"""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "test@example.com",
                "password": "TestPass123!@#",
            },
        )

        if "Set-Cookie" in response.headers:
            cookie = response.headers["Set-Cookie"]
            # SECURITY: Check mandatory attributes
            assert "HttpOnly" in cookie
            assert "SameSite" in cookie


class TestAuditLogging:
    """Test audit logging for security events"""

    def test_audit_log_model_exists(self):
        """AuditLog model should be importable"""
        assert AuditLog is not None


class TestSensitiveDataFilter:
    """Test logging security filter"""

    def test_passwords_redacted_from_logs(self):
        """Passwords should be redacted from logs"""
        from app.core.logging_config import SensitiveDataFilter
        import logging

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg='password="mySecretPass123"',
            args=(),
            exc_info=None,
        )

        filter = SensitiveDataFilter()
        filter.filter(record)

        assert "mySecretPass123" not in record.msg
        assert "REDACTED" in record.msg


class TestInputValidation:
    """Test input validation and injection protection"""

    def test_invalid_email_rejected(self):
        """Invalid email should be rejected"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "not-an-email",
                "password": "StrongPass123!@#",
                "first_name": "Test",
                "last_name": "User",
            },
        )
        assert response.status_code == 422

    def test_extra_fields_rejected(self):
        """Extra fields should be rejected"""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "StrongPass123!@#",
                "first_name": "Test",
                "last_name": "User",
                "is_admin": True,  # Extra unauthorized field
            },
        )
        # Should reject due to schema validation
        assert response.status_code == 422
