"""Ticket fulfillment service - marks purchases completed, sends tickets via email/WhatsApp"""

import os
import base64
import asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.ticket_purchase import TicketPurchase
from app.models.event import Event
from app.models.guest import Guest
from app.models.qr_code import QRCode
from app.services.ticket_delivery import (
    generate_ticket_qr,
    save_ticket_qr_image,
    send_ticket_email,
    send_ticket_whatsapp,
    build_ticket_pdf,
    build_warri_ticket_pdf,
)


async def fulfill_ticket_purchase(db: AsyncSession, purchase: TicketPurchase) -> None:
    """Mark a pending purchase completed, decrement availability, and send the ticket.

    Safe to call with an already-completed purchase (no-op).
    """
    if purchase.status == "completed":
        return

    purchase.status = "completed"
    purchase.paid_at = datetime.now(timezone.utc)

    event_result = await db.execute(select(Event).where(Event.id == purchase.event_id))
    event = event_result.scalar_one_or_none()
    if event and event.tickets_available is not None:
        event.tickets_available -= purchase.quantity

    await db.commit()

    if not event:
        return

    # Register the buyer as an event guest so the accreditation scanner
    # (/accreditation) can validate and check in the ticket. The stored
    # QRCode token is the purchase reference, which the scanner resolves
    # from the ticket URL's last segment. Reuse an existing guest row for
    # the same email so re-fulfillment never duplicates.
    try:
        g_result = await db.execute(
            select(Guest).where(
                Guest.event_id == purchase.event_id,
                Guest.email == purchase.buyer_email,
            )
        )
        guest = g_result.scalar_one_or_none()
        if not guest:
            guest = Guest(
                event_id=purchase.event_id,
                name=purchase.buyer_name,
                email=purchase.buyer_email,
                phone=purchase.buyer_phone,
                rsvp_status="accepted",
                invited_by="Ticket Purchase",
                custom_data={
                    "source": "ticket_purchase",
                    "reference": purchase.reference,
                    "package": purchase.package_name,
                    "quantity": purchase.quantity,
                    "amount": purchase.amount,
                },
            )
            db.add(guest)
            await db.flush()
        
        # Generate QR codes for each ticket (quantity > 1)
        qty = max(1, int(purchase.quantity or 1))
        qr_codes = []
        qr_image_urls = []
        qr_tokens = []

        for i in range(1, qty + 1):
            token = f"{purchase.reference}-{i}" if qty > 1 else purchase.reference
            qr_code = generate_ticket_qr(
                ticket_reference=token,
                event_title=event.title,
                event_date=str(event.event_date),
                image_data=None,  # Image will be embedded by generate_ticket_qr if needed
            )
            from app.services.ticket_delivery import save_ticket_qr_image
            qr_image_url = save_ticket_qr_image(qr_code, f"{purchase.reference}-{i}" if qty > 1 else purchase.reference)
            qr_codes.append(qr_code)
            qr_image_urls.append(qr_image_url)
            qr_tokens.append(token)

            # Create QRCode entry for each ticket
            qr_result = await db.execute(
                select(QRCode).where(QRCode.token == token)
            )
            if not qr_result.scalar_one_or_none():
                db.add(
                    QRCode(
                        guest_id=guest.id,
                        event_id=purchase.event_id,
                        token=token,
                    )
                )
        await db.commit()
    except Exception as e:
        print(f"Failed to register ticket guest: {e}")

    # Credit the event organizer's wallet so ticket sales show in their
    # wallet history (dashboard + report). Idempotent: fulfill() no-ops on
    # already-completed purchases, so webhook retries never double-credit.
    try:
        from app.models.wallet import Wallet, WalletTransaction, DEFAULT_BALANCES

        w_result = await db.execute(
            select(Wallet).where(Wallet.user_id == event.organizer_id)
        )
        wallet = w_result.scalar_one_or_none()
        if not wallet:
            wallet = Wallet(
                user_id=event.organizer_id, balance=0.0,
                balances=dict(DEFAULT_BALANCES),
            )
            db.add(wallet)
            await db.flush()
        balances = dict(wallet.balances or DEFAULT_BALANCES)
        balances["NGN"] = balances.get("NGN", 0.0) + float(purchase.amount or 0)
        wallet.balances = balances
        sale_ref = f"SALE-{purchase.reference}"
        existing_tx = await db.execute(
            select(WalletTransaction).where(WalletTransaction.reference == sale_ref)
        )
        if not existing_tx.scalar_one_or_none():
            db.add(
                WalletTransaction(
                    wallet_id=wallet.id,
                    amount=float(purchase.amount or 0),
                    currency="NGN",
                    type="credit",
                    reference=sale_ref,
                    description=(
                        f"Ticket sale: {event.title} x{purchase.quantity} "
                        f"({purchase.package_name or 'Standard'}) - {purchase.buyer_name}"
                    ),
                    status="completed",
                )
            )
        await db.commit()
    except Exception as e:
        print(f"Failed to credit organizer wallet: {e}")

    # Send ticket via email
    if purchase.buyer_email:
        try:
            upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
            image_data = None
            if event.cover_image:
                try:
                    image_path = os.path.join(upload_dir, os.path.basename(event.cover_image))
                    if os.path.exists(image_path):
                        with open(image_path, "rb") as f:
                            image_data = f.read()
                except Exception:
                    pass

            # Generate QR codes for each ticket (quantity > 1)
            qty = max(1, int(purchase.quantity or 1))
            qr_codes = []
            qr_image_urls = []
            qr_tokens = []

            for i in range(1, qty + 1):
                token = f"{purchase.reference}-{i}" if qty > 1 else purchase.reference
                qr_code = generate_ticket_qr(
                    ticket_reference=token,
                    event_title=event.title,
                    event_date=str(event.event_date),
                    image_data=image_data,
                )
                from app.services.ticket_delivery import save_ticket_qr_image
                qr_image_url = save_ticket_qr_image(qr_code, token)
                qr_codes.append(qr_code)
                qr_image_urls.append(qr_image_url)
                qr_tokens.append(token)

                # Create QRCode entry for each ticket
                qr_result = await db.execute(
                    select(QRCode).where(QRCode.token == token)
                )
                if not qr_result.scalar_one_or_none():
                    db.add(
                        QRCode(
                            guest_id=guest.id,
                            event_id=purchase.event_id,
                            token=token,
                        )
                    )
            await db.commit()

            # Determine if this is a Black Market event with pass_packages
            is_black_market = event.title == "BLACK MARKET Movie World Record Attempt"
            template_type = "black_market" if is_black_market else None

            flyer_url = None
            if event.cover_image:
                flyer_url = (
                    event.cover_image
                    if str(event.cover_image).startswith("http")
                    else f"{settings.FRONTEND_URL.rstrip('/')}{event.cover_image}"
                )

            # QR as a PDF attachment on Black Market emails (client design).
            pdf_bytes, pdf_filename = None, None
            if is_black_market:
                from app.services.ticket_delivery import build_ticket_pdf

                pdf_bytes = build_ticket_pdf(
                    qr_codes[0],
                    purchase.buyer_name,
                    purchase.package_name or "General Access",
                    purchase.reference,
                    event.title,
                )
                pdf_filename = f"BLACK-MARKET-QR-{purchase.reference}.pdf"
            elif str(event.slug or "") == "warri-again-grand-spectacle-2026":
                # Warri Again: every paid order gets a branded PDF pass, one page
                # per ticket, so a party of four lands with four pages.
                from app.services.ticket_delivery import build_warri_ticket_pdf

                package = None
                for candidate in event.pass_packages or []:
                    if candidate.get("name") == purchase.package_name:
                        package = candidate
                        break

                when = ""
                try:
                    when = (
                        f"{event.event_date.strftime('%A, %d %B %Y')} · "
                        f"{event.event_time.strftime('%I:%M %p').lstrip('0')} "
                        f"({event.timezone or 'WAT'})"
                    )
                except Exception:
                    when = ""

                pdf_bytes = build_warri_ticket_pdf(
                    qr_code_base64=qr_codes[0],
                    buyer_name=purchase.buyer_name,
                    package_name=purchase.package_name or "General Access",
                    ticket_reference=purchase.reference,
                    event_title=event.title,
                    event_date_line=when,
                    venue=event.venue,
                    quantity=purchase.quantity or 1,
                    seats=(package or {}).get("seats"),
                    package_color=(package or {}).get("color"),
                    qr_codes=qr_codes,
                    qr_tokens=qr_tokens,
                )
                pdf_filename = f"WARRI-AGAIN-{purchase.reference}.pdf"

            # Send email with all QR codes
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
                qr_code_base64=qr_codes[0],
                template_type=template_type,
                package_name=purchase.package_name,
                flyer_url=None if is_black_market else flyer_url,
                qr_image_url=qr_image_urls[0],
                pdf_bytes=pdf_bytes,
                pdf_filename=pdf_filename,
                qr_image_urls=qr_image_urls,
                qr_tokens=qr_tokens,
            )
        except Exception as e:
            print(f"Failed to send ticket email: {e}")

    # Send ticket via WhatsApp if phone provided
    if purchase.buyer_phone:
        try:
            await send_ticket_whatsapp(
                buyer_phone=purchase.buyer_phone,
                buyer_name=purchase.buyer_name,
                ticket_reference=purchase.reference,
                event_title=event.title,
                event_date=str(event.event_date),
            )
        except Exception as e:
            print(f"Failed to send ticket WhatsApp: {e}")

    # Mirror this registration onto the co-developer's accreditation portal
    # (event 77 only, best-effort: never breaks our own fulfillment).
    try:
        from app.services.partner_sync import sync_event77_registration

        await sync_event77_registration(
            event,
            name=purchase.buyer_name,
            email=purchase.buyer_email,
            phone=purchase.buyer_phone,
            ticket_type=purchase.package_name or "General Access",
            number_of_tickets=purchase.quantity or 1,
            reference=purchase.reference,
        )
    except Exception:
        pass


async def credit_wallet_payment(db: AsyncSession, reference: str) -> None:
    """Credit a wallet from a paid wallet-funding transaction (WAL- references)."""
    from app.models.wallet import Wallet, WalletTransaction, DEFAULT_BALANCES

    result = await db.execute(
        select(WalletTransaction).where(WalletTransaction.reference == reference)
    )
    tx = result.scalar_one_or_none()
    if not tx or tx.status != "pending":
        return

    tx.status = "completed"
    wallet_result = await db.execute(select(Wallet).where(Wallet.id == tx.wallet_id))
    wallet = wallet_result.scalar_one_or_none()
    if wallet:
        cur = tx.currency or "NGN"
        balances = dict(wallet.balances or DEFAULT_BALANCES)
        balances[cur] = balances.get(cur, 0.0) + tx.amount
        wallet.balances = balances
        wallet.balance = balances.get(cur, 0.0)
    await db.commit()