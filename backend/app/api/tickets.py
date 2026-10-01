import secrets, hmac, hashlib, json, io, os, base64
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, extract_token
from app.models.user import User
from app.models.event import Event
from app.models.ticket_purchase import TicketPurchase
from app.models.wallet import Wallet, WalletTransaction, DEFAULT_BALANCES
from app.services.ticket_delivery import generate_ticket_qr, send_ticket_email, send_ticket_whatsapp, save_ticket_qr_image, build_ticket_pdf

router = APIRouter()


class PurchaseRequest(BaseModel):
    event_id: int
    buyer_name: str = Field(min_length=1)
    buyer_email: str = Field(min_length=1)
    buyer_phone: str | None = None
    quantity: int = Field(default=1, ge=1)
    payment_method: str = "paystack"
    package_name: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    try:
        token = extract_token(request)
        if not token:
            return None
        from jose import jwt, JWTError
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        result = await db.execute(select(User).where(User.id == int(user_id)))
        return result.scalar_one_or_none()
    except Exception:
        return None


@router.post("/purchase")
async def purchase_ticket(
    req: PurchaseRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == req.event_id, Event.is_public == True)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Determine price from pass_packages if provided
    pass_packages = event.pass_packages or []
    paid_packages = [p for p in pass_packages if p.get("name") and (p.get("price") or 0) and str(p.get("price")).strip() not in ("", "0", "0.0")]
    selected_package = None
    if req.package_name:
        selected_package = next((p for p in pass_packages if p.get("name") == req.package_name), None)
        if not selected_package:
            raise HTTPException(status_code=400, detail=f"Package '{req.package_name}' not found")
        package_price = selected_package.get("price", 0)
        try:
            package_price = float(package_price) if package_price not in (None, "") else 0
        except (TypeError, ValueError):
            package_price = 0
    elif paid_packages:
        raise HTTPException(status_code=400, detail="Please select a ticket package")
    else:
        package_price = event.ticket_price or 0

    is_free = not package_price or package_price == 0
    if not is_free and event.tickets_available is not None and event.tickets_available < req.quantity:
        raise HTTPException(status_code=400, detail="Not enough tickets available")

    # Per-package fixed charges (e.g. Black Market: General +250, Premium +2500).
    # Packages WITHOUT an explicit fee keep the legacy platform% + VAT math.
    package_fee = 0.0
    if selected_package is not None and selected_package.get("fee") not in (None, ""):
        try:
            package_fee = float(selected_package.get("fee") or 0)
        except (TypeError, ValueError):
            package_fee = 0.0

    base_amount = package_price * req.quantity
    if package_fee:
        platform_fee = round(package_fee * req.quantity)
        vat = 0
        total = base_amount + platform_fee
    else:
        platform_fee = round(base_amount * settings.PLATFORM_FEE_PERCENT / 100) if not is_free else 0
        vat = round(base_amount * settings.VAT_PERCENT / 100) if not is_free else 0
        total = base_amount + vat

    reference = f"TKT-{secrets.token_hex(8).upper()}"

    # Wallet payment for logged-in users
    if req.payment_method == "wallet":
        user = await get_optional_user(request, db)
        if not user:
            raise HTTPException(status_code=401, detail="Login required to pay with wallet")
        wallet_result = await db.execute(select(Wallet).where(Wallet.user_id == user.id))
        wallet = wallet_result.scalar_one_or_none()
        if not wallet:
            raise HTTPException(status_code=400, detail="Wallet not found")
        balances = dict(wallet.balances or DEFAULT_BALANCES)
        if (balances.get("NGN", 0)) < total:
            raise HTTPException(status_code=400, detail="Insufficient wallet balance")
        balances["NGN"] = balances.get("NGN", 0) - total
        wallet.balances = balances
        tx = WalletTransaction(
            wallet_id=wallet.id,
            amount=-total,
            currency="NGN",
            type="debit",
            reference=reference,
            description=f"Ticket purchase: {event.title} x{req.quantity}",
            status="completed",
        )
        db.add(tx)

        purchase = TicketPurchase(
            event_id=event.id,
            buyer_name=req.buyer_name,
            buyer_email=req.buyer_email,
            buyer_phone=req.buyer_phone,
            quantity=req.quantity,
            amount=total,
            platform_fee=platform_fee,
            vat=vat,
            reference=reference,
            status="completed",
            paid_at=datetime.now(timezone.utc),
            package_name=req.package_name,
            utm_source=req.utm_source,
            utm_medium=req.utm_medium,
            utm_campaign=req.utm_campaign,
        )
        db.add(purchase)
        await db.commit()
        await db.refresh(purchase)

        if event.tickets_available is not None:
            event.tickets_available -= req.quantity
            await db.commit()

        # Send ticket via email
        if purchase.buyer_email and event:
            try:
                # Read event cover image for styled QR
                image_data = None
                if event.cover_image:
                    try:
                        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
                        image_path = os.path.join(upload_dir, os.path.basename(event.cover_image))
                        if os.path.exists(image_path):
                            with open(image_path, 'rb') as f:
                                image_data = f.read()
                    except Exception:
                        pass

                qr_code = generate_ticket_qr(
                    ticket_reference=reference,
                    event_title=event.title,
                    event_date=str(event.event_date),
                    image_data=image_data,
                )
                flyer_url = None
                if event.cover_image:
                    flyer_url = (
                        event.cover_image
                        if str(event.cover_image).startswith("http")
                        else f"{settings.FRONTEND_URL.rstrip('/')}{event.cover_image}"
                    )
                is_black_market = event.title == "BLACK MARKET Movie World Record Attempt"
                pdf_bytes, pdf_filename = None, None
                if is_black_market:
                    pdf_bytes = build_ticket_pdf(
                        qr_code, purchase.buyer_name,
                        purchase.package_name or "General Access",
                        purchase.reference, event.title,
                    )
                    pdf_filename = f"BLACK-MARKET-QR-{purchase.reference}.pdf"
                await send_ticket_email(
                    buyer_email=purchase.buyer_email,
                    buyer_name=purchase.buyer_name,
                    event_title=event.title,
                    event_date=str(event.event_date),
                    event_time=str(event.event_time),
                    venue=event.venue,
                    ticket_reference=reference,
                    ticket_count=purchase.quantity,
                    amount_paid=purchase.amount,
                    qr_code_base64=qr_code,
                    template_type="black_market" if is_black_market else None,
                    package_name=purchase.package_name,
                    flyer_url=None if is_black_market else flyer_url,
                    qr_image_url=save_ticket_qr_image(qr_code, reference),
                    pdf_bytes=pdf_bytes,
                    pdf_filename=pdf_filename,
                )
            except Exception as e:
                print(f"Failed to send ticket email: {e}")

        # Send ticket via WhatsApp if phone provided
        if purchase.buyer_phone and event:
            try:
                await send_ticket_whatsapp(
                    buyer_phone=purchase.buyer_phone,
                    buyer_name=purchase.buyer_name,
                    ticket_reference=reference,
                    event_title=event.title,
                    event_date=str(event.event_date),
                )
            except Exception as e:
                print(f"Failed to send ticket WhatsApp: {e}")

        return {
            "purchase_id": purchase.id,
            "reference": reference,
            "amount": total,
            "base_amount": base_amount,
            "platform_fee": platform_fee,
            "vat": vat,
            "quantity": req.quantity,
            "authorization_url": None,
            "method": "wallet",
        }

    purchase = TicketPurchase(
        event_id=event.id,
        buyer_name=req.buyer_name,
        buyer_email=req.buyer_email,
        buyer_phone=req.buyer_phone,
        quantity=req.quantity,
        amount=total,
        platform_fee=platform_fee,
        vat=vat,
        reference=reference,
        status="completed" if is_free else "pending",
        paid_at=datetime.now(timezone.utc) if is_free else None,
        package_name=req.package_name,
        utm_source=req.utm_source,
        utm_medium=req.utm_medium,
        utm_campaign=req.utm_campaign,
    )
    db.add(purchase)
    await db.commit()
    await db.refresh(purchase)

    if is_free:
        # Send free event ticket via email
        if purchase.buyer_email and event:
            try:
                # Read event cover image for styled QR
                image_data = None
                if event.cover_image:
                    try:
                        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
                        image_path = os.path.join(upload_dir, os.path.basename(event.cover_image))
                        if os.path.exists(image_path):
                            with open(image_path, 'rb') as f:
                                image_data = f.read()
                    except Exception:
                        pass

                qr_code = generate_ticket_qr(
                    ticket_reference=reference,
                    event_title=event.title,
                    event_date=str(event.event_date),
                    image_data=image_data,
                )
                flyer_url = None
                if event.cover_image:
                    flyer_url = (
                        event.cover_image
                        if str(event.cover_image).startswith("http")
                        else f"{settings.FRONTEND_URL.rstrip('/')}{event.cover_image}"
                    )
                is_black_market = event.title == "BLACK MARKET Movie World Record Attempt"
                pdf_bytes, pdf_filename = None, None
                if is_black_market:
                    pdf_bytes = build_ticket_pdf(
                        qr_code, purchase.buyer_name,
                        purchase.package_name or "General Access",
                        purchase.reference, event.title,
                    )
                    pdf_filename = f"BLACK-MARKET-QR-{purchase.reference}.pdf"
                await send_ticket_email(
                    buyer_email=purchase.buyer_email,
                    buyer_name=purchase.buyer_name,
                    event_title=event.title,
                    event_date=str(event.event_date),
                    event_time=str(event.event_time),
                    venue=event.venue,
                    ticket_reference=reference,
                    ticket_count=purchase.quantity,
                    amount_paid=0,
                    qr_code_base64=qr_code,
                    template_type="black_market" if is_black_market else None,
                    package_name=purchase.package_name,
                    flyer_url=None if is_black_market else flyer_url,
                    qr_image_url=save_ticket_qr_image(qr_code, reference),
                    pdf_bytes=pdf_bytes,
                    pdf_filename=pdf_filename,
                )
            except Exception as e:
                print(f"Failed to send free ticket email: {e}")

        # Send free event ticket via WhatsApp if phone provided
        if purchase.buyer_phone and event:
            try:
                await send_ticket_whatsapp(
                    buyer_phone=purchase.buyer_phone,
                    buyer_name=purchase.buyer_name,
                    ticket_reference=reference,
                    event_title=event.title,
                    event_date=str(event.event_date),
                )
            except Exception as e:
                print(f"Failed to send free ticket WhatsApp: {e}")

        return {
            "purchase_id": purchase.id,
            "reference": reference,
            "amount": 0,
            "base_amount": 0,
            "platform_fee": 0,
            "vat": 0,
            "quantity": req.quantity,
            "authorization_url": None,
        }

    paystack_url = None
    buyer_user = await get_optional_user(request, db)
    paystack_secret = settings.paystack_secret_key(buyer_user.email if buyer_user else None)
    if paystack_secret:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    json={
                        "email": req.buyer_email,
                        "amount": int(total * 100),
                        "reference": reference,
                        "callback_url": f"{settings.FRONTEND_URL}/events/{event.id}?purchase={reference}",
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

    return {
        "purchase_id": purchase.id,
        "reference": reference,
        "amount": total,
        "base_amount": base_amount,
        "platform_fee": platform_fee,
        "vat": vat,
        "quantity": req.quantity,
        "authorization_url": paystack_url,
        "method": "paystack",
    }


@router.post("/purchase-webhook")
async def purchase_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.body()
    payload = json.loads(body)

    signature = request.headers.get("x-paystack-signature", "")
    if not settings.paystack_signature_valid(body, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    if payload.get("event") != "charge.success":
        return {"status": "ignored"}

    data = payload.get("data", {})
    if data.get("status") != "success":
        return {"status": "ignored"}

    reference = data.get("reference")
    result = await db.execute(
        select(TicketPurchase).where(TicketPurchase.reference == reference)
    )
    purchase = result.scalar_one_or_none()
    if purchase:
        from app.services.ticket_fulfillment import fulfill_ticket_purchase
        await fulfill_ticket_purchase(db, purchase)
        return {"status": "ok"}

    from app.services.ticket_fulfillment import credit_wallet_payment
    await credit_wallet_payment(db, reference)
    return {"status": "ok"}


@router.get("/purchases/{reference}")
async def get_purchase_status(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketPurchase).where(TicketPurchase.reference == reference)
    )
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return purchase


@router.post("/purchase/verify/{reference}")
async def verify_purchase(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketPurchase).where(TicketPurchase.reference == reference)
    )
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    if purchase.status == "completed":
        return {"status": "completed", "reference": reference}

    # Confirm with Paystack that the charge really succeeded before fulfilling.
    # Try live key first, then test key (owner test payments).
    paystack_success = False
    tried_keys = []
    for key in dict.fromkeys(
        [
            settings.PAYSTACK_SECRET_KEY,
            settings.PAYSTACK_TEST_SECRET_KEY,
        ]
    ):
        if not key or key in tried_keys:
            continue
        tried_keys.append(key)
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.paystack.co/transaction/verify/{reference}",
                    headers={"Authorization": f"Bearer {key}"},
                )
                data = resp.json()
        except Exception:
            data = {}
        if (
            data.get("status")
            and data.get("data", {}).get("status") == "success"
            and data.get("data", {}).get("reference") == reference
        ):
            paystack_success = True
            break

    if paystack_success:
        from app.services.ticket_fulfillment import fulfill_ticket_purchase
        await fulfill_ticket_purchase(db, purchase)
        return {"status": "completed", "reference": reference}

    return {"status": "pending", "reference": reference}


