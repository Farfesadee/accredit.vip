import secrets, hmac, hashlib, json, io, os, base64
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, extract_token
from app.models.user import User
from app.models.event import Event, TableInventory
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
    table_numbers: list[str] | None = None  # For table-based tiers: ["S-01", "S-02"]
    seat_numbers: list[int] | None = None   # For seat-based selection: [1, 3, 5]
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


async def _sold_quantities(db: AsyncSession, event_id: int) -> dict[str, int]:
    """Stock already sold per package, counted from completed purchases.

    Only packages that declare a ``capacity`` care about this, so events whose
    packages carry no capacity behave exactly as they did before. Table
    packages count tables rather than guests, because one unit of stock is one
    table no matter how many seats were bought on it.
    """
    result = await db.execute(
        select(
            TicketPurchase.package_name,
            TicketPurchase.quantity,
            TicketPurchase.table_numbers,
        ).where(
            TicketPurchase.event_id == event_id,
            TicketPurchase.status == "completed",
        )
    )
    sold: dict[str, int] = {}
    for name, qty, table_numbers in result.all():
        key = name or ""
        if isinstance(table_numbers, list) and table_numbers:
            count = len(table_numbers)
        else:
            count = int(qty or 0)
        sold[key] = sold.get(key, 0) + count
    return sold


# A checkout holds its tables the moment it is created, so an abandoned
# payment would otherwise lock a table out forever. Pending purchases older
# than this window are treated as abandoned and their tables go back on sale.
STALE_HOLD_MINUTES = 45


def _hold_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=STALE_HOLD_MINUTES)


async def _release_stale_holds(db: AsyncSession, event_id: int) -> None:
    """Put tables held by unpaid, expired checkouts back on sale."""
    stale_ids = (
        await db.execute(
            select(TicketPurchase.id).where(
                TicketPurchase.event_id == event_id,
                TicketPurchase.status == "pending",
                TicketPurchase.created_at < _hold_cutoff(),
            )
        )
    ).scalars().all()
    if not stale_ids:
        return
    rows = (
        await db.execute(
            select(TableInventory).where(
                TableInventory.event_id == event_id,
                TableInventory.purchase_id.in_(stale_ids),
            )
        )
    ).scalars().all()
    if not rows:
        return
    # A table that already carries paid seats stays part sold even after an
    # abandoned checkout releases its hold, so the unsold seats keep selling
    # and a whole-table sale cannot quietly take seats that are spoken for.
    sold_seats = await _sold_seats(db, event_id)
    for table in rows:
        table.purchase_id = None
        table.status = (
            "partially_sold" if sold_seats.get(table.table_number) else "available"
        )
    await db.commit()


async def _sold_seats(db: AsyncSession, event_id: int) -> dict[str, set[int]]:
    """Seat numbers already taken on each table, keyed by table code.

    Counts completed purchases plus checkouts that are still live (younger than
    the stale-hold window), so two buyers can never take the same seat while
    still freeing seats from abandoned carts.
    """
    cutoff = _hold_cutoff()
    rows = (
        await db.execute(
            select(
                TicketPurchase.status,
                TicketPurchase.created_at,
                TicketPurchase.seat_assignments,
                TicketPurchase.table_numbers,
            ).where(
                TicketPurchase.event_id == event_id,
                TicketPurchase.status.in_(["pending", "completed"]),
            )
        )
    ).all()

    taken: dict[str, set[int]] = {}
    for status, created_at, assignments, table_numbers in rows:
        if status == "pending" and created_at is not None:
            created = created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if created < cutoff:
                continue
        if not assignments:
            continue
        single_table = (
            table_numbers[0]
            if isinstance(table_numbers, list) and len(table_numbers) == 1
            else None
        )
        for item in assignments:
            code = single_table
            seat = item
            if isinstance(item, dict):
                code = item.get("table") or code
                seat = item.get("seat")
            try:
                seat_number = int(seat)
            except (TypeError, ValueError):
                continue
            if not code:
                continue
            taken.setdefault(str(code), set()).add(seat_number)
    return taken


