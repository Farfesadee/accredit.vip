import secrets
import hmac
import hashlib
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import httpx

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, SUPPORTED_CURRENCIES, DEFAULT_BALANCES

router = APIRouter()


class FundRequest(BaseModel):
    amount: float
    currency: str = "NGN"
    provider: str = "paystack"


class WalletPayRequest(BaseModel):
    amount: float
    currency: str = "NGN"
    description: str


async def get_or_create_wallet(user: User, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.user_id == user.id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        wallet = Wallet(user_id=user.id, balance=0.0, balances=dict(DEFAULT_BALANCES))
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    elif not wallet.balances or wallet.balances == {}:
        wallet.balances = dict(DEFAULT_BALANCES)
        await db.commit()
        await db.refresh(wallet)
    return wallet


@router.get("/wallet/currencies")
async def list_currencies():
    return SUPPORTED_CURRENCIES


@router.get("/wallet")
async def get_wallet(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wallet = await get_or_create_wallet(user, db)
    txns = await db.execute(
        select(WalletTransaction).where(
            WalletTransaction.wallet_id == wallet.id
        ).order_by(WalletTransaction.created_at.desc()).limit(50)
    )
    tx_list = txns.scalars().all()
    # Ticket-sale credits (SALE-{purchase_ref}) carry the buyer's details so
    # the wallet receipt can show Name / Email / Phone.
    buyers: dict = {}
    sale_refs = [
        (t.reference or "")[5:]
        for t in tx_list
        if (t.reference or "").startswith("SALE-")
    ]
    if sale_refs:
        from app.models.ticket_purchase import TicketPurchase

        pres = await db.execute(
            select(TicketPurchase).where(TicketPurchase.reference.in_(sale_refs))
        )
        buyers = {p.reference: p for p in pres.scalars().all()}
    transactions = []
    for t in tx_list:
        p = buyers.get((t.reference or "")[5:] if (t.reference or "").startswith("SALE-") else "")
        transactions.append(
            {
                "id": t.id,
                "amount": t.amount,
                "currency": t.currency,
                "type": t.type,
                "reference": t.reference,
                "description": t.description,
                "status": t.status,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "buyer_name": p.buyer_name if p else None,
                "buyer_email": p.buyer_email if p else None,
                "buyer_phone": p.buyer_phone if p else None,
            }
        )
    return {
        "id": wallet.id,
        "balance": wallet.balance,
        "currency": wallet.currency,
        "balances": wallet.balances or DEFAULT_BALANCES,
        "transactions": transactions,
    }


@router.post("/wallet/fund")
async def fund_wallet(
    req: FundRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    currency = req.currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")

    min_fund = SUPPORTED_CURRENCIES[currency]["min_fund"]
    if req.amount < min_fund:
        raise HTTPException(status_code=400, detail=f"Minimum funding amount for {currency} is {SUPPORTED_CURRENCIES[currency]['symbol']}{min_fund}")

    wallet = await get_or_create_wallet(user, db)

    reference = f"WAL-{secrets.token_hex(8).upper()}"

    tx = WalletTransaction(
        wallet_id=wallet.id,
        amount=req.amount,
        currency=currency,
        type="credit",
        reference=reference,
        description=f"Wallet top-up ({currency})",
        status="pending",
    )
    db.add(tx)
    await db.commit()

    paystack_url = None
    flutterwave_url = None

    paystack_secret = settings.paystack_secret_key(user.email)
    if currency == "NGN" and paystack_secret:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    json={
                        "email": user.email,
                        "amount": int(req.amount * 100),
                        "reference": reference,
                        "callback_url": f"{settings.FRONTEND_URL}/dashboard/wallet?reference={reference}",
                        "currency": currency,
                    },
                    headers={
                        "Authorization": f"Bearer {paystack_secret}",
                        "Content-Type": "application/json",
                    },
                )
                data = resp.json()
                if data.get("status"):
                    paystack_url = data["data"]["authorization_url"]
        except Exception:
            pass

    if settings.FLUTTERWAVE_SECRET_KEY:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.flutterwave.com/v3/payments",
                    json={
                        "tx_ref": reference,
                        "amount": req.amount,
                        "currency": currency,
                        "redirect_url": f"{settings.FRONTEND_URL}/dashboard/wallet?reference={reference}",
                        "customer": {
                            "email": user.email,
                            "name": user.full_name or user.email,
                        },
                        "customizations": {
                            "title": "Wallet Top-Up",
                            "description": f"Funding {currency} wallet",
                        },
                    },
                    headers={
                        "Authorization": f"Bearer {settings.FLUTTERWAVE_SECRET_KEY}",
                        "Content-Type": "application/json",
                    },
                )
                data = resp.json()
                if data.get("status") == "success":
                    flutterwave_url = data["data"]["link"]
        except Exception:
            pass

    return {
        "reference": reference,
        "amount": req.amount,
        "currency": currency,
        "authorization_url": paystack_url or flutterwave_url,
    }


@router.post("/wallet/pay")
async def pay_with_wallet(
    req: WalletPayRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    currency = req.currency.upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {currency}")

    wallet = await get_or_create_wallet(user, db)
    balances = dict(wallet.balances or DEFAULT_BALANCES)
    current_balance = balances.get(currency, 0.0)

    if current_balance < req.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient {currency} balance")

    reference = f"WPD-{secrets.token_hex(8).upper()}"
    balances[currency] -= req.amount
    wallet.balances = balances

    tx = WalletTransaction(
        wallet_id=wallet.id,
        amount=-req.amount,
        currency=currency,
        type="debit",
        reference=reference,
        description=req.description,
        status="completed",
    )
    db.add(tx)
    await db.commit()

    return {
        "reference": reference,
        "amount": req.amount,
        "currency": currency,
        "balances": wallet.balances,
    }


@router.post("/wallet/webhook/{provider}")
async def wallet_webhook(
    provider: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    payload = json.loads(body)

    if provider == "paystack":
        signature = request.headers.get("x-paystack-signature", "")
        if not settings.paystack_signature_valid(body, signature):
            raise HTTPException(status_code=400, detail="Invalid signature")

        if payload.get("event") != "charge.success":
            return {"status": "ignored"}

        data = payload.get("data", {})
        if data.get("status") != "success":
            return {"status": "ignored"}

        reference = data.get("reference")
        if not reference or not reference.startswith("WAL-"):
            return {"status": "ignored"}

        result = await db.execute(
            select(WalletTransaction).where(WalletTransaction.reference == reference)
        )
        tx = result.scalar_one_or_none()
        if tx and tx.status == "pending":
            tx.status = "completed"

            wallet_result = await db.execute(
                select(Wallet).where(Wallet.id == tx.wallet_id)
            )
            wallet = wallet_result.scalar_one_or_none()
            if wallet:
                cur = tx.currency or "NGN"
                balances = dict(wallet.balances or DEFAULT_BALANCES)
                balances[cur] = balances.get(cur, 0.0) + tx.amount
                wallet.balances = balances
                wallet.balance = balances.get(cur, 0.0)

            await db.commit()

    elif provider == "flutterwave":
        secret_hash = settings.FLUTTERWAVE_SECRET_KEY
        if secret_hash:
            signature = request.headers.get("verif-hash", "")
            if not signature:
                raise HTTPException(status_code=400, detail="Missing signature")

        if payload.get("event") == "charge.completed" and payload.get("data", {}).get("status") == "successful":
            data = payload["data"]
            reference = data.get("tx_ref") or data.get("reference", "")
            if not reference.startswith("WAL-"):
                return {"status": "ignored"}

            result = await db.execute(
                select(WalletTransaction).where(WalletTransaction.reference == reference)
            )
            tx = result.scalar_one_or_none()
            if tx and tx.status == "pending":
                tx.status = "completed"

                wallet_result = await db.execute(
                    select(Wallet).where(Wallet.id == tx.wallet_id)
                )
                wallet = wallet_result.scalar_one_or_none()
                if wallet:
                    cur = tx.currency or "NGN"
                    balances = dict(wallet.balances or DEFAULT_BALANCES)
                    balances[cur] = balances.get(cur, 0.0) + tx.amount
                    wallet.balances = balances
                    wallet.balance = balances.get(cur, 0.0)

                await db.commit()

    return {"status": "ok"}


# ─── New Multi-Currency Wallet Endpoints ───

@router.get("/wallets")
async def list_wallets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all wallets for a user (one per currency)"""
    result = await db.execute(
        select(Wallet)
        .where(Wallet.user_id == user.id)
        .order_by(Wallet.is_primary.desc(), Wallet.created_at.asc())
    )
    wallets = result.scalars().all()

    return [
        {
            "id": w.id,
            "currency": w.currency,
            "balance": w.balance,
            "is_primary": w.is_primary,
            "created_at": w.created_at,
        }
        for w in wallets
    ]


@router.post("/wallets/create")
async def create_wallet(
    req: FundRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new wallet for a specific currency"""
    currency = req.currency.upper()

    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")

    # Check if wallet already exists
    existing = await db.execute(
        select(Wallet).where(
            Wallet.user_id == user.id,
            Wallet.currency == currency,
        )
    )

    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"You already have a {currency} wallet")

    # Determine if this should be primary
    existing_wallets = await db.execute(
        select(Wallet).where(Wallet.user_id == user.id)
    )
    is_primary = len(existing_wallets.scalars().all()) == 0

    # Create wallet
    wallet = Wallet(
        user_id=user.id,
        currency=currency,
        balance=0.0,
        is_primary=is_primary,
        balances=dict(DEFAULT_BALANCES),
    )

    db.add(wallet)
    await db.commit()
    await db.refresh(wallet)

    return {
        "id": wallet.id,
        "currency": wallet.currency,
        "balance": wallet.balance,
        "is_primary": wallet.is_primary,
        "message": f"{currency} wallet created successfully",
    }
