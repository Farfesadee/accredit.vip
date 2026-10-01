"""Secure logging configuration to prevent sensitive data leaks"""

import logging
import re


class SensitiveDataFilter(logging.Filter):
    """Filter to redact sensitive information from logs"""

    # Patterns to redact
    SENSITIVE_PATTERNS = [
        (r'password["\']?\s*[:=]\s*["\']?([^"\']*)', r'password=***REDACTED***'),
        (r'token["\']?\s*[:=]\s*["\']?([^"\']*)', r'token=***REDACTED***'),
        (r'secret["\']?\s*[:=]\s*["\']?([^"\']*)', r'secret=***REDACTED***'),
        (r'api[_]?key["\']?\s*[:=]\s*["\']?([^"\']*)', r'api_key=***REDACTED***'),
        (r'authorization["\']?\s*[:=]\s*["\']?([^"\']*)', r'authorization=***REDACTED***'),
        (r'Bearer\s+[^\s]+', r'Bearer ***REDACTED***'),
        (r'credit[_]?card["\']?\s*[:=]\s*["\']?(\d{4})\d+(["\']?)', r'credit_card=****\1***'),
        (r'cvv["\']?\s*[:=]\s*["\']?\d+', r'cvv=***REDACTED***'),
        (r'ssn["\']?\s*[:=]\s*["\']?(\d{3})-?(\d{2})', r'ssn=***-**-****'),
        (r'account[_]?number["\']?\s*[:=]\s*["\']?\d+', r'account_number=***REDACTED***'),
    ]

    def filter(self, record):
        """Redact sensitive information from log record"""
        try:
            message = str(record.msg)

            for pattern, replacement in self.SENSITIVE_PATTERNS:
                message = re.sub(pattern, replacement, message, flags=re.IGNORECASE)

            record.msg = message

            # Also redact args if present
            if record.args:
                if isinstance(record.args, dict):
                    for key in list(record.args.keys()):
                        if any(
                            sensitive in key.lower()
                            for sensitive in [
                                "password",
                                "token",
                                "secret",
                                "key",
                                "card",
                                "cvv",
                            ]
                        ):
                            record.args[key] = "***REDACTED***"
        except Exception:
            # Don't break logging if filtering fails
            pass

        return True


def configure_logging():
    """Configure logging with security filters"""
    # Get root logger
    root_logger = logging.getLogger()

    # Add sensitive data filter to all handlers
    for handler in root_logger.handlers:
        handler.addFilter(SensitiveDataFilter())

    # Also configure for FastAPI logger
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
        logger = logging.getLogger(logger_name)
        for handler in logger.handlers:
            handler.addFilter(SensitiveDataFilter())

    return root_logger