def _package_remaining(package: dict, sold: int) -> int | None:
    """Remaining stock for one package, or None when it is unlimited."""
    capacity = package.get("capacity")
    if capacity in (None, ""):
        return None
    try:
        return max(0, int(capacity) - sold)
    except (TypeError, ValueError):
        return None


@router.get("/events/{event_id}/availability")
async def package_availability(event_id: int, db: AsyncSession = Depends(get_db)):
    """Per-package stock for the public ticket panel (sold out, seats left)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await _release_stale_holds(db, event_id)

    # A published table map is the real stock for table tiers: count the tables
    # still free rather than reconstructing it from past purchases.
    table_stock: dict[str, dict[str, int]] = {}
    inventory_rows = (
        await db.execute(
            select(TableInventory.tier_name, TableInventory.status).where(
                TableInventory.event_id == event_id
            )
        )
    ).all()
    for tier_name, status in inventory_rows:
        entry = table_stock.setdefault(tier_name, {"available": 0, "total": 0})
        if status != "blocked":
            entry["total"] += 1
            if status == "available":
                entry["available"] += 1

    sold = await _sold_quantities(db, event_id)
    packages = []
    for pkg in event.pass_packages or []:
        name = pkg.get("name")
        if not name:
            continue
        try:
            seats = int(pkg.get("seats") or 1)
        except (TypeError, ValueError):
            seats = 1
        stock = table_stock.get(name)
        if stock is not None and seats > 1:
            capacity = stock["total"]
            remaining = stock["available"]
            sold_qty = max(0, capacity - remaining)
        else:
            sold_qty = sold.get(name, 0)
            remaining = _package_remaining(pkg, sold_qty)
            capacity = pkg.get("capacity")
        packages.append(
            {
                "name": name,
                "capacity": capacity,
                "sold": sold_qty,
                "remaining": remaining,
                "sold_out": remaining == 0,
                "seats": pkg.get("seats"),
            }
        )
    return {"event_id": event_id, "packages": packages}


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

    # Published table map. When an event has inventory rows the map is the
    # source of truth for stock: a table that is not on it cannot be sold, and
    # one that is sold or blocked is unavailable. Events without inventory keep
    # the plain quantity-based check, so nothing else changes.
    await _release_stale_holds(db, event.id)
    inventory_rows = (
        await db.execute(
            select(TableInventory).where(TableInventory.event_id == event.id)
        )
    ).scalars().all()
    inventory = {t.table_number: t for t in inventory_rows}
    has_inventory = bool(inventory)

    try:
        seats_per_table = int(selected_package.get("seats") or 1) if selected_package else 1
    except (TypeError, ValueError):
        seats_per_table = 1

    # Tables are the packages that seat more than one guest on a fixed block.
    is_table_package = (
        selected_package is not None
        and seats_per_table > 1
        and selected_package.get("capacity") not in (None, "")
    )
    is_seat_package = is_table_package and bool(req.seat_numbers)
    # A table tier present on the published map is stocked by that map, not by
    # the coarse capacity counter in the package.
    tier_on_map = bool(
        selected_package
        and any(t.tier_name == selected_package.get("name") for t in inventory_rows)
    )
    governed_by_inventory = is_table_package and tier_on_map

    if is_seat_package:
        # Individual seats are sold pro rata against the table price, so eight
        # seats on a table of ten cost eight tenths of the table.
        package_price = package_price / seats_per_table

    is_free = not package_price or package_price == 0
    if not is_free and event.tickets_available is not None and event.tickets_available < req.quantity:
        raise HTTPException(status_code=400, detail="Not enough tickets available")

    # Per-package stock (tables and limited tiers). Packages without a
    # ``capacity`` skip this entirely, so other events are untouched. A tier
    # published on the map is governed by its tables instead.
    if selected_package is not None and not is_seat_package and not governed_by_inventory:
        sold = await _sold_quantities(db, event.id)
        remaining = _package_remaining(
            selected_package, sold.get(selected_package.get("name"), 0)
        )
        if remaining is not None and req.quantity > remaining:
            label = selected_package.get("name") or "This ticket"
            if remaining <= 0:
                raise HTTPException(status_code=409, detail=f"{label} is sold out")
            raise HTTPException(
                status_code=409,
                detail=f"Only {remaining} left for {label}. Reduce your quantity and try again.",
            )

    if is_table_package and not is_seat_package:
        if not req.table_numbers or len(req.table_numbers) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"Package '{selected_package.get('name')}' requires table selection. Please select tables on the floor plan.",
            )
        if len(req.table_numbers) != req.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Selected {len(req.table_numbers)} tables but quantity is {req.quantity}. They must match.",
            )

        unavailable: list[str] = []
        if has_inventory:
            for code in req.table_numbers:
                table = inventory.get(code)
                if table is None:
                    raise HTTPException(status_code=400, detail=f"Table {code} is not on the floor plan")
                if table.tier_name != selected_package.get("name"):
                    raise HTTPException(
                        status_code=400,
                        detail=f"Table {code} is a {table.tier_name}, not a {selected_package.get('name')}",
                    )
                if table.status != "available":
                    unavailable.append(code)
        else:
            available_result = await db.execute(
                select(TableInventory).where(
                    TableInventory.event_id == event.id,
                    TableInventory.table_number.in_(req.table_numbers),
                    TableInventory.status == "available",
                )
            )
            available_numbers = {t.table_number for t in available_result.scalars().all()}
            unavailable = [n for n in req.table_numbers if n not in available_numbers]
        if unavailable:
            raise HTTPException(
                status_code=409,
                detail=f"Tables not available: {', '.join(unavailable)}",
            )

    if is_seat_package:
        if len(req.seat_numbers) > seats_per_table:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot select more than {seats_per_table} seats per table.",
            )
        if len(req.seat_numbers) != req.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Selected {len(req.seat_numbers)} seats but quantity is {req.quantity}. They must match.",
            )
        if len(set(req.seat_numbers)) != len(req.seat_numbers):
            raise HTTPException(status_code=400, detail="Each seat can only be selected once.")

        # The seating ring on the published plan leaves seats 4 and 8 empty.
        blocked_seats = {4, 8}
        for seat in req.seat_numbers:
            if seat < 1 or seat > seats_per_table:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid seat number: {seat}. Must be between 1 and {seats_per_table}.",
                )
            if seat in blocked_seats:
                raise HTTPException(
                    status_code=409,
                    detail=f"Seat {seat} is not for sale on this table.",
                )

        if has_inventory:
            if not req.table_numbers or len(req.table_numbers) != 1:
                raise HTTPException(
                    status_code=400,
                    detail="Choose one table to select seats from.",
                )
            code = req.table_numbers[0]
            table = inventory.get(code)
            if table is None:
                raise HTTPException(status_code=400, detail=f"Table {code} is not on the floor plan")
            if table.tier_name != selected_package.get("name"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Table {code} is a {table.tier_name}, not a {selected_package.get('name')}",
                )
            if table.status in ("sold", "blocked"):
                raise HTTPException(status_code=409, detail=f"Table {code} is no longer available")
            taken = blocked_seats | (await _sold_seats(db, event.id)).get(code, set())
            clash = sorted(set(req.seat_numbers) & taken)
            if clash:
                raise HTTPException(
                    status_code=409,
                    detail=f"Seat(s) {', '.join(str(s) for s in clash)} on table {code} are already taken.",
                )

    # Per-package fixed charges (e.g. Black Market: General +250, Premium +2500).
    # Packages WITHOUT an explicit fee keep the legacy platform% + VAT math.
    package_fee = 0.0
    if selected_package is not None and selected_package.get("fee") not in (None, ""):
        try:
            package_fee = float(selected_package.get("fee") or 0)
        except (TypeError, ValueError):
            package_fee = 0.0

    base_amount = package_price * req.quantity
    if selected_package is not None and selected_package.get("all_in"):
        # Sold at exactly the listed price: no platform fee, no VAT, nothing
        # added at checkout.
        platform_fee = 0
        vat = 0
        total = base_amount
    elif package_fee:
        platform_fee = round(package_fee * req.quantity)
        vat = 0
        total = base_amount + platform_fee
    else:
        platform_fee = round(base_amount * settings.PLATFORM_FEE_PERCENT / 100) if not is_free else 0
        vat = round(base_amount * settings.VAT_PERCENT / 100) if not is_free else 0
        total = base_amount + vat

    # Seat purchases are priced pro rata, so a table that does not split evenly
    # can leave a fraction of a naira behind. Charge whole naira only.
    base_amount = round(base_amount)
    total = round(total)

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
            table_numbers=req.table_numbers if req.table_numbers else None,
            seat_assignments=(
                [
                    {
                        "table": req.table_numbers[0] if req.table_numbers else None,
                        "seat": seat,
                    }
                    for seat in req.seat_numbers
                ]
                if req.seat_numbers
                else None
            ),
            utm_source=req.utm_source,
            utm_medium=req.utm_medium,
            utm_campaign=req.utm_campaign,
        )
        db.add(purchase)
        await db.commit()
        await db.refresh(purchase)

        if req.table_numbers:
            table_result = await db.execute(
                select(TableInventory).where(
                    TableInventory.event_id == event.id,
                    TableInventory.table_number.in_(req.table_numbers),
                )
            )
            for t in table_result.scalars().all():
                t.purchase_id = purchase.id
                t.status = "partially_sold" if is_seat_package else "sold"
            await db.commit()

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
            "paystack_public_key": settings.paystack_public_key(req.event_id, event.paystack_key_mode),
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
        table_numbers=req.table_numbers if req.table_numbers else None,
        seat_assignments=(
            [
                {
                    "table": req.table_numbers[0] if req.table_numbers else None,
                    "seat": seat,
                }
                for seat in req.seat_numbers
            ]
            if req.seat_numbers
            else None
        ),
        utm_source=req.utm_source,
        utm_medium=req.utm_medium,
        utm_campaign=req.utm_campaign,
    )
    db.add(purchase)
    await db.commit()
    await db.refresh(purchase)

    # Link selected tables to this purchase. A whole-table sale takes the table
    # out of circulation; an individual-seat sale only marks it part sold so the
    # remaining seats stay on offer.
    if req.table_numbers:
        result = await db.execute(
            select(TableInventory).where(
                TableInventory.event_id == event.id,
                TableInventory.table_number.in_(req.table_numbers),
            )
        )
        tables = result.scalars().all()
        for t in tables:
            t.purchase_id = purchase.id
            t.status = "partially_sold" if is_seat_package else "sold"
        await db.commit()

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
            "paystack_public_key": settings.paystack_public_key(req.event_id, event.paystack_key_mode),
        }

    paystack_url = None
    buyer_user = await get_optional_user(request, db)
    paystack_secret = settings.paystack_secret_key(
        buyer_user.email if buyer_user else None, req.event_id, event.paystack_key_mode
    )
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
        "paystack_public_key": settings.paystack_public_key(req.event_id, event.paystack_key_mode),
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
    # Include event 105 keys if the purchase is for that event.
    event = purchase.event
    paystack_success = False
    tried_keys = []
    verify_keys = [
        settings.PAYSTACK_SECRET_KEY,
        settings.PAYSTACK_TEST_SECRET_KEY,
    ]
    if event and event.id == 105:
        if settings.PAYSTACK_EVENT_105_SECRET_KEY:
            verify_keys.insert(0, settings.PAYSTACK_EVENT_105_SECRET_KEY)
        if settings.PAYSTACK_EVENT_105_TEST_SECRET_KEY:
            verify_keys.insert(1, settings.PAYSTACK_EVENT_105_TEST_SECRET_KEY)
    for key in dict.fromkeys(verify_keys):
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


# =============================================================================
# Floor Plan & Table Selection Endpoints (Warri Again - Event 105)
# =============================================================================

class FloorPlanTableResponse(BaseModel):
    id: int
    table_number: str
    tier_name: str
    tier_category: str
    x_position: float
    y_position: float
    shape: str
    shape_data: dict | None
    color: str
    status: str
    # Presentation details for the published plan. The file draws the same
    # number in several zones (Silver 1-7 rear left, 1-12 lounge, 8-18 rear
    # right), so the zone is what tells two tables apart.
    side: str | None = None
    display_number: int | None = None
    seat_count: int = 0
    sold_seats: list[int] = []
    blocked: bool = False


class FloorPlanResponse(BaseModel):
    event_id: int
    floor_plan_image: str | None
    tables: list[FloorPlanTableResponse]


@router.get("/events/{event_id}/floor-plan", response_model=FloorPlanResponse)
async def get_floor_plan(
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get floor plan image and all table positions for an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await _release_stale_holds(db, event_id)

    result = await db.execute(
        select(TableInventory).where(TableInventory.event_id == event_id)
    )
    tables = result.scalars().all()
    sold_seats = await _sold_seats(db, event_id)

    # Build floor plan image URL
    floor_plan_url = None
    if event.floor_plan_image:
        floor_plan_url = (
            event.floor_plan_image
            if str(event.floor_plan_image).startswith("http")
            else f"{settings.FRONTEND_URL.rstrip('/')}{event.floor_plan_image}"
        )

    def _table_payload(t: TableInventory) -> FloorPlanTableResponse:
        data = t.shape_data or {}
        side = data.get("side")
        display_number = data.get("display_number")
        if display_number is None:
            tail = str(t.table_number).rsplit("-", 1)[-1]
            display_number = int(tail) if tail.isdigit() else None
        return FloorPlanTableResponse(
            id=t.id,
            table_number=t.table_number,
            tier_name=t.tier_name,
            tier_category=t.tier_category,
            x_position=t.x_position,
            y_position=t.y_position,
            shape=t.shape,
            shape_data=data,
            color=t.color,
            status=t.status,
            side=side,
            display_number=display_number,
            seat_count=int(data.get("seats") or 10),
            sold_seats=sorted(sold_seats.get(t.table_number, set())),
            blocked=t.status == "blocked" or bool(data.get("blocked")),
        )

    return FloorPlanResponse(
        event_id=event_id,
        floor_plan_image=floor_plan_url,
        tables=[_table_payload(t) for t in tables],
    )


class AvailableTablesResponse(BaseModel):
    event_id: int
    tiers: dict[str, list[FloorPlanTableResponse]]


@router.get("/events/{event_id}/tables/available", response_model=AvailableTablesResponse)
async def get_available_tables(
    event_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get available tables grouped by tier for the table selection UI."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(TableInventory)
        .where(TableInventory.event_id == event_id)
        .where(TableInventory.status == "available")
    )
    tables = result.scalars().all()

    # Group by tier_category
    tiers: dict[str, list[FloorPlanTableResponse]] = {}
    for t in tables:
        if t.tier_category not in tiers:
            tiers[t.tier_category] = []
        tiers[t.tier_category].append(
            FloorPlanTableResponse(
                id=t.id,
                table_number=t.table_number,
                tier_name=t.tier_name,
                tier_category=t.tier_category,
                x_position=t.x_position,
                y_position=t.y_position,
                shape=t.shape,
                shape_data=t.shape_data or {},
                color=t.color,
                status=t.status,
            )
        )

    return AvailableTablesResponse(event_id=event_id, tiers=tiers)


class TableReserveRequest(BaseModel):
    table_ids: list[int]  # TableInventory IDs to reserve
    buyer_email: str = Field(min_length=1)
    buyer_name: str = Field(min_length=1)
    buyer_phone: str | None = None


class TableReserveResponse(BaseModel):
    reserved: bool
    table_ids: list[int]
    expires_at: str | None
    message: str


@router.post("/tables/reserve", response_model=TableReserveResponse)
async def reserve_tables(
    event_id: int,
    req: TableReserveRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reserve tables for 10 minutes during checkout."""
    from datetime import datetime, timedelta, timezone

    result = await db.execute(
        select(TableInventory)
        .where(TableInventory.id.in_(req.table_ids))
        .where(TableInventory.event_id == event_id)
        .where(TableInventory.status == "available")
    )
    tables = result.scalars().all()

    if len(tables) != len(req.table_ids):
        raise HTTPException(status_code=400, detail="One or more tables not available")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    for t in tables:
        t.status = "reserved"
        t.reserved_until = expires_at

    await db.commit()

    return TableReserveResponse(
        reserved=True,
        table_ids=[t.id for t in tables],
        expires_at=expires_at.isoformat(),
        message=f"Tables reserved for 10 minutes. Complete your purchase to confirm.",
    )


