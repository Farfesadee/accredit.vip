import asyncio
import hashlib
import json
import os
from datetime import datetime

from datetime import date, time, datetime
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, get_optional_current_user
from app.models.event import Event
from app.models.guest import Guest
from app.models.trial_usage import TrialUsage
from app.models.user import User
from app.services.email_service import send_email
from app.services.whatsapp_service import send_whatsapp
from app.services.sms_service import send_sms
from app.services.qr_service import qr_to_base64, qr_to_url
from app.services.trial_enforcement import TrialEnforcementService
from app.services.file_upload_security import resize_and_save

router = APIRouter()

ALLOWED_TRIAL_TYPES = {"invite", "event"}


class TrialCheckRequest(BaseModel):
    trial_type: str = Field(pattern="^(invite|event)$")
    fingerprint: str = Field(min_length=16, max_length=256)


class TrialUseRequest(TrialCheckRequest):
    payload: dict = Field(default_factory=dict)


def _hash(value: str) -> str:
    return hashlib.sha256(f"{settings.SECRET_KEY}:{value}".encode("utf-8")).hexdigest()


def _client_hash(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    ua = request.headers.get("user-agent", "unknown")
    return _hash(f"{ip}:{ua}")


def _parse_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return datetime.strptime(val.strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        pass
    try:
        return datetime.strptime(val.strip(), "%m/%d/%Y").date()
    except (ValueError, TypeError):
        pass
    try:
        return datetime.strptime(val.strip(), "%B %d, %Y").date()
    except (ValueError, TypeError):
        pass
    try:
        return datetime.strptime(val.strip(), "%d %B %Y").date()
    except (ValueError, TypeError):
        pass
    return None


def _format_date(val: str | None) -> str:
    parsed = _parse_date(val)
    if parsed:
        return parsed.strftime("%A %B %d, %Y")
    return val or "TBD"


def _dress_code_rows(payload: dict) -> str:
    """Return HTML <tr> rows for dress code(s) with section header."""
    dc = payload.get("dress_code") or ""
    mdc = payload.get("male_dress_code") or ""
    fdc = payload.get("female_dress_code") or ""
    rows = ""
    # Add section header if any dress codes exist
    if dc or mdc or fdc:
        rows += "<tr><td colspan='2' style='padding:12px 0 8px;border-top:1px solid #e8edf2;font-size:12px;color:#888;font-weight:bold;text-transform:uppercase;letter-spacing:1px'>DRESS CODE</td></tr>"
    if dc:
        rows += f"<tr><td style='padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top'>Code:</td><td style='padding:8px 0;font-size:14px;font-weight:bold;color:#07182f'>{dc}</td></tr>"
    if fdc:
        rows += f"<tr><td style='padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top'>Female</td><td style='padding:8px 0;font-size:14px;font-weight:bold;color:#07182f'>{fdc}</td></tr>"
    if mdc:
        rows += f"<tr><td style='padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top'>Male</td><td style='padding:8px 0;font-size:14px;font-weight:bold;color:#07182f'>{mdc}</td></tr>"
    return rows


def _format_time(val: str | None, tz: str | None = None) -> str:
    if not val:
        return "TBD"
    try:
        t = datetime.strptime(val.strip(), "%H:%M").time()
    except (ValueError, TypeError):
        try:
            t = datetime.strptime(val.strip(), "%I:%M %p").time()
        except (ValueError, TypeError):
            return (val or "TBD") + (f" ({tz})" if tz else "")
    hour = t.hour
    minute = t.minute
    ampm = "AM" if hour < 12 else "PM"
    h12 = hour if 1 <= hour <= 12 else (hour - 12 if hour > 12 else 12)
    m_str = f":{minute:02d}" if minute else ""
    return f"{h12}{m_str} {ampm}" + (f" ({tz})" if tz else "")


def _parse_time(val: str | None) -> time | None:
    if not val:
        return None
    try:
        return datetime.strptime(val.strip(), "%H:%M").time()
    except (ValueError, TypeError):
        pass
    try:
        return datetime.strptime(val.strip(), "%I:%M %p").time()
    except (ValueError, TypeError):
        pass
    return None


async def _maybe_create_event(req: TrialUseRequest, user: User | None, flyer_url: str | None, db: AsyncSession) -> int | None:
    p = req.payload
    ed = _parse_date(p.get("event_date"))
    et = _parse_time(p.get("event_time"))
    if not user:
        result = await db.execute(select(User).where(User.role == 'super_admin').limit(1))
        user = result.scalars().first()
    if not user:
        return None
    event = Event(
        organizer_id=user.id,
        title=p.get("title") or "Untitled Event",
        event_type=p.get("event_type") or p.get("category") or "other",
        host_name=p.get("host_name") or "",
        event_date=ed or date.today(),
        event_time=et or time(0, 0),
        venue=p.get("venue") or "TBD",
        city=p.get("city") or "",
        state=p.get("state") or "",
        country=p.get("country") or "Nigeria",
        description=p.get("description") or "",
        dress_code=p.get("dress_code") or "",
        guest_count_range=str(p.get("guest_count") or p.get("guest_count_range") or "1-50"),
        status="trial",
        cover_image=flyer_url or "",
    )
    if p.get("pass_packages"):
        event.pass_packages = p.get("pass_packages")
    if p.get("lineup"):
        event.lineup = p.get("lineup")
    db.add(event)
    await db.flush()
    test_email = p.get("test_email") or ""
    test_phone = p.get("test_phone") or ""
    if req.trial_type == "invite" and test_email:
        guest = Guest(
            event_id=event.id,
            name=p.get("guest_name") or p.get("host_name") or "Guest",
            email=test_email,
            phone=test_phone,
            rsvp_status="pending",
        )
        db.add(guest)
    return event.id


def _payload_summary(payload: dict) -> str:
    safe = {
        "title": payload.get("title"),
        "host_name": payload.get("host_name"),
        "delivery_channel": payload.get("delivery_channel"),
        "delivery_channels": payload.get("delivery_channels"),
        "guest_count": payload.get("guest_count"),
        "guest_range": payload.get("guest_range"),
        "guest_count_range": payload.get("guest_count_range"),
        "estimated_price": payload.get("estimated_price"),
        "pricing_units": payload.get("pricing_units"),
        "qr_included": payload.get("qr_included"),
    }
    return json.dumps(safe, sort_keys=True)


@router.post("/check")
async def check_trial(
    req: TrialCheckRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    fingerprint_hash = _hash(req.fingerprint)
    client_hash = _client_hash(request)
    result = await db.execute(
        select(TrialUsage).where(
            TrialUsage.trial_type == req.trial_type,
            (TrialUsage.fingerprint_hash == fingerprint_hash) | (TrialUsage.client_hash == client_hash),
        )
    )
    used = result.scalar_one_or_none() is not None
    return {"allowed": not used, "used": used}


@router.post("/use")
async def use_trial(
    req: TrialUseRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_current_user),
):
    if req.trial_type not in ALLOWED_TRIAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid trial type")

    fingerprint_hash = _hash(req.fingerprint)
    client_hash = _client_hash(request)
    result = await db.execute(
        select(TrialUsage).where(
            TrialUsage.trial_type == req.trial_type,
            (TrialUsage.fingerprint_hash == fingerprint_hash) | (TrialUsage.client_hash == client_hash),
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="You have already tested this feature. Create an account to continue.",
        )

    response = {
        "allowed": False,
        "message": "Trial used. Create an account to continue.",
    }
    event_id = None
    guest_created = False

    # Handle invite trial - generate and send flyer via all channels
    if req.trial_type == "invite":
        test_email = req.payload.get("test_email")
        test_phone = req.payload.get("test_phone")
        if not test_email:
            raise HTTPException(status_code=400, detail="Email address required for invite test")

        title = req.payload.get("title", "Our Special Event")
        host_name = req.payload.get("host_name", "") or ""
        event_date = req.payload.get("event_date", "TBD")
        event_time = req.payload.get("event_time", "TBD")
        description = req.payload.get("description", "Join us for an unforgettable experience!")
        delivery_channels = req.payload.get("delivery_channels", [])
        guest_count = req.payload.get("guest_count", "100+")
        invite_template = req.payload.get("invite_template")
        qr_delivery = req.payload.get("qr_delivery", "with_qr")
        # Support client-uploaded flier (base64 data URL)
        uploaded_image_data = req.payload.get("uploaded_image_data") or req.payload.get("uploadedImageData") or ""
        invitation_message_text = req.payload.get("invitation_message") or description

        # Save client-uploaded flier if provided
        flyer_url = None
        if uploaded_image_data and "," in uploaded_image_data:
            try:
                import base64 as b64
                import re
                header, data = uploaded_image_data.split(",", 1)
                ext_match = re.search(r"image/(\w+)", header)
                ext = ext_match.group(1) if ext_match else "png"
                img_data = b64.b64decode(data)
                upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "fliers")
                os.makedirs(upload_dir, exist_ok=True)
                fname = f"trial_flier_{int(datetime.now().timestamp())}.{ext}"
                fpath = os.path.join(upload_dir, fname)
                saved = resize_and_save(img_data, fpath)
                flyer_url = f"/uploads/fliers/{os.path.basename(saved)}" if saved else None
            except Exception:
                flyer_url = None

        # Generate QR code after we have the RSVP token
        animated_qr_url = None

        # Create event+guest record early so we have a real RSVP token
        rsvp_link_url = f"{settings.FRONTEND_URL}/create-event"
        guest_name = None
        if "email" in delivery_channels:
            event_id = await _maybe_create_event(req, user, flyer_url, db)
            if event_id:
                guest_created = True
                result = await db.execute(
                    select(Guest).where(Guest.event_id == event_id, Guest.email == test_email)
                )
                g = result.scalar_one_or_none()
                if g and g.rsvp_token:
                    rsvp_link_url = f"{settings.FRONTEND_URL}/rsvp/{g.rsvp_token}"
                    guest_name = g.name

            # Generate QR code with ticket URL (guest scans at venue for accreditation)
            if qr_delivery in ["with_qr", "qr_later"]:
                qr_data = rsvp_link_url.replace("/rsvp/", "/qr/")
                flyer_path = None
                image_data = None
                if flyer_url:
                    flyer_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), flyer_url.lstrip("/"))
                    if os.path.exists(flyer_path):
                        try:
                            with open(flyer_path, 'rb') as f:
                                image_data = f.read()
                        except Exception:
                            pass
                if image_data:
                    from app.services.qr_service import styled_qr_to_url
                    styled_url = styled_qr_to_url(qr_data, image_data=image_data, size=250)
                    if styled_url:
                        animated_qr_url = styled_url
                if not animated_qr_url:
                    base_url = qr_to_url(qr_data, image_path=flyer_path, size=250)
                    if base_url:
                        animated_qr_url = base_url
                    else:
                        animated_qr_url = qr_to_base64(qr_data)

        # Send test invite flyer via all selected channels
        sent_channels = []

        # Send via email - use public URLs for images
        if "email" in delivery_channels:
            qr_section = ""
            if animated_qr_url:
                absolute_qr = f"{settings.BACKEND_URL}{animated_qr_url}" if animated_qr_url.startswith("/") else animated_qr_url
                qr_section = f"""
                <div style="text-align: center; padding: 20px; background: #f0f0f0; border-top: 2px solid #E91E8C;">
                    <p style="color: #666; font-size: 14px; margin: 0 0 15px 0; font-weight: bold;">YOUR UNIQUE ENTRY CODE</p>
                    <img src="{absolute_qr}" alt="Entry QR Code" style="width: 250px; height: 250px;" />
                    <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">Show this code at the gate to enter</p>
                </div>
                """

            # Build guest section (mocks what real invites show)
            formatted_date = _format_date(event_date)
            tz = req.payload.get("timezone", "")
            if "|" in tz:
                tz = tz.split("|")[1].strip()
            formatted_time = _format_time(event_time, tz or None)
            dc_rows = _dress_code_rows(req.payload)
            guest_name_title = guest_name or "Guest"
            guest_section = f"""
                <div style="padding:32px 28px;background:#ffffff">
                    <p style="font-size:15px;color:#07182f;font-weight:bold;margin:0 0 16px">Dear {guest_name_title},</p>
                    <p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:2px;margin:0 0 4px">You are cordially invited to</p>
                    <h1 style="font-size:28px;color:#07182f;margin:0 0 16px;line-height:1.2">{title}</h1>
                    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px">{invitation_message_text}</p>
                    <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
                        <tr><td style="padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top">DATE</td><td style="padding:8px 0;font-size:14px;font-weight:bold">{formatted_date}</td></tr>
                        <tr><td style="padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top">TIME</td><td style="padding:8px 0;font-size:14px;font-weight:bold">{formatted_time}</td></tr>
                        {"<tr><td style='padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top'>VENUE</td><td style='padding:8px 0;font-size:14px;font-weight:bold'>" + req.payload.get("venue", "") + "</td></tr>" if req.payload.get("venue") else ""}
                        {dc_rows}
                    </table>
                    <div style="text-align:center;margin:24px 0">
                        <a href="{rsvp_link_url}" style="display:inline-block;background:#E91E8C;color:#fff;padding:14px 40px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:15px;font-family:Arial,sans-serif">RSVP NOW</a>
                    </div>
                    {qr_section}
                </div>
            """

            def _brand_banner():
                logo_url = f"{settings.FRONTEND_URL}/logo-dark-trim.png"
                return f"""<div style="background:linear-gradient(to right,#0D1B2A,#1a2a3a,#0D1B2A);padding:24px 20px;text-align:center">
                    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px">
                        <span style="color:#ffffff80;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase">JOIN</span>
                        <img src="{logo_url}" alt="accredit.vip" style="height:20px;width:auto;opacity:0.8" />
                    </div>
                    <div style="display:inline-block"><a href="https://accredit.vip" style="display:block;background-color:#E91E8C;color:#fff;padding:12px 32px;text-decoration:none;font-weight:bold;font-size:14px;font-family:Arial,sans-serif;border-radius:12px 12px 0 0">Create Event →</a><div style="width:0;height:0;margin:0 auto;border-left:14px solid transparent;border-right:14px solid transparent;border-top:10px solid #E91E8C"></div></div>
                </div>"""

            brand_html = _brand_banner()

            if flyer_url:
                absolute_flyer = f"{settings.BACKEND_URL}{flyer_url}" if flyer_url.startswith("/") else flyer_url
                html = f"""
                <html>
                <head>
                    <style>
                        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
                        .container {{ max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                        .flyer {{ width: 100%; max-width: 500px; display: block; }}
                        .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #999; background: #f8f9fc; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        {brand_html}
                        <img src="{absolute_flyer}" alt="{title}" class="flyer" />
                        {guest_section}
                        <div class="footer">
                            <p><strong>This is a TEST invitation preview</strong></p>
                            <p>This is exactly how your guests will see your invitation when you send it for real.</p>
                            <p>Create an account at Accredit.vip to send real invitations to your guest list.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
            else:
                html = f"""
                <html>
                <head>
                    <style>
                        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
                        .container {{ max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                        .footer {{ padding: 20px; text-align: center; font-size: 12px; color: #999; background: #f8f9fc; }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        {brand_html}
                        {guest_section}
                        <div class="footer">
                            <p><strong>This is a TEST invitation preview</strong></p>
                            <p>Create an account at Accredit.vip to send real invitations to your guest list.</p>
                        </div>
                    </div>
                </body>
                </html>
                """
            background_tasks.add_task(send_email, test_email, f"Your Test Invitation: {title}", html)
            sent_channels.append("Email")

        # Send via WhatsApp - try with media image, fallback to text-only
        if "whatsapp" in delivery_channels:
            send_to = test_phone or test_email
            whatsapp_msg = f"🎉 {title}\n\n{host_name + ' invites you!' if host_name else 'You are invited!'}\n{event_date} at {event_time}\n\n— Test preview by Accredit.vip"
            if flyer_url:
                ok = await send_whatsapp(send_to, whatsapp_msg, media_url=flyer_url)
                if not ok:
                    await send_whatsapp(send_to, whatsapp_msg)
            else:
                await send_whatsapp(send_to, whatsapp_msg)
            if animated_qr_url:
                ok = await send_whatsapp(send_to, "Your entry QR code:", media_url=animated_qr_url)
                if not ok:
                    await send_whatsapp(send_to, "Your entry QR code is ready!")
            sent_channels.append("WhatsApp")

        # Send via SMS - include flyer link
        if "sms" in delivery_channels:
            send_to = test_phone or test_email
            flyer_text = f"View flyer: {flyer_url}" if flyer_url else description
            qr_text = f" QR: {animated_qr_url}" if animated_qr_url else ""
            sms_msg = f"{title} - You're invited by {host_name}! {event_date} at {event_time}. {flyer_text}{qr_text} -Accredit.vip"
            await send_sms(send_to, sms_msg)
            sent_channels.append("SMS")

        response["sent_to"] = test_email
        response["sent_via"] = ", ".join(sent_channels) if sent_channels else "All channels"
        response["flyer_url"] = flyer_url
        if animated_qr_url:
            response["has_qr"] = True

    # Handle event trial - use uploaded flier or skip
    elif req.trial_type == "event":
        title = req.payload.get("title", "Upcoming Event")
        venue = req.payload.get("venue", "TBD")
        category = req.payload.get("category", "Event")
        event_date = req.payload.get("event_date", "TBD")

        # Use client-uploaded flier if available
        flyer_url = None
        uploaded_image_data = req.payload.get("uploaded_image_data") or req.payload.get("uploadedImageData") or ""
        if uploaded_image_data and "," in uploaded_image_data:
            try:
                import base64 as b64
                import re
                header, data = uploaded_image_data.split(",", 1)
                ext_match = re.search(r"image/(\w+)", header)
                ext = ext_match.group(1) if ext_match else "png"
                img_data = b64.b64decode(data)
                upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "fliers")
                os.makedirs(upload_dir, exist_ok=True)
                fname = f"trial_flier_{int(datetime.now().timestamp())}.{ext}"
                fpath = os.path.join(upload_dir, fname)
                saved = resize_and_save(img_data, fpath)
                flyer_url = f"/uploads/fliers/{os.path.basename(saved)}" if saved else None
                if flyer_url:
                    response["flier_url"] = flyer_url
            except Exception:
                pass

    # Create Event + Guest records (skip if already done for invite trial)
    if not guest_created:
        event_id = await _maybe_create_event(req, user, flyer_url, db)

    # SECURITY: Detect multi-account abuse
    abuse = await TrialEnforcementService.detect_multi_account_abuse(
        req.fingerprint, client_hash, db
    )
    if abuse and abuse.get("abuse_detected"):
        raise HTTPException(
            status_code=409,
            detail=abuse.get("message", "Trial already used from this device"),
        )

    # Record trial usage
    usage = TrialUsage(
        trial_type=req.trial_type,
        fingerprint_hash=fingerprint_hash,
        client_hash=client_hash,
        summary=_payload_summary(req.payload),
    )
    db.add(usage)
    await db.commit()

    if event_id:
        response["event_id"] = event_id

    return response
