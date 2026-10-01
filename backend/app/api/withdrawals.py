"""Withdrawal management with anti-money laundering controls"""

import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.wallet import Wallet, BankAccount, Withdrawal, WalletTransaction, SUPPORTED_CURRENCIES
from app.lib.aml import check_aml_risks

router = APIRouter()


# ─── Data Models ───

class BankAccountCreate(BaseModel):
    account_holder_name: str
    account_number: str
    bank_name: str
    bank_code: Optional[str] = None
    country_code: str  # NG, GH, KE, ZA, etc.
    currency: str  # NGN, USD, GHS, etc.


class BankAccountResponse(BaseModel):
    id: int
    account_holder_name: str
    account_number: str  # Only show last 4 digits
    bank_name: str
    country_code: str
    currency: str
    is_verified: bool
    is_primary: bool
    created_at: datetime

    class Config:
        from_attributes = True

    @property
    def masked_account_number(self):
        """Return masked account number (show last 4 digits only)"""
        return f"****{self.account_number[-4:]}" if len(self.account_number) > 4 else "****"


class WithdrawalRequest(BaseModel):
    bank_account_id: int
    amount: float
    currency: Optional[str] = None
    description: Optional[str] = None


class WithdrawalResponse(BaseModel):
    id: int
    reference: str
    amount: float
    currency: str
    status: str
    is_aml_flagged: bool
    requires_verification: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Bank Account Endpoints ───