@router.get("/purchases/{reference}/ticket")
async def get_ticket(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketPurchase).where(TicketPurchase.reference == reference)
    )
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    event_result = await db.execute(select(Event).where(Event.id == purchase.event_id))
    event = event_result.scalar_one_or_none()

    return {
        "reference": purchase.reference,
        "status": purchase.status,
        "buyer_name": purchase.buyer_name,
        "buyer_email": purchase.buyer_email,
        "buyer_phone": purchase.buyer_phone,
        "quantity": purchase.quantity,
        "amount": purchase.amount,
        "package_name": purchase.package_name,
        "paid_at": purchase.paid_at,
        "event": {
            "id": event.id,
            "title": event.title,
            "event_date": str(event.event_date),
            "event_time": str(event.event_time),
            "venue": event.venue,
            "host_name": event.host_name,
        },
    }


@router.post("/verify")
async def verify_ticket_qr(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body = await request.json()
    ref = body.get("reference")
    if not ref:
        raise HTTPException(status_code=400, detail="Missing reference")

    result = await db.execute(
        select(TicketPurchase).where(TicketPurchase.reference == ref)
    )
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Invalid ticket")
    if purchase.status != "completed":
        raise HTTPException(status_code=400, detail="Ticket not paid")

    return {
        "valid": True,
        "buyer_name": purchase.buyer_name,
        "quantity": purchase.quantity,
        "event_id": purchase.event_id,
    }


@router.get("/purchases/{reference}/qr-image")
async def ticket_qr_image(
    reference: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TicketPurchase).where(TicketPurchase.reference == reference)
    )
    purchase = result.scalar_one_or_none()
    if not purchase or purchase.status != "completed":
        raise HTTPException(status_code=404, detail="Ticket not found or not paid")

    event_result = await db.execute(select(Event).where(Event.id == purchase.event_id))
    event = event_result.scalar_one_or_none()

    # Same canonical payload as the emailed QR: the public ticket URL, so a
    # phone-camera scan opens the ticket page with the guest details.
    qr_b64 = generate_ticket_qr(
        ticket_reference=purchase.reference,
        event_title=event.title if event else "",
        event_date=str(event.event_date) if event else "",
    )
    buf = io.BytesIO(base64.b64decode(qr_b64))
    return Response(content=buf.getvalue(), media_type="image/png")