class TableReleaseRequest(BaseModel):
    table_ids: list[int]


@router.post("/tables/release")
async def release_tables(
    event_id: int,
    req: TableReleaseRequest,
    db: AsyncSession = Depends(get_db),
):
    """Release reserved tables back to available."""
    result = await db.execute(
        select(TableInventory)
        .where(TableInventory.id.in_(req.table_ids))
        .where(TableInventory.event_id == event_id)
        .where(TableInventory.status == "reserved")
    )
    tables = result.scalars().all()

    for t in tables:
        t.status = "available"
        t.reserved_until = None

    await db.commit()
    return {"released": len(tables)}


# =============================================================================
# Table/Seat Management Endpoints (Warri Again - Event 105)
# =============================================================================

class TableStatusUpdateRequest(BaseModel):
    table_ids: list[int]
    status: str  # "available" | "blocked" | "sold"


class SeatStatusUpdateRequest(BaseModel):
    table_id: int
    seat_numbers: list[int]
    status: str  # "available" | "sold"


@router.patch("/events/{event_id}/tables/status", response_model=dict)
async def update_table_status(
    event_id: int,
    req: TableStatusUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Close/open tables manually (organizer or admin)."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check permission: organizer or admin
    if event.organizer_id != user.id and user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if req.status not in ("available", "blocked", "sold"):
        raise HTTPException(status_code=400, detail="Invalid status. Use: available, blocked, sold")

    result = await db.execute(
        select(TableInventory)
        .where(TableInventory.id.in_(req.table_ids))
        .where(TableInventory.event_id == event_id)
    )
    tables = result.scalars().all()

    if len(tables) != len(req.table_ids):
        raise HTTPException(status_code=400, detail="One or more tables not found")

    for t in tables:
        # Don't override "partially_sold" to "available" directly; require explicit action
        if t.status == "partially_sold" and req.status == "available":
            # Check if any seats are still sold
            sold = await _sold_seats(db, event_id)
            if sold.get(t.table_number):
                raise HTTPException(
                    status_code=400,
                    detail=f"Table {t.table_number} has sold seats. Release seats first or mark as partially_sold."
                )
        t.status = req.status
        if req.status in ("sold", "blocked"):
            t.purchase_id = None  # Clear any pending purchase hold
            t.reserved_until = None

    await db.commit()
    return {"updated": len(tables), "status": req.status}


@router.patch("/events/{event_id}/seats/status", response_model=dict)
async def update_seat_status(
    event_id: int,
    req: SeatStatusUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Close/open individual seats on a table (organizer or admin)."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.organizer_id != user.id and user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if req.status not in ("available", "sold"):
        raise HTTPException(status_code=400, detail="Invalid status. Use: available, sold")

    table_result = await db.execute(
        select(TableInventory).where(
            TableInventory.id == req.table_id,
            TableInventory.event_id == event_id,
        )
    )
    table = table_result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # Update seat assignments in purchase records
    # We track sold seats via TicketPurchase.seat_assignments
    # For manual closure, we create a dummy purchase or update existing
    # Simpler approach: store blocked seats in table.shape_data
    data = table.shape_data or {}
    blocked_seats = set(data.get("blocked_seats", []))
    sold_seats = set((await _sold_seats(db, event_id)).get(table.table_number, set()))

    if req.status == "sold":
        for seat in req.seat_numbers:
            blocked_seats.add(seat)
    else:  # available
        for seat in req.seat_numbers:
            blocked_seats.discard(seat)

    data["blocked_seats"] = sorted(blocked_seats)
    table.shape_data = data
    table.updated_at = datetime.now(timezone.utc)

    await db.commit()

    # Return current seat status
    all_seats = list(range(1, int(data.get("seats", 10)) + 1))
    current_sold = sorted(sold_seats | blocked_seats)
    return {
        "table_id": table.id,
        "table_number": table.table_number,
        "total_seats": len(all_seats),
        "sold_seats": current_sold,
        "available_seats": [s for s in all_seats if s not in current_sold],
    }


@router.get("/events/{event_id}/report", response_model=dict)
async def get_event_report(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """HTML/Infographic report for event 105: shows all purchases with tables/seats."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.organizer_id != user.id and user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get all completed purchases
    result = await db.execute(
        select(TicketPurchase).where(
            TicketPurchase.event_id == event_id,
            TicketPurchase.status == "completed",
        ).order_by(TicketPurchase.created_at.desc())
    )
    purchases = result.scalars().all()

    # Build report data
    report_data = []
    for p in purchases:
        table_nums = p.table_numbers or []
        seat_assignments = p.seat_assignments or []
        for i, table in enumerate(table_nums):
            seats = []
            if seat_assignments:
                for sa in seat_assignments:
                    if isinstance(sa, dict) and sa.get("table") == table:
                        seats.append(sa.get("seat"))
                    elif isinstance(sa, int) and len(table_nums) == 1:
                        seats.append(sa)
            report_data.append({
                "buyer_name": p.buyer_name,
                "buyer_email": p.buyer_email,
                "buyer_phone": p.buyer_phone,
                "table": table,
                "seats": seats,
                "package": p.package_name,
                "quantity": p.quantity,
                "amount": p.amount,
                "reference": p.reference,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            })

    # Also include manually blocked tables/seats
    tables_result = await db.execute(
        select(TableInventory).where(TableInventory.event_id == event_id)
    )
    tables = tables_result.scalars().all()
    sold_seats = await _sold_seats(db, event_id)
    manual_blocks = []
    for t in tables:
        data = t.shape_data or {}
        blocked = set(data.get("blocked_seats", []))
        auto_sold = set(sold_seats.get(t.table_number, set()))
        manual_only = blocked - auto_sold
        if manual_only:
            manual_blocks.append({
                "table": t.table_number,
                "tier": t.tier_name,
                "manually_blocked_seats": sorted(manual_only),
                "status": t.status,
            })

    return {
        "event": {
            "id": event.id,
            "title": event.title,
            "date": str(event.event_date),
            "venue": event.venue,
        },
        "purchases": report_data,
        "manual_blocks": manual_blocks,
        "summary": {
            "total_purchases": len(purchases),
            "total_tickets": sum(len(d["seats"]) or 1 for d in report_data),
            "total_revenue": sum(d["amount"] for d in report_data),
            "tables_sold": len(set(d["table"] for d in report_data if d["table"])),
        },
    }


# Update PurchaseRequest to include table_numbers
# (Already has table_numbers field in TicketPurchase model)
# The purchase endpoint already reads req.package_name
# We need to add table_numbers to PurchaseRequest

# Update PurchaseRequest class (add after package_name)
# table_numbers: list[str] | None = None
