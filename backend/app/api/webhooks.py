import json, logging, hmac, hashlib
from fastapi import APIRouter, Depends, Request, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.config import settings
from app.models.invite import InviteMessage
from app.models.ticket_purchase import TicketPurchase
from app.services.webhook_security import WebhookSecurityService
from app.services.audit import AuditService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/webhooks/whatsapp/status")
async def whatsapp_webhook_verify(req: Request):
    mode = req.query_params.get("hub.mode")
    token = req.query_params.get("hub.verify_token")
    challenge = req.query_params.get("hub.challenge")
    logger.info(f"Webhook verify: mode={mode}, token={token}, challenge={challenge}")
    if mode == "subscribe" and token == settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        return Response(content=challenge, media_type="text/plain")
    logger.warning(f"Webhook verification failed: mode={mode}, token={token}")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhooks/whatsapp/status")
async def whatsapp_webhook(req: Request, db: AsyncSession = Depends(get_db)):
    body = await req.json()
    payload = json.dumps(body)

    entry = body.get("entry", [])
    for e in entry:
        changes = e.get("changes", [])
        for c in changes:
            value = c.get("value", {})

            # Handle status updates (delivery receipts)
            for s in value.get("statuses", []):
                message_id = s.get("id")
                status = s.get("status")
                if not message_id:
                    continue
                result = await db.execute(
                    select(InviteMessage).where(
                        InviteMessage.provider_message_id == message_id
                    )
                )
                msg = result.scalar_one_or_none()
                if msg:
                    if status in ("delivered", "sent"):
                        msg.delivered_at = datetime.now(timezone.utc)
                    elif status == "read":
                        msg.opened_at = datetime.now(timezone.utc)
                    elif status == "failed":
                        msg.status = "failed"
                        msg.error = s.get("errors", [{}])[0].get("title", "Delivery failed")
                    if status in ("delivered", "sent", "read"):
                        msg.status = status
                    msg.webhook_payload = payload[:500]
                    await db.commit()

            # Handle incoming messages (e.g. replies from guests)
            for m in value.get("messages", []):
                from_number = m.get("from", "")
                msg_type = m.get("type", "")
                msg_id = m.get("id", "")
                text_body = ""
                if msg_type == "text":
                    text_body = m.get("text", {}).get("body", "")
                logger.info(f"Incoming WhatsApp from {from_number}: {text_body[:100]}")
                # TODO: store incoming messages or trigger auto-reply

    return {"status": "ok"}


@router.post("/webhooks/twilio/status")
async def twilio_status_webhook(req: Request, db: AsyncSession = Depends(get_db)):
    form = await req.form()
    payload = dict(form)
    message_sid = payload.get("MessageSid", "")
    status = payload.get("MessageStatus", "")
    if message_sid:
        result = await db.execute(
            select(InviteMessage).where(InviteMessage.provider_message_id == message_sid)
        )
        msg = result.scalar_one_or_none()
        if msg:
            if status in ("delivered", "sent", "read"):
                msg.status = status
                if status in ("delivered", "sent"):
                    msg.delivered_at = datetime.now(timezone.utc)
            elif status in ("failed", "undelivered"):
                msg.status = "failed"
                error_code = payload.get("ErrorCode", "")
                error_msg = payload.get("ErrorMessage", "")
                msg.error = f"Twilio {status}: {error_code} {error_msg}".strip() or "Delivery failed"
            msg.webhook_payload = json.dumps(payload)[:500]
            await db.commit()
    return ""


@router.post("/webhooks/paystack")
async def paystack_webhook(req: Request, db: AsyncSession = Depends(get_db)):
    """
    SECURITY: Paystack webhook handler with signature verification
    Verifies webhook is from Paystack before processing payment events
    """
    body = await req.body()

    try:
        # SECURITY: Verify Paystack signature (accepts live or test key)
        signature = req.headers.get("x-paystack-signature", "")
        if not settings.paystack_signature_valid(body, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
        data = json.loads(body)

        event = data.get("event")
        payment_data = data.get("data", {})
        reference = payment_data.get("reference")

        logger.info(f"Valid Paystack webhook: {event} for reference {reference}")

        # Log webhook received
        await AuditService.log_event(
            db=db,
            user_id=None,
            action=f"webhook_{event}",
            resource_type="payment",
            resource_id=None,
            request=req,
            description=f"Paystack {event}: {reference}",
        )

        # Handle specific payment events
        if event == "charge.success" and payment_data.get("status") == "success":
            from app.services.ticket_fulfillment import (
                fulfill_ticket_purchase,
                credit_wallet_payment,
            )

            # Ticket purchases use TKT- references; wallet funding uses WAL- references
            if reference and str(reference).startswith("WAL-"):
                await credit_wallet_payment(db, reference)
            elif reference:
                result = await db.execute(
                    select(TicketPurchase).where(TicketPurchase.reference == reference)
                )
                purchase = result.scalar_one_or_none()
                if purchase:
                    await fulfill_ticket_purchase(db, purchase)
                else:
                    logger.info(f"Paystack webhook: no ticket purchase found for {reference}")

        return {"status": "ok"}

    except HTTPException as e:
        logger.error(f"Paystack webhook verification failed: {e.detail}")
        raise