@router.post("/purchases/{reference}/resend-qr")
async def resend_ticket_qr(
    reference: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Organizer fallback: resend ticket QR via email/WhatsApp."""
    result = await db.execute(select(TicketPurchase).where(TicketPurchase.reference == reference))
    purchase = result.scalar_one_or_none()
    if not purchase or purchase.status != "completed":
        raise HTTPException(status_code=404, detail="Purchase not found or not completed")

    event_result = await db.execute(select(Event).where(Event.id == purchase.event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Verify organizer access
    user = await get_optional_user(request, db)
    if not user or event.organizer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    image_data = None
    if event.cover_image:
        try:
            upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
            image_path = os.path.join(upload_dir, os.path.basename(event.cover_image))
            if os.path.exists(image_path):
                with open(image_path, "rb") as f:
                    image_data = f.read()
        except Exception:
            pass

    qr_code = generate_ticket_qr(
        ticket_reference=purchase.reference,
        event_title=event.title,
        event_date=str(event.event_date),
        image_data=image_data,
    )

    # Determine if this is a Black Market event
    is_black_market = event.title == "BLACK MARKET Movie World Record Attempt"
    template_type = "black_market" if is_black_market else None
    flyer_url = None
    if event.cover_image:
        flyer_url = (
            event.cover_image
            if str(event.cover_image).startswith("http")
            else f"{settings.FRONTEND_URL.rstrip('/')}{event.cover_image}"
        )
    pdf_bytes, pdf_filename = None, None
    if is_black_market:
        pdf_bytes = build_ticket_pdf(
            qr_code, purchase.buyer_name,
            purchase.package_name or "General Access",
            purchase.reference, event.title,
        )
        pdf_filename = f"BLACK-MARKET-QR-{purchase.reference}.pdf"

    await send_ticket_email(
        buyer_email=purchase.buyer_email,
        buyer_name=purchase.buyer_name,
        event_title=event.title,
        event_date=str(event.event_date),
        event_time=str(event.event_time),
        venue=event.venue,
        ticket_reference=purchase.reference,
        ticket_count=purchase.quantity,
        amount_paid=purchase.amount,
        qr_code_base64=qr_code,
        template_type=template_type,
        package_name=purchase.package_name,
        flyer_url=None if is_black_market else flyer_url,
        qr_image_url=save_ticket_qr_image(qr_code, purchase.reference),
        pdf_bytes=pdf_bytes,
        pdf_filename=pdf_filename,
    )

    return {"status": "ok", "message": f"QR resent to {purchase.buyer_email}"}


@router.get("/events/{event_id}/purchases")
async def list_event_purchases(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(TicketPurchase).where(
            TicketPurchase.event_id == event_id,
            TicketPurchase.status == "completed",
        ).order_by(TicketPurchase.created_at.desc())
    )
    return result.scalars().all()
