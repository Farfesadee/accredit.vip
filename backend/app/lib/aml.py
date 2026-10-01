"""Anti-Money Laundering (AML) compliance checks"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from app.models.user import User
from app.models.wallet import BankAccount, SUPPORTED_CURRENCIES


class AMLChecker:
    """AML compliance checker for withdrawal requests"""

    # AML Thresholds
    VERIFICATION_THRESHOLD = {
        "NGN": 2000000,  # Flag withdrawals over 2M NGN
        "USD": 20000,    # Flag withdrawals over $20K USD
        "GHS": 100000,   # Flag withdrawals over 100K GHS
        "KES": 2000000,  # Flag withdrawals over 2M KES
        "ZAR": 500000,   # Flag withdrawals over 500K ZAR
        "UGX": 50000000, # Flag withdrawals over 50M UGX
    }

    DAILY_LIMIT = {
        "NGN": 5000000,
        "USD": 50000,
        "GHS": 500000,
        "KES": 5000000,
        "ZAR": 1000000,
        "UGX": 100000000,
    }

    RISK_SCORES = {
        "high_amount": 30,           # Large withdrawal
        "frequent_withdrawals": 20,   # Multiple withdrawals in short time
        "unusual_pattern": 25,        # Unusual activity pattern
        "new_account": 15,            # Recently linked bank account
        "cross_border": 10,           # Cross-country transfer
        "blacklist_match": 100,       # Matches sanctions list (auto-flag)
    }

    @staticmethod
    def check_risks(
        user: User,
        amount: float,
        currency: str,
        bank_account: BankAccount,
    ) -> Dict[str, Any]:
        """
        Perform comprehensive AML checks on withdrawal request

        Returns:
        {
            "is_flagged": bool,
            "risk_score": int (0-100),
            "requires_verification": bool,
            "reasons": [str]
        }
        """
        risk_score = 0
        reasons = []

        # ✅ Check 1: Verify account holder name matches
        # This is done at bank account addition, but double-check here
        if bank_account.account_holder_name.lower() != user.full_name.lower():
            return {
                "is_flagged": True,
                "risk_score": 100,
                "requires_verification": True,
                "reason": "Account holder name mismatch - critical AML check failed",
            }

        # ✅ Check 2: Amount-based risk
        threshold = AMLChecker.VERIFICATION_THRESHOLD.get(currency, 50000)
        if amount > threshold:
            risk_score += AMLChecker.RISK_SCORES["high_amount"]
            reasons.append(f"High withdrawal amount ({amount} {currency})")

        # ✅ Check 3: New bank account (less than 7 days old)
        if bank_account.created_at > datetime.now(timezone.utc) - timedelta(days=7):
            risk_score += AMLChecker.RISK_SCORES["new_account"]
            reasons.append("Recently linked bank account")

        # ✅ Check 4: Cross-border risk (if user country != bank account country)
        # This assumes user has a country field or it's extracted from address
        if hasattr(user, "country") and user.country != bank_account.country_code:
            risk_score += AMLChecker.RISK_SCORES["cross_border"]
            reasons.append("Cross-border withdrawal detected")

        # ✅ Check 5: Sanctioned countries/entities (simplified)
        sanctioned_countries = ["IR", "SY", "NK", "CU"]  # Iran, Syria, N.Korea, Cuba
        if bank_account.country_code in sanctioned_countries:
            return {
                "is_flagged": True,
                "risk_score": 100,
                "requires_verification": True,
                "reason": f"Withdrawal to sanctioned jurisdiction ({bank_account.country_code})",
            }

        # ✅ Check 6: Structuring detection (many small withdrawals = structuring)
        # Would need to check recent withdrawal patterns in a real implementation
        # This is a simplified check
        if amount < 10000 and currency == "NGN":
            # Check if user has made multiple small withdrawals recently
            # For now, we'll keep it simple
            pass

        # Determine final decision
        is_flagged = risk_score >= 50
        requires_verification = risk_score >= 40

        return {
            "is_flagged": is_flagged,
            "risk_score": risk_score,
            "requires_verification": requires_verification,
            "reason": " | ".join(reasons) if reasons else None,
        }


def check_aml_risks(
    user: User,
    amount: float,
    currency: str,
    bank_account: BankAccount,
) -> Dict[str, Any]:
    """
    Wrapper function for AML checking

    Returns dict with:
    - is_flagged: Whether withdrawal is flagged for review
    - risk_score: 0-100 risk score
    - requires_verification: Whether user needs to provide additional verification
    - reason: Reason for flagging (if any)
    """
    return AMLChecker.check_risks(user, amount, currency, bank_account)


def get_aml_limits(currency: str) -> Dict[str, float]:
    """Get AML limits for a currency"""
    return {
        "daily_limit": AMLChecker.DAILY_LIMIT.get(currency, 50000),
        "verification_threshold": AMLChecker.VERIFICATION_THRESHOLD.get(currency, 50000),
    }
