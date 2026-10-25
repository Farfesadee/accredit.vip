#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
SECURITY CHECK SCRIPT
Senior Cyber Security Officer Validation

Run this before deploying to production to verify all security controls are in place.
Usage: python scripts/security_check.py
"""

import os
import sys
import re
from pathlib import Path

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

CRITICAL_CHECKS = []
PASSED_CHECKS = []
FAILED_CHECKS = []
WARNINGS = []


def check_env_file():
    """Check .env file for proper configuration"""
    print("\n🔐 Checking environment configuration...")

    env_path = Path(".env")
    if not env_path.exists():
        FAILED_CHECKS.append("❌ .env file not found")
        return False

    env_content = env_path.read_text(encoding='utf-8', errors='replace')

    # Check DEBUG setting
    if "DEBUG=true" in env_content.lower() or "DEBUG=True" in env_content:
        CRITICAL_CHECKS.append("❌ CRITICAL: DEBUG=true in .env (security risk)")
        return False
    elif "DEBUG=false" in env_content.lower() or "DEBUG=False" in env_content:
        PASSED_CHECKS.append("✅ DEBUG=false configured")
    else:
        WARNINGS.append("⚠️  WARNING: DEBUG setting not found in .env")

    # Check SECRET_KEY
    if "SECRET_KEY=change-me" in env_content or "SECRET_KEY=" not in env_content:
        CRITICAL_CHECKS.append("❌ CRITICAL: SECRET_KEY is missing or using default")
        return False
    elif "SECRET_KEY=dev-only" in env_content:
        WARNINGS.append("⚠️  WARNING: Development SECRET_KEY in use")
    else:
        PASSED_CHECKS.append("✅ SECRET_KEY is configured")

    # Check ENCRYPTION_KEY
    if "ENCRYPTION_KEY=" not in env_content or "ENCRYPTION_KEY=" in env_content and "ENCRYPTION_KEY=your-" in env_content:
        CRITICAL_CHECKS.append("❌ CRITICAL: ENCRYPTION_KEY is missing")
        return False
    else:
        PASSED_CHECKS.append("✅ ENCRYPTION_KEY is configured")

    # Check PAYSTACK keys
    if "PAYSTACK_SECRET_KEY=" not in env_content or "PAYSTACK_SECRET_KEY=sk_" not in env_content.lower():
        WARNINGS.append("⚠️  WARNING: Paystack secret key may not be configured")

    return True


def check_config_file():
    """Check config.py for security settings"""
    print("\n🔍 Checking configuration file...")

    config_path = Path("app/core/config.py")
    if not config_path.exists():
        FAILED_CHECKS.append("❌ config.py not found")
        return False

    config_content = config_path.read_text(encoding='utf-8', errors='replace')

    # Check DEBUG setting
    if 'DEBUG: bool = True' in config_content:
        CRITICAL_CHECKS.append("❌ CRITICAL: DEBUG hardcoded to True in config.py")
        return False
    elif 'DEBUG: bool = os.getenv("DEBUG"' in config_content or 'os.getenv("DEBUG"' in config_content:
        PASSED_CHECKS.append("✅ DEBUG is environment-based")
    else:
        FAILED_CHECKS.append("❌ DEBUG setting is not properly configured")

    # Check SECRET_KEY validation
    if 'raise ValueError' in config_content and 'SECRET_KEY' in config_content:
        PASSED_CHECKS.append("✅ SECRET_KEY validation is in place")
    else:
        WARNINGS.append("⚠️  WARNING: SECRET_KEY validation may be missing")

    # Check token expiration
    if 'ACCESS_TOKEN_EXPIRE_MINUTES: int = 15' in config_content:
        PASSED_CHECKS.append("✅ Token expiration set to 15 minutes")
    elif 'ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24' in config_content:
        CRITICAL_CHECKS.append("❌ CRITICAL: Token expiration is 24 hours (should be 15 minutes)")
        return False
    else:
        WARNINGS.append("⚠️  WARNING: Token expiration setting unclear")

    return True


def check_security_services():
    """Check if security services are implemented"""
    print("\n🛡️  Checking security services...")

    required_services = {
        "app/services/secure_auth.py": "SecureAuthService",
        "app/services/audit.py": "AuditService",
        "app/services/encryption.py": "EncryptionService",
        "app/services/webhook_security.py": "WebhookSecurityService",
        "app/services/file_upload_security.py": "FileUploadSecurityService",
        "app/core/logging_config.py": "SensitiveDataFilter",
    }

    all_present = True
    for service_path, class_name in required_services.items():
        path = Path(service_path)
        if not path.exists():
            FAILED_CHECKS.append(f"❌ Missing: {service_path}")
            all_present = False
        else:
            content = path.read_text()
            if class_name in content:
                PASSED_CHECKS.append(f"✅ {class_name} is implemented")
            else:
                FAILED_CHECKS.append(f"❌ {class_name} not found in {service_path}")
                all_present = False

    return all_present


def check_auth_integration():
    """Check if auth endpoints use secure services"""
    print("\n🔑 Checking authentication integration...")

    auth_path = Path("app/api/auth.py")
    if not auth_path.exists():
        FAILED_CHECKS.append("❌ auth.py not found")
        return False

    content = auth_path.read_text()

    checks = {
        "SecureAuthService": "Secure authentication service",
        "AuditService.log": "Audit logging",
        "set_auth_cookie": "Secure cookie handling",
        "samesite=\"strict\"": "CSRF protection",
        "httponly=True": "XSS protection",
    }

    all_found = True
    for keyword, description in checks.items():
        if keyword in content:
            PASSED_CHECKS.append(f"✅ {description} is integrated")
        else:
            FAILED_CHECKS.append(f"❌ {description} not found in auth.py")
            all_found = False

    return all_found


def check_webhook_security():
    """Check webhook signature verification"""
    print("\n🪝 Checking webhook security...")

    webhook_path = Path("app/api/webhooks.py")
    if not webhook_path.exists():
        WARNINGS.append("⚠️  WARNING: webhooks.py not found")
        return False

    content = webhook_path.read_text()

    if "WebhookSecurityService" in content:
        PASSED_CHECKS.append("✅ Webhook signature verification is in place")
    else:
        WARNINGS.append("⚠️  WARNING: Webhook signature verification may not be implemented")
        return False

    if "verify_paystack_signature" in content:
        PASSED_CHECKS.append("✅ Paystack webhook verification is configured")
    else:
        WARNINGS.append("⚠️  WARNING: Paystack webhook verification may be missing")

    return True


def check_dependencies():
    """Check requirements.txt for security dependencies"""
    print("\n📦 Checking security dependencies...")

    req_path = Path("requirements.txt")
    if not req_path.exists():
        FAILED_CHECKS.append("❌ requirements.txt not found")
        return False

    content = req_path.read_text()

    required_packages = {
        "cryptography": "Data encryption",
        "slowapi": "Rate limiting",
        "bcrypt": "Password hashing",
        "python-jose": "JWT handling",
    }

    all_found = True
    for package, description in required_packages.items():
        if package in content:
            PASSED_CHECKS.append(f"✅ {package} ({description}) is in requirements")
        else:
            FAILED_CHECKS.append(f"❌ {package} not found in requirements.txt")
            all_found = False

    return all_found


def check_migrations():
    """Check if database migrations exist"""
    print("\n🗄️  Checking database migrations...")

    migrations_dir = Path("alembic/versions")
    if not migrations_dir.exists():
        WARNINGS.append("⚠️  WARNING: Alembic versions directory not found")
        return False

    migration_files = list(migrations_dir.glob("*.py"))

    if len(migration_files) == 0:
        FAILED_CHECKS.append("❌ No migrations found in alembic/versions")
        return False

    migration_names = [f.name for f in migration_files]

    expected_migrations = [
        "login_security",
        "audit_log",
    ]

    for expected in expected_migrations:
        found = any(expected.lower() in name.lower() for name in migration_names)
        if found:
            PASSED_CHECKS.append(f"✅ Migration for {expected} exists")
        else:
            WARNINGS.append(f"⚠️  WARNING: Migration for {expected} may be missing")

    return True


def print_summary():
    """Print final summary"""
    print("\n" + "=" * 60)
    print("SECURITY CHECK SUMMARY")
    print("=" * 60)

    if CRITICAL_CHECKS:
        print("\n🚨 CRITICAL ISSUES (MUST FIX BEFORE PRODUCTION):")
        for check in CRITICAL_CHECKS:
            print(f"  {check}")

    if FAILED_CHECKS:
        print("\n❌ FAILED CHECKS:")
        for check in FAILED_CHECKS:
            print(f"  {check}")

    if WARNINGS:
        print("\n⚠️  WARNINGS:")
        for warning in WARNINGS:
            print(f"  {warning}")

    if PASSED_CHECKS:
        print(f"\n✅ PASSED CHECKS ({len(PASSED_CHECKS)}):")
        for check in PASSED_CHECKS[:5]:  # Show first 5
            print(f"  {check}")
        if len(PASSED_CHECKS) > 5:
            print(f"  ... and {len(PASSED_CHECKS) - 5} more")

    print("\n" + "=" * 60)

    if CRITICAL_CHECKS or FAILED_CHECKS:
        print("❌ SECURITY CHECK FAILED - DO NOT DEPLOY")
        return False
    else:
        print("✅ SECURITY CHECK PASSED - SAFE TO DEPLOY")
        return True


def main():
    """Run all security checks"""
    print("🔒 SECURITY PRE-DEPLOYMENT CHECK")
    print("=" * 60)

    checks = [
        ("Environment Configuration", check_env_file),
        ("Config File", check_config_file),
        ("Security Services", check_security_services),
        ("Auth Integration", check_auth_integration),
        ("Webhook Security", check_webhook_security),
        ("Dependencies", check_dependencies),
        ("Database Migrations", check_migrations),
    ]

    for check_name, check_func in checks:
        try:
            check_func()
        except Exception as e:
            FAILED_CHECKS.append(f"❌ Error checking {check_name}: {str(e)}")

    success = print_summary()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
