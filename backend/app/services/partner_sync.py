"""Forward BLACK MARKET (event 77) registrations to the co-developer's
accreditation portal so both portals see the same guest list.

The synced ticket_number is ALWAYS the guest's full QR URL
(`https://accredit.vip/qr/{token}`: exactly what our QR codes contain
when scanned): purchase references for ticket sales (which equal the QR
token), QRCode tokens for manual adds (row ensured before syncing).

Scoped STRICTLY to event 77 (by id/title match): every other event is
untouched. All sends are best-effort: failures are logged and never break
our own purchase / guest flows. The partner's "already exists" response
counts as synced (keeps webhook retries idempotent).
"""

import httpx

from app.core.config import settings

BM_EVENT_ID = 77
BM_EVENT_TITLE = "BLACK MARKET Movie World Record Attempt"


def is_black_market_event(event) -> bool:
    return (getattr(event, "id", None) == BM_EVENT_ID) or (
        getattr(event, "title", None) == BM_EVENT_TITLE
    )


def qr_ticket_url(token: str) -> str:
    """Full QR URL for a token: the partner's ticket_number format."""
    return f"{settings.FRONTEND_URL.rstrip('/')}/qr/{token}"


async def sync_ticket_sale(
    name: str,
    email: str,
    phone: str | None,
    ticket_type: str,
    number_of_tickets: int,
    qr_token: str,
) -> bool:
    """POST one record to the partner ticket-sale API. Never raises."""
    ticket_number = qr_ticket_url(qr_token)
    payload = {
        "name": name,
        "email": email,
        "phone": phone or "",
        "ticket_type": ticket_type,
        "number_of_tickets": number_of_tickets,
        "ticket_number": ticket_number,
    }
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            res = await client.post(
                settings.PARTNER_TICKET_API_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        if res.status_code == 200:
            try:
                data = res.json()
            except Exception:
                data = {}
            if isinstance(data, dict) and data.get("status") == "success":
                print(f"[PartnerSync] synced {ticket_number} (guest_id={data.get('guest_id')})")
                return True
            if isinstance(data, dict) and "already exists" in str(data.get("message", "")).lower():
                print(f"[PartnerSync] {ticket_number} already on partner portal")
                return True
            print(f"[PartnerSync] unexpected response for {ticket_number}: {res.text[:150]}")
            return False
        if res.status_code == 409:
            print(f"[PartnerSync] {ticket_number} already on partner portal (409)")
            return True
        print(f"[PartnerSync] HTTP {res.status_code} for {ticket_number}: {res.text[:150]}")
        return False
    except Exception as e:
        print(f"[PartnerSync] failed for {ticket_number}: {e}")
        return False


def _base_url() -> str:
    return settings.PARTNER_TICKET_API_URL.rstrip("/") + "/"


async def update_partner_guest(
    qr_token: str,
    name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
    ticket_type: str | None = None,
) -> bool:
    """Push dashboard edits to the partner portal.

    PUTs to the base ticket-sale URL with ticket_number in the body (same
    parameters as POST). If the record isn't there (404), falls back to
    creating it. Never raises.
    """
    fields = {}
    if name is not None:
        fields["name"] = name
    if email is not None:
        fields["email"] = email
    if phone is not None:
        fields["phone"] = phone or ""
    if ticket_type is not None:
        fields["ticket_type"] = ticket_type
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            res = await client.put(
                _base_url(),
                json={"ticket_number": qr_ticket_url(qr_token), **fields},
                headers={"Content-Type": "application/json"},
            )
        if res.status_code == 200:
            print(f"[PartnerSync] updated {qr_ticket_url(qr_token)}")
            return True
        if res.status_code == 404:
            print(f"[PartnerSync] not on partner portal, creating {qr_ticket_url(qr_token)}")
            return await sync_ticket_sale(
                name or "", email or "", phone,
                ticket_type or "General Access", 1, qr_token,
            )
        print(f"[PartnerSync] PUT HTTP {res.status_code}: {res.text[:150]}")
        return False
    except Exception as e:
        print(f"[PartnerSync] update failed: {e}")
        return False


async def sync_event77_registration(
    event,
    *,
    name: str,
    email: str | None,
    phone: str | None,
    ticket_type: str,
    number_of_tickets: int,
    qr_token: str,
) -> bool:
    """No-op unless this is the BLACK MARKET event; records without an
    email are skipped (the partner API keys guests by email/ticket)."""
    if not is_black_market_event(event):
        return True
    if not email:
        print(f"[PartnerSync] skipped {qr_token[:12]}...: no email")
        return False
    return await sync_ticket_sale(
        name, email, phone, ticket_type, number_of_tickets, qr_token
    )