@router.post("/bank-accounts/add")
async def add_bank_account(
    req: BankAccountCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new bank account (with AML name verification)"""

    # ✅ AML Check: Account holder name must match user's full_name
    if req.account_holder_name.lower().strip() != user.full_name.lower().strip():
        raise HTTPException(
            status_code=400,
            detail="Account holder name must match your full name exactly. This is required by law to prevent money laundering.",
        )

    # ✅ Verify currency is supported
    if req.currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")

    # ✅ Check if account already exists
    existing = await db.execute(
        select(BankAccount).where(
            BankAccount.user_id == user.id,
            BankAccount.account_number == req.account_number,
            BankAccount.bank_code == req.bank_code,
        )
    )

    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="This bank account is already linked")

    # ✅ Account number validation (basic checks)
    if len(req.account_number) < 8 or len(req.account_number) > 20:
        raise HTTPException(status_code=400, detail="Invalid account number format")

    # Create bank account
    bank_account = BankAccount(
        user_id=user.id,
        account_holder_name=req.account_holder_name,
        account_number=req.account_number,
        bank_name=req.bank_name,
        bank_code=req.bank_code,
        country_code=req.country_code,
        currency=req.currency,
        is_verified=False,
    )

    db.add(bank_account)
    await db.commit()
    await db.refresh(bank_account)

    return {
        "id": bank_account.id,
        "status": "pending_verification",
        "message": "Bank account added. You can use this for withdrawals.",
        "masked_account": f"****{req.account_number[-4:]}",
    }


@router.get("/bank-accounts")
async def list_bank_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all bank accounts linked to user"""
    result = await db.execute(
        select(BankAccount).where(BankAccount.user_id == user.id)
    )
    accounts = result.scalars().all()

    return [
        {
            "id": acc.id,
            "bank_name": acc.bank_name,
            "country_code": acc.country_code,
            "currency": acc.currency,
            "masked_account": f"****{acc.account_number[-4:]}",
            "is_verified": acc.is_verified,
            "is_primary": acc.is_primary,
            "created_at": acc.created_at,
        }
        for acc in accounts
    ]


@router.delete("/bank-accounts/{account_id}")
async def delete_bank_account(
    account_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a bank account"""
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            BankAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()

    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    await db.delete(account)
    await db.commit()

    return {"status": "deleted"}


# ─── Withdrawal Endpoints ───

@router.post("/withdrawals/request")
async def request_withdrawal(
    req: WithdrawalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a withdrawal to a bank account (with AML checks)"""

    # ✅ Verify bank account exists and belongs to user
    bank_result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == req.bank_account_id,
            BankAccount.user_id == user.id,
        )
    )
    bank_account = bank_result.scalar_one_or_none()

    if not bank_account:
        raise HTTPException(status_code=404, detail="Bank account not found")

    # ✅ Verify wallet exists
    wallet_result = await db.execute(
        select(Wallet).where(
            Wallet.user_id == user.id,
            Wallet.currency == bank_account.currency,
        )
    )
    wallet = wallet_result.scalar_one_or_none()

    if not wallet:
        raise HTTPException(
            status_code=400,
            detail=f"You don't have a {bank_account.currency} wallet",
        )

    # ✅ Check balance (multi-currency via balances JSON)
    balances = dict(wallet.balances or {})
    currency_balance = balances.get(bank_account.currency, 0.0)
    if currency_balance < req.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. You have {currency_balance} {bank_account.currency}",
        )

    # ✅ AML Check: Minimum withdrawal amount
    min_withdrawal = 1000 if wallet.currency == "NGN" else 10
    if req.amount < min_withdrawal:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum withdrawal is {min_withdrawal} {wallet.currency}",
        )

    # ✅ AML Check: Daily withdrawal limit
    today = datetime.utcnow().date()
    daily_total = await db.execute(
        select(func.sum(Withdrawal.amount)).where(
            Withdrawal.user_id == user.id,
            Withdrawal.currency == wallet.currency,
            func.date(Withdrawal.created_at) == today,
            Withdrawal.status != "failed",
        )
    )
    today_total = daily_total.scalar() or 0
    daily_limit = 5000000 if wallet.currency == "NGN" else 50000

    if today_total + req.amount > daily_limit:
        remaining = daily_limit - today_total
        raise HTTPException(
            status_code=400,
            detail=f"Daily limit exceeded. You can withdraw {remaining} {wallet.currency} more today",
        )

    # ✅ AML Check: Velocity checks (multiple withdrawals in short time)
    recent_count = await db.execute(
        select(func.count(Withdrawal.id)).where(
            Withdrawal.user_id == user.id,
            Withdrawal.created_at >= datetime.now(timezone.utc) - timedelta(hours=1),
            Withdrawal.status != "failed",
        )
    )

    if recent_count.scalar() > 5:
        raise HTTPException(
            status_code=429,
            detail="Too many withdrawal requests. Please try again later.",
        )

    # ✅ Run comprehensive AML checks
    aml_result = check_aml_risks(
        user=user,
        amount=req.amount,
        currency=wallet.currency,
        bank_account=bank_account,
    )

    # Create withdrawal
    reference = f"WTH-{secrets.token_hex(8).upper()}"
    withdrawal = Withdrawal(
        user_id=user.id,
        wallet_id=wallet.id,
        bank_account_id=bank_account.id,
        amount=req.amount,
        currency=wallet.currency,
        reference=reference,
        status="pending",
        is_aml_flagged=aml_result["is_flagged"],
        aml_reason=aml_result.get("reason"),
        requires_verification=aml_result["requires_verification"],
        description=req.description,
        daily_withdrawal_total=today_total + req.amount,
    )

    db.add(withdrawal)

    # Create wallet transaction record for history
    tx = WalletTransaction(
        wallet_id=wallet.id,
        amount=-req.amount,
        currency=wallet.currency,
        type="debit",
        reference=reference,
        description=f"Withdrawal to {bank_account.bank_name} (****{bank_account.account_number[-4:]})",
        status="completed",
    )
    db.add(tx)

    # Deduct from wallet immediately (will be refunded if withdrawal fails)
    currency = bank_account.currency
    balances[currency] = balances.get(currency, 0.0) - req.amount
    wallet.balances = balances
    wallet.balance = balances.get(currency, 0.0)
    db.add(wallet)

    await db.commit()
    await db.refresh(withdrawal)

    return {
        "id": withdrawal.id,
        "reference": withdrawal.reference,
        "amount": withdrawal.amount,
        "currency": withdrawal.currency,
        "status": "pending",
        "is_aml_flagged": withdrawal.is_aml_flagged,
        "aml_reason": withdrawal.aml_reason,
        "requires_verification": withdrawal.requires_verification,
        "message": "Withdrawal request created. Processing may take 1-3 business days.",
    }


@router.get("/withdrawals")
async def list_withdrawals(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get withdrawal history"""
    result = await db.execute(
        select(Withdrawal)
        .where(Withdrawal.user_id == user.id)
        .order_by(Withdrawal.created_at.desc())
        .limit(50)
    )

    withdrawals = result.scalars().all()

    return [
        {
            "id": w.id,
            "reference": w.reference,
            "amount": w.amount,
            "currency": w.currency,
            "status": w.status,
            "is_aml_flagged": w.is_aml_flagged,
            "created_at": w.created_at,
            "processed_at": w.processed_at,
        }
        for w in withdrawals
    ]


@router.get("/withdrawals/{reference}")
async def get_withdrawal_status(
    reference: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check withdrawal status by reference"""
    result = await db.execute(
        select(Withdrawal).where(
            Withdrawal.reference == reference,
            Withdrawal.user_id == user.id,
        )
    )

    withdrawal = result.scalar_one_or_none()

    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    return {
        "reference": withdrawal.reference,
        "amount": withdrawal.amount,
        "currency": withdrawal.currency,
        "status": withdrawal.status,
        "created_at": withdrawal.created_at,
        "processed_at": withdrawal.processed_at,
    }
