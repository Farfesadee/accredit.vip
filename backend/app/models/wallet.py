from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, func, Boolean, UniqueConstraint, CheckConstraint
from app.core.database import Base
import enum


SUPPORTED_CURRENCIES = {
    "NGN": {"name": "Nigerian Naira", "symbol": "₦", "flag": "🇳🇬", "country": "Nigeria", "min_fund": 100},
    "USD": {"name": "US Dollar",       "symbol": "$",  "flag": "🇺🇸", "country": "United States", "min_fund": 1},
    "GBP": {"name": "British Pound",   "symbol": "£",  "flag": "🇬🇧", "country": "United Kingdom", "min_fund": 1},
    "EUR": {"name": "Euro",            "symbol": "€",  "flag": "🇪🇺", "country": "European Union", "min_fund": 1},
    "KES": {"name": "Kenyan Shilling", "symbol": "KSh", "flag": "🇰🇪", "country": "Kenya", "min_fund": 100},
    "GHS": {"name": "Ghanaian Cedi",   "symbol": "GH₵", "flag": "🇬🇭", "country": "Ghana", "min_fund": 5},
    "ZAR": {"name": "South African Rand", "symbol": "R", "flag": "🇿🇦", "country": "South Africa", "min_fund": 10},
    "RWF": {"name": "Rwandan Franc",   "symbol": "FRw", "flag": "🇷🇼", "country": "Rwanda", "min_fund": 500},
    "UGX": {"name": "Ugandan Shilling","symbol": "USh", "flag": "🇺🇬", "country": "Uganda", "min_fund": 2000},
    "TZS": {"name": "Tanzanian Shilling","symbol": "TSh","flag": "🇹🇿", "country": "Tanzania", "min_fund": 1000},
}

DEFAULT_BALANCES = {code: 0.0 for code in SUPPORTED_CURRENCIES}


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    balance = Column(Float, default=0.0)
    currency = Column(String, default="NGN", nullable=False)
    is_primary = Column(Boolean, default=False)
    balances = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'currency', name='user_currency_unique'),
    )


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(Integer, primary_key=True, index=True)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="NGN")
    type = Column(String, nullable=False)
    reference = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BankAccount(Base):
    """Bank accounts linked to user wallets for withdrawals"""
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_holder_name = Column(String, nullable=False)  # Must match user's full_name exactly
    account_number = Column(String, nullable=False)
    bank_name = Column(String, nullable=False)
    bank_code = Column(String, nullable=True)  # SWIFT/BIC code
    country_code = Column(String, nullable=False)  # NG, GH, KE, ZA, RW, UG, TZ
    currency = Column(String, nullable=False)  # Currency this account accepts
    is_verified = Column(Boolean, default=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'account_number', 'bank_code', name='user_account_unique'),
    )


class Withdrawal(Base):
    """Withdrawal requests from wallets to bank accounts"""
    __tablename__ = "withdrawals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    wallet_id = Column(Integer, ForeignKey("wallets.id"), nullable=False)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, processing, completed, failed, flagged
    reference = Column(String, unique=True, nullable=False)

    # AML (Anti-Money Laundering) Checks
    is_aml_flagged = Column(Boolean, default=False)
    aml_reason = Column(String, nullable=True)  # Reason for AML flag
    daily_withdrawal_total = Column(Float, default=0.0)  # For daily limit tracking
    requires_verification = Column(Boolean, default=False)  # High-risk transactions

    # Metadata
    failure_reason = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    processed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint('amount > 0', name='positive_withdrawal_amount'),
    )
