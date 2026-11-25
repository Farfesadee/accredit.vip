"""Reconcile pending Paystack purchases with Paystack and fulfill paid ones.

Paystack webhooks are not delivered to this VPS, and the browser callback only
runs when the buyer stays on the return page. This job is the safety net: every
few minutes it checks recent pending purchases directly against Paystack and
fulfills any that were actually paid (QR generation + email/WhatsApp delivery).

Run from cron on the VPS, from the backend directory:

    cd /var/www/accredit.vip/backend
    venv/bin/python3 app/jobs/reconcile_paystack.py

Safe to run repeatedly: fulfillment is a no-op for already completed purchases.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.event import Event
from app.models.ticket_purchase import TicketPurchase
from app.services.ticket_fulfillment import fulfill_ticket_purchase

# Ignore checkouts that are still in flight, and do not query ancient abandoned
# ones on every run.
MIN_AGE_MINUTES = 2
LOOKBACK_DAYS = 7


def candidate_keys(event: Event | None) -> list[str]:
    """Same key order as POST /tickets/purchase/verify/{reference}."""
    keys = [settings.PAYSTACK_SECRET_KEY, settings.PAYSTACK_TEST_SECRET_KEY]
    if event and event.id == 105:
        if settings.PAYSTACK_EVENT_105_SECRET_KEY:
            keys.insert(0, settings.PAYSTACK_EVENT_105_SECRET_KEY)
        if settings.PAYSTACK_EVENT_105_TEST_SECRET_KEY:
            keys.insert(1, settings.PAYSTACK_EVENT_105_TEST_SECRET_KEY)
    return [key for key in dict.fromkeys(keys) if key]


async def paystack_paid(reference: str, event: Event | None, client: httpx.AsyncClient) -> bool:
    for key in candidate_keys(event):
        try:
            resp = await client.get(
                f"https://api.paystack.co/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {key}"},
                timeout=15,
            )
            data = resp.json()
        except Exception as exc:
            print(f"[reconcile] verify {reference} with a key failed: {type(exc).__name__}")
            continue
        if (
            data.get("status")
            and data.get("data", {}).get("status") == "success"
            and data.get("data", {}).get("reference") == reference
        ):
            return True
    return False


async def reconcile() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=MIN_AGE_MINUTES)
    start = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

    async with async_session() as db:
        result = await db.execute(
            select(TicketPurchase)
            .where(
                TicketPurchase.status == "pending",
                TicketPurchase.created_at >= start,
                TicketPurchase.created_at <= cutoff,
            )
            .order_by(TicketPurchase.created_at)
        )
        purchases = result.scalars().all()
        if not purchases:
            print("[reconcile] no pending purchases to check")
            return

        print(f"[reconcile] checking {len(purchases)} pending purchase(s)")
        async with httpx.AsyncClient() as client:
            for purchase in purchases:
                event_result = await db.execute(
                    select(Event).where(Event.id == purchase.event_id)
                )
                event = event_result.scalar_one_or_none()
                try:
                    paid = await paystack_paid(purchase.reference, event, client)
                except Exception as exc:
                    print(f"[reconcile] {purchase.reference}: verify error {type(exc).__name__}")
                    continue
                if not paid:
                    print(f"[reconcile] {purchase.reference}: not paid yet")
                    continue
                try:
                    await fulfill_ticket_purchase(db, purchase)
                    print(
                        f"[reconcile] {purchase.reference}: PAID - fulfilled "
                        f"({purchase.buyer_email})"
                    )
                except Exception as exc:
                    print(f"[reconcile] {purchase.reference}: fulfillment failed: {exc}")


if __name__ == "__main__":
    asyncio.run(reconcile())
