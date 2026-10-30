import os
import re
import asyncio
import base64
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.event import Event
from app.models.guest import Guest
from app.models.flier import FlierAsset
from app.models.invite import InviteBatch, InviteMessage
from app.models.payment import Payment
from app.api.qr_codes import get_or_create_guest_qr
from app.services.email_service import send_email
from app.services.sms_service import send_sms
from app.services.whatsapp_service import send_whatsapp
from app.services.whatsapp_cloud_service import send_whatsapp_cloud
from app.services.qr_service import qr_to_url, styled_qr_to_url
from app.api.anchor_copy import (
    _build_anchor_invite_message,
    _build_anchor_qr_message,
)

RESEND_PRICE_PER_GUEST = 500  # NGN per guest for re-sending

router = APIRouter()


class SendInvitesRequest(BaseModel):
    channel: str = "email"
    channels: Optional[List[str]] = None
    message_subject: Optional[str] = None
    message_body: Optional[str] = None

    def get_channels(self) -> List[str]:
        return self.channels if self.channels else [self.channel]


class SendGuestInviteRequest(BaseModel):
    channel: str = "email"
    channels: Optional[List[str]] = None
    message_subject: Optional[str] = None
    message_body: Optional[str] = None

    def get_channels(self) -> List[str]:
        return self.channels if self.channels else [self.channel]


def phone_digits(value: str | None) -> str:
    """Digits only, so +234 803 123 4567 and (0803) 123-4567 both survive."""
    if not value:
        return ""
    digits = re.sub(r"\D", "", str(value))
    # A pasted country code often doubles up (+234 234 810 ...). Collapse it so the
    # number is usable instead of being flagged as invalid.
    if digits.startswith("234234") and len(digits) > 12:
        digits = "234" + digits[6:]
    return digits


def is_valid_phone(value: str | None) -> bool:
    """A number is sendable when it carries 7 to 15 digits.

    Anything the senders can normalise themselves (spaces, dashes, brackets,
    a leading 0, a missing +, a doubled country code) must not block a batch,
    so only genuinely unusable entries (blank, letters, too short, too long)
    fail here.
    """
    digits = phone_digits(value)
    return 7 <= len(digits) <= 15


async def _send_whatsapp(to: str, message: str, media_url: str | None = None, content_vars: dict | None = None, media_urls: list[str] | None = None) -> tuple[bool, str | None]:
    if media_urls and len(media_urls) > 1:
        # Meta Cloud supports a single image per message; use Twilio for multiple media.
        return await send_whatsapp(to, message, media_url, content_vars=content_vars, media_urls=media_urls)
    if settings.WHATSAPP_CLOUD_TOKEN and settings.WHATSAPP_CLOUD_PHONE_ID:
        ok, provider_id = await send_whatsapp_cloud(to, message, media_url)
        if ok:
            return ok, provider_id
    return await send_whatsapp(to, message, media_url, content_vars=content_vars, media_urls=media_urls)


def _format_date(date_val) -> str:
    """Convert date to format like 'Saturday May 15, 2027'."""
    from datetime import date
    if isinstance(date_val, str):
        try:
            date_val = date.fromisoformat(date_val)
        except ValueError:
            return date_val
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    return f"{days[date_val.weekday()]} {months[date_val.month - 1]} {date_val.day}, {date_val.year}"


def _format_time(time_val, tz: str = "WAT") -> str:
    """Convert time to 12-hour format like '8:00 PM (WAT)'."""
    from datetime import time
    if isinstance(time_val, str):
        try:
            parts = time_val.split(":")
            time_val = time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
        except (ValueError, IndexError):
            return time_val
    if tz and "|" in tz:
        tz = tz.split("|")[-1].strip()
    tz_short = {
        "africa/lagos": "Lagos",
        "africa/abuja": "Abuja",
        "africa/accra": "Accra",
        "europe/london": "London",
        "america/new_york": "New York",
        "america/los_angeles": "Los Angeles",
    }
    tz_name = tz_short.get(tz.lower(), tz) if tz else tz
    hour = time_val.hour
    minute = time_val.minute
    ampm = "AM" if hour < 12 else "PM"
    hour12 = hour if hour <= 12 else hour - 12
    if hour12 == 0:
        hour12 = 12
    minute_str = f":{minute:02d}" if minute else ""
    return f"{hour12}{minute_str} {ampm} ({tz_name})"


def _absolute_url(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return f"{settings.FRONTEND_URL}{url}"
    return url


def invite_link_for(event: Event, guest: Guest) -> str:
    """Where an invitation link takes the guest.

    Events that open with a film or a montage (the anniversary, the gala and the
    wedding) present themselves on their public invitation page, so their
    invites send guests to that page rather than to a bare personal RSVP card.
    Every other event keeps the personal guest link, and QR passes always stay
    personal.
    """
    from app.api.event_registration import experience_for, is_anchor_event

    # Anchor Evening of Bliss (event 85) is invited first from the dashboard, so
    # its invite must carry the guest's own link rather than the public page.
    if is_anchor_event(event):
        return f"{settings.FRONTEND_URL}/rsvp/{guest.rsvp_token}"

    if event.slug and experience_for(event) != "standard":
        return f"{settings.FRONTEND_URL}/rsvp/register/{event.slug}"
    return f"{settings.FRONTEND_URL}/rsvp/{guest.rsvp_token}"


def _upload_path_from_url(url: str) -> str:
    upload_base = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
    if "/uploads/" in url:
        relative = url.rstrip("/").split("/uploads/")[-1]
    elif url.startswith("/uploads/"):
        relative = url[len("/uploads/"):]
    else:
        relative = url.lstrip("/")
    return os.path.join(upload_base, relative)


def _build_media_invite_message(guest: Guest, event: Event) -> tuple[str, str, str]:
    """Media accreditation invite for BLACK MARKET (event 77 ONLY).

    No QR code: the bold MEDIA badge in the email itself is the entry pass.
    """
    subject = f"MEDIA ACCREDITATION: {event.title}"
    body = (
        "Dear Media Partner,\n\n"
        "We are excited to welcome you to the official screening of BLACK MARKET.\n\n"
        "Please find your entry, parking and accreditation details below:\n\n"
        "MEDIA ACCREDITATION\n"
        "Accreditation starts from 1:00 PM\n"
        "Media Entrance: Zone A\n\n"
        "ZONE A CAR PARKS\n"
        "Media guests arriving through Zone A may use any of the following designated car parks:\n"
        "Hassan Car Park\n"
        "Under Bridge Car Park\n"
        "Banquet Car Park\n"
        "Marquee Car Park\n"
        "Independence Car Park\n\n"
        "Upon arrival, please proceed to Zone A and make your way to the Media Accreditation Stand, "
        "where our team will be available to assist with accreditation, access, and any other needs "
        "you may have.\n\n"
        "Media Accreditation Contacts:\n\n"
        "Adebola Adewale +234 814 982 1974\n\n"
        "Korede Owolabani +234 912 092 2785\n\n"
        "Please Note: Adebola and Korede will be on ground from 1:00 PM to ensure a smooth "
        "accreditation and entry process for all accredited media personnel.\n\n"
        "We look forward to welcoming you and having you join us for this special moment.\n"
        "#WatchBlackMarket"
    )
    html = (
        '<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#2B1A12;background:#FFF8F0">'
        '<div style="background:#2B1A12;color:#FFF8F0;padding:32px 28px;text-align:center;border-radius:10px 10px 0 0">'
        '<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FDBA74;margin-bottom:8px">Official Screening</div>'
        '<h1 style="margin:0 0 4px;font-size:30px;line-height:1.1;color:#FFF8F0">🎬 BLACK MARKET</h1>'
        '<p style="margin:0 0 12px;color:#FDBA74;font-size:13px">Movie World Record Attempt</p>'
        '<div style="background:#C2410C;color:#FFF8F0;display:inline-block;padding:8px 30px;border-radius:20px;font-weight:bold;font-size:16px;letter-spacing:2px">★ MEDIA ★</div>'
        "</div>"
        '<div style="padding:28px;background:#FFF8F0;border:1px solid #F0DCC3;border-top:none">'
        '<p style="margin:0 0 12px;font-size:15px">Dear Media Partner,</p>'
        '<p style="margin:0 0 16px;font-size:15px">We are excited to welcome you to the official screening of <strong>BLACK MARKET</strong>.</p>'
        '<p style="margin:0 0 16px;font-size:14px">Please find your entry, parking and accreditation details below:</p>'
        '<div style="background:#ffffff;border:1px solid #F0DCC3;border-radius:10px;padding:18px;margin:0 0 14px">'
        '<h3 style="margin:0 0 10px;color:#C2410C;font-size:15px;letter-spacing:1px">MEDIA ACCREDITATION</h3>'
        '<p style="margin:4px 0;font-size:14px">Accreditation starts from <strong>1:00 PM</strong></p>'
        '<p style="margin:4px 0;font-size:14px">Media Entrance: <strong>Zone A</strong></p>'
        "</div>"
        '<div style="background:#ffffff;border:1px solid #F0DCC3;border-radius:10px;padding:18px;margin:0 0 14px">'
        '<h3 style="margin:0 0 10px;color:#C2410C;font-size:15px;letter-spacing:1px">ZONE A CAR PARKS</h3>'
        '<p style="margin:0 0 8px;font-size:14px">Media guests arriving through Zone A may use any of the following designated car parks:</p>'
        "<p style=\"margin:3px 0;font-size:14px;\">• <strong>Hassan Car Park</strong></p>"
        "<p style=\"margin:3px 0;font-size:14px;\">• <strong>Under Bridge Car Park</strong></p>"
        "<p style=\"margin:3px 0;font-size:14px;\">• <strong>Banquet Car Park</strong></p>"
        "<p style=\"margin:3px 0;font-size:14px;\">• <strong>Marquee Car Park</strong></p>"
        "<p style=\"margin:3px 0;font-size:14px;\">• <strong>Independence Car Park</strong></p>"
        "</div>"
        '<p style="margin:0 0 16px;font-size:14px">Upon arrival, please proceed to Zone A and make your way to the <strong>Media Accreditation Stand</strong>, where our team will be available to assist with accreditation, access, and any other needs you may have.</p>'
        '<div style="background:#2B1A12;border-radius:10px;padding:18px;margin:0 0 14px">'
        '<h3 style="margin:0 0 10px;color:#C2410C;font-size:15px;letter-spacing:1px">MEDIA ACCREDITATION CONTACTS</h3>'
        '<p style="margin:4px 0;font-size:14px;color:#FFF8F0"><strong>Adebola Adewale</strong>: +234 814 982 1974</p>'
        '<p style="margin:4px 0;font-size:14px;color:#FFF8F0"><strong>Korede Owolabani</strong>: +234 912 092 2785</p>'
        '<p style="margin:10px 0 0;font-size:13px;color:#FDBA74"><strong>Please Note:</strong> Adebola and Korede will be on ground from 1:00 PM to ensure a smooth accreditation and entry process for all accredited media personnel.</p>'
        "</div>"
        '<p style="margin:0 0 8px;font-size:14px">We look forward to welcoming you and having you join us for this special moment.</p>'
        '<p style="margin:0;font-size:15px;font-weight:bold;color:#C2410C">#WatchBlackMarket</p>'
        "</div>"
        '<div style="background:#2B1A12;color:#FDBA74;padding:20px;text-align:center;font-size:11px;font-family:Arial,sans-serif;border-radius:0 0 10px 10px">'
        '<p style="margin:0;letter-spacing:1px">ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>'
        "</div>"
        "</div>"
    )
    return subject, body, html


def _gala_shell(inner: str, tracking_pixel: str = "") -> str:
    """Black and gold email shell for The Art of Attention (event-scoped)."""
    return (
        '<div style="margin:0;padding:0;background:#050505">'
        '<div style="max-width:600px;margin:0 auto;background:#070707;'
        "font-family:Georgia,'Times New Roman',serif;color:#F3EDE2\">"
        '<div style="padding:30px 26px 20px;text-align:center;border-bottom:1px solid #3a3016">'
        '<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        'letter-spacing:4px;color:#C9A227;text-transform:uppercase">'
        "An Exclusive Lifestyle Gala</p>"
        '<p style="margin:0;font-size:24px;letter-spacing:7px;color:#F3EDE2">A GALA DINNER</p>'
        '<p style="margin:2px 0 0;font-size:24px;letter-spacing:7px;color:#F3EDE2">EXPERIENCE</p>'
        "</div>"
        f"{inner}"
        '<div style="background:#0b0b0b;padding:24px 26px;text-align:center;border-top:1px solid #3a3016">'
        '<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;'
        'letter-spacing:3px;color:#C9A227;text-transform:uppercase">Hosted by</p>'
        '<p style="margin:0 0 12px;font-size:14px;letter-spacing:2px;color:#F3EDE2">The Iconic Lifestyle Connoisseur</p>'
        '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        'letter-spacing:2px;color:#8d8271">ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>'
        "</div>"
        f"{tracking_pixel}"
        "</div></div>"
    )


def _gala_details_rows(content: dict, rows: list[tuple[str, str]]) -> str:
    cells = ""
    for label, value in rows:
        cells += (
            "<tr>"
            f'<td style="padding:7px 0;width:96px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;'
            f'font-size:10px;letter-spacing:2px;color:#C9A227;text-transform:uppercase">{label}</td>'
            f'<td style="padding:7px 0;font-size:14px;color:#F3EDE2;line-height:1.5">{value}</td>'
            "</tr>"
        )
    return f'<table style="width:100%;border-collapse:collapse;margin:0 0 6px">{cells}</table>'


def _build_gala_invite_message(
    guest: Guest,
    event: Event,
    flyer_url: str | None,
    qr_image_url: str | None = None,
    qr_url: str | None = None,
    message_id: int | None = None,
) -> tuple[str, str, str]:
    from app.api.event_registration import gala_content

    content = gala_content()
    venue = content["venue"]
    after = content["after_party"]
    dress = content["dress_code"]
    rsvp_link = invite_link_for(event, guest)
    banner = _absolute_url("/uploads/gala-banner.jpg")
    tracking_pixel = (
        f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />'
        if message_id
        else ""
    )

    subject = "You are invited: A Gala Dinner Experience"
    # One blank line between every block: WhatsApp collapses single newlines
    # into one paragraph, which is what stacked the details before.
    body = (
        f"Dear {guest.name},\n\n"
        "It is our pleasure to invite you to A Gala Dinner Experience at the Federal "
        "Palace Hotel: an evening of fine dining, live conversation and quiet power.\n\n"
        "Date: Wednesday, 2nd December, 2026\n\n"
        "Red Carpet: 5:00 PM prompt\n\n"
        f"Venue: {venue['name']}, {venue['room']}, {venue['location']}\n\n"
        f"Dress Code: {dress['style']}\n\n"
        f"After Party: {after['venue']}\n\n"
        "After dinner, a short reading marks the launch of The Art of Attention.\n\n"
        "Your invitation admits two: you and one companion.\n\n"
        f"Kindly reserve your seat: {rsvp_link}\n\n"
        f"Hosted by: {content['host']}"
    )

    rows = _gala_details_rows(
        content,
        [
            ("Date", "Wednesday, 2nd December, 2026"),
            ("Red Carpet", "5:00 PM prompt"),
            ("Venue", f"{venue['name']}<br/>{venue['room']}<br/>{venue['location']}"),
            ("Dress Code", dress["style"]),
            ("After Party", after["venue"]),
        ],
    )

    inner = (
        f'<img src="{banner}" alt="A Gala Dinner Experience" width="600" '
        'style="width:100%;max-width:600px;height:auto;display:block;border:0" />'
        '<div style="padding:30px 28px 8px">'
        f'<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#F3EDE2">Dear {guest.name},</p>'
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#cfc6b6">'
        "It is our pleasure to invite you to <span style=\"color:#F3EDE2\">A Gala Dinner Experience</span> "
        "at the Federal Palace Hotel: an evening of fine dining, live conversation and quiet power."
        "</p>"
        '<p style="margin:0 0 22px;font-size:15px;line-height:1.75;color:#cfc6b6">'
        "A seated dinner in the Balmoral Convention Centre, a room of good company, "
        "and a night that continues at Proxy Lagos."
        "</p>"
        '<div style="height:1px;background:#3a3016;margin:0 0 18px"></div>'
        f"{rows}"
        '<p style="margin:14px 0 0;font-size:13px;line-height:1.7;color:#8d8271;font-style:italic">'
        "After dinner, a short reading marks the launch of The Art of Attention."
        "</p>"
        '<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        'letter-spacing:2px;color:#C9A227;text-transform:uppercase">'
        "Your invitation admits two: you and one companion"
        "</p>"
        '<div style="text-align:center;margin:26px 0 8px">'
        f'<a href="{rsvp_link}" style="display:inline-block;background:#C9A227;color:#0a0a0a;'
        "padding:15px 46px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;"
        'font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">RSVP</a>'
        "</div>"
        '<p style="margin:0 0 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;'
        'font-size:10px;letter-spacing:2px;color:#8d8271">KINDLY RESERVE YOUR SEAT</p>'
        "</div>"
    )

    return subject, body, _gala_shell(inner, tracking_pixel)


def _build_gala_qr_message(
    guest: Guest,
    event: Event,
    qr_image_url: str | None,
    flyer_url: str | None = None,
) -> tuple[str, str, str]:
    from app.api.event_registration import gala_content

    content = gala_content()
    venue = content["venue"]
    dress = content["dress_code"]
    after = content["after_party"]
    rsvp_link = f"{settings.FRONTEND_URL}/rsvp/{guest.rsvp_token}"

    # A gala guest may bring one companion on the same pass, so the pass wording
    # follows the guest's own registration instead of a fixed "admits one".
    party = getattr(guest, "custom_data", None) or {}
    if isinstance(party, str):
        try:
            import json as _json
            party = _json.loads(party)
        except Exception:
            party = {}
    if not isinstance(party, dict):
        party = {}
    companion = (party.get("plus_one_name") or "").strip()
    admits_two = bool(party.get("plus_one")) or party.get("party_size") == 2
    admits_label = "THIS PASS ADMITS TWO GUESTS" if admits_two else "THIS PASS ADMITS ONE GUEST"
    if admits_two and companion:
        admits_line = f"This pass admits two guests: you and {companion}."
    elif admits_two:
        admits_line = "This pass admits two guests: you and one companion."
    else:
        admits_line = "This pass admits one guest."

    subject = "Your Entry Pass: A Gala Dinner Experience"
    body = (
        f"Dear {guest.name},\n\n"
        "Your entry pass for A Gala Dinner Experience is enclosed. Please present the QR code "
        "at the red carpet for accreditation.\n\n"
        "Date: Wednesday, 2nd December, 2026\n\n"
        "Red Carpet: 5:00 PM prompt\n\n"
        f"Venue: {venue['name']}, {venue['room']}, {venue['location']}.\n\n"
        f"Dress Code: {dress['style']}\n\n"
        f"After Party: {after['venue']}\n\n"
        f"{admits_line}\n\n"
        f"View your pass: {rsvp_link}\n\n"
        f"Hosted by: {content['host']}"
    )

    absolute_qr = _absolute_url(qr_image_url) if qr_image_url else None
    if absolute_qr:
        qr_block = (
            '<div style="text-align:center;padding:8px 0 18px">'
            '<div style="display:inline-block;background:#F3EDE2;padding:18px;border:1px solid #C9A227">'
            f'<img src="{absolute_qr}" alt="Entry QR Code" width="220" height="220" '
            'style="width:220px;height:220px;display:block;border:0" />'
            '<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;'
            'letter-spacing:2px;color:#6b5c3a;text-transform:uppercase">Scan at the red carpet</p>'
            "</div>"
            f'<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
            f'letter-spacing:2px;color:#8d8271">{admits_label}</p>'
            + (
                '<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
                f'letter-spacing:2px;color:#C9A227;text-transform:uppercase">WITH {companion}</p>'
                if admits_two and companion
                else ""
            )
            + "</div>"
        )
    else:
        qr_block = (
            '<p style="padding:14px;border:1px dashed #C9A227;text-align:center;color:#F3EDE2;'
            'font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px">'
            "Your QR entry pass is attached to this email</p>"
        )

    rows = _gala_details_rows(
        content,
        [
            ("Date", "Wednesday, 2nd December, 2026"),
            ("Red Carpet", "5:00 PM prompt"),
            ("Venue", f"{venue['name']}<br/>{venue['room']}<br/>{venue['location']}"),
            ("Dress Code", dress["style"]),
            ("After Party", after["venue"]),
        ],
    )

    inner = (
        '<div style="padding:30px 28px 8px">'
        '<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        'letter-spacing:4px;color:#C9A227;text-transform:uppercase;text-align:center">Your Entry Pass</p>'
        f'<p style="margin:0 0 16px;text-align:center;font-size:22px;letter-spacing:2px;color:#F3EDE2">{guest.name}</p>'
        f"{qr_block}"
        '<div style="height:1px;background:#3a3016;margin:6px 0 18px"></div>'
        f"{rows}"
        '<p style="margin:16px 0 26px;font-size:14px;line-height:1.7;color:#cfc6b6">'
        "We look forward to welcoming you at the red carpet. Please arrive promptly."
        "</p>"
        "</div>"
    )

    return subject, body, _gala_shell(inner)


# ── Engr. Obi & Dr. Blessing 30th anniversary (event 84 only) ──
# Aubergine, lavender and cream taken from the client's own flier, with the
# client's banner as the header image. Scoped to the anniversary slug.
#
# The couple's names come from their printed invitation, confirmed in writing by
# the client on 2026-10-26: "Engr. Obi & Dr. Blessing". No family surname is
# used anywhere, because the artwork names the couple only.

ANNIV_INK = "#171021"
ANNIV_AUBERGINE = "#241B33"
ANNIV_LAV = "#C3B2DE"
ANNIV_CREAM = "#FAF6EF"
ANNIV_COUPLE = "Engr. Obi & Dr. Blessing"
ANNIV_COUPLE_HTML = "Engr. Obi &amp; Dr. Blessing"


def _anniv_shell(inner: str, tracking_pixel: str = "") -> str:
    return (
        f'<div style="margin:0;padding:0;background:{ANNIV_INK}">'
        f'<div style="max-width:600px;margin:0 auto;background:{ANNIV_AUBERGINE};'
        "font-family:Georgia,'Times New Roman',serif;color:" + ANNIV_CREAM + '">'
        '<div style="padding:28px 26px 20px;text-align:center;border-bottom:1px solid rgba(195,178,222,0.28)">'
        '<p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:9px;'
        f'letter-spacing:5px;color:{ANNIV_LAV};text-transform:uppercase">Together since 1996</p>'
        f'<p style="margin:0;font-size:26px;letter-spacing:2px;color:{ANNIV_CREAM}">{ANNIV_COUPLE_HTML}</p>'
        '<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{ANNIV_LAV};text-transform:uppercase">30th Wedding Anniversary</p>'
        "</div>"
        f"{inner}"
        '<div style="background:#1B1526;padding:22px 26px;text-align:center;border-top:1px solid rgba(195,178,222,0.22)">'
        '<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;'
        f'letter-spacing:4px;color:{ANNIV_LAV};text-transform:uppercase">With love</p>'
        f'<p style="margin:0 0 14px;font-size:15px;letter-spacing:1px;color:{ANNIV_CREAM}">{ANNIV_COUPLE_HTML}</p>'
        '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:2px;color:#8b7fa3">ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>'
        "</div>"
        f"{tracking_pixel}"
        "</div></div>"
    )


def _anniv_details_rows(rows: list[tuple[str, str]]) -> str:
    cells = ""
    for label, value in rows:
        cells += (
            "<tr>"
            f'<td style="padding:7px 0;width:96px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;'
            f'font-size:10px;letter-spacing:2px;color:{ANNIV_LAV};text-transform:uppercase">{label}</td>'
            f'<td style="padding:7px 0;font-size:14px;color:{ANNIV_CREAM};line-height:1.5">{value}</td>'
            "</tr>"
        )
    return f'<table style="width:100%;border-collapse:collapse;margin:0 0 6px">{cells}</table>'


def _anniv_rows(content: dict) -> list[tuple[str, str]]:
    ceremony = content["ceremony"]
    dress = content["dress_code"]
    return [
        ("Date", ceremony["date"]),
        ("Time", f"{ceremony['time']} (WAT)"),
        ("Venue", f"{ceremony['venue']}<br/>{ceremony['location']}"),
        ("Dress", dress.get("theme") or "Elegant"),
    ]


def _anniv_party(guest: Guest) -> tuple[int, str]:
    """How many this pass admits, and the companion's name if there is one."""
    data = getattr(guest, "custom_data", None) or {}
    name = (data.get("plus_one_name") or "").strip()
    if data.get("plus_one") or data.get("party_size") == 2:
        return 2, name
    return 1, ""


def _build_anniv_invite_message(
    guest: Guest,
    event: Event,
    flyer_url: str | None,
    qr_image_url: str | None = None,
    qr_url: str | None = None,
    message_id: int | None = None,
) -> tuple[str, str, str]:
    from app.api.event_registration import anniversary_content

    content = anniversary_content()
    ceremony = content["ceremony"]
    dress = content["dress_code"]
    rsvp_link = invite_link_for(event, guest)
    banner = _absolute_url("/uploads/anniversary-banner.jpg")
    tracking_pixel = (
        f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />'
        if message_id
        else ""
    )

    subject = f"You are invited: {ANNIV_COUPLE} 30th Wedding Anniversary"
    party_note = (content.get("plus_one") or {}).get("note") or (
        "Your invitation admits two: you and one companion."
    )
    body = (
        f"Dear {guest.name},\n\n"
        "With hearts full of gratitude, Engr. Obi and Dr. Blessing invite you to "
        "celebrate thirty years of love, laughter and lifelong companionship.\n\n"
        f"Date: {ceremony['date']}\n\n"
        f"Time: {ceremony['time']} (WAT)\n\n"
        f"Venue: {ceremony['venue']}, {ceremony['location']}\n\n"
        f"Dress Code: {dress.get('theme') or 'Elegant'}\n\n"
        f"{party_note}\n\n"
        f"Kindly confirm your seat: {rsvp_link}\n\n"
        f"With love,\n{ANNIV_COUPLE}"
    )

    rows = _anniv_details_rows(_anniv_rows(content))

    inner = (
        f'<img src="{banner}" alt="{ANNIV_COUPLE}, thirty years" width="600" '
        'style="width:100%;max-width:600px;height:auto;display:block;border:0" />'
        '<div style="padding:30px 28px 8px">'
        f'<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:{ANNIV_CREAM}">Dear {guest.name},</p>'
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#cfc6d9">'
        "With hearts full of gratitude, we invite you to celebrate "
        f'<span style="color:{ANNIV_CREAM}">thirty years of love, laughter and lifelong companionship</span> '
        "with Engr. Obi and Dr. Blessing."
        "</p>"
        '<p style="margin:0 0 22px;font-size:15px;line-height:1.75;color:#cfc6d9">'
        "An afternoon of thanksgiving, good food and the company of family and friends, "
        "marking three decades since they said I do."
        "</p>"
        '<div style="height:1px;background:rgba(195,178,222,0.28);margin:0 0 18px"></div>'
        f"{rows}"
        '<p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:#a396bd;font-style:italic">'
        f"{dress.get('note') or 'Come dressed to celebrate thirty years with us.'}"
        "</p>"
        '<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;'
        f'line-height:1.7;letter-spacing:1px;color:{ANNIV_LAV}">{party_note}</p>'
        '<div style="text-align:center;margin:26px 0 8px">'
        f'<a href="{rsvp_link}" style="display:inline-block;background:{ANNIV_LAV};color:#241B33;'
        "padding:15px 44px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;"
        'font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">RSVP</a>'
        "</div>"
        '<p style="margin:0 0 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;'
        'font-size:10px;letter-spacing:2px;color:#8b7fa3">KINDLY CONFIRM YOUR SEAT</p>'
        "</div>"
    )

    return subject, body, _anniv_shell(inner, tracking_pixel)


def _build_anniv_qr_message(
    guest: Guest,
    event: Event,
    qr_image_url: str | None,
    flyer_url: str | None = None,
) -> tuple[str, str, str]:
    from app.api.event_registration import anniversary_content

    content = anniversary_content()
    ceremony = content["ceremony"]
    dress = content["dress_code"]
    rsvp_link = f"{settings.FRONTEND_URL}/rsvp/{guest.rsvp_token}"
    party_size, companion = _anniv_party(guest)
    admits_text = (
        f"This pass admits two guests: you and {companion}."
        if party_size == 2 and companion
        else "This pass admits two guests: you and one companion."
        if party_size == 2
        else "This pass admits one guest."
    )

    subject = f"Your Entry Pass: {ANNIV_COUPLE} 30th Wedding Anniversary"
    body = (
        f"Dear {guest.name},\n\n"
        "Your entry pass for the Engr. Obi and Dr. Blessing 30th Wedding Anniversary "
        "is enclosed. Please present the QR code at the door for accreditation.\n\n"
        f"Date: {ceremony['date']}\n\n"
        f"Time: {ceremony['time']} (WAT)\n\n"
        f"Venue: {ceremony['venue']}, {ceremony['location']}\n\n"
        f"Dress Code: {dress.get('theme') or 'Elegant'}\n\n"
        f"{admits_text}\n\n"
        f"View your pass: {rsvp_link}\n\n"
        f"With love,\n{ANNIV_COUPLE}"
    )

    absolute_qr = _absolute_url(qr_image_url) if qr_image_url else None
    if absolute_qr:
        qr_block = (
            '<div style="text-align:center;padding:8px 0 18px">'
            f'<div style="display:inline-block;background:{ANNIV_CREAM};padding:18px;'
            f'border:1px solid {ANNIV_LAV}">'
            f'<img src="{absolute_qr}" alt="Entry QR Code" width="220" height="220" '
            'style="width:220px;height:220px;display:block;border:0" />'
            '<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:9px;'
            'letter-spacing:2px;color:#5d4b7a;text-transform:uppercase">Scan at the door</p>'
            "</div>"
            '<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
            f'letter-spacing:2px;color:#8b7fa3">'
            f"{'THIS PASS ADMITS TWO GUESTS' if party_size == 2 else 'THIS PASS ADMITS ONE GUEST'}</p>"
            + (
                '<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
                f'letter-spacing:2px;color:{ANNIV_CREAM};text-transform:uppercase">'
                f"WITH {companion or 'ONE COMPANION'}</p>"
                if party_size == 2
                else ""
            )
            + "</div>"
        )
    else:
        qr_block = (
            f'<p style="padding:14px;border:1px dashed {ANNIV_LAV};text-align:center;color:{ANNIV_CREAM};'
            'font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:1px">'
            "Your QR entry pass is attached to this email</p>"
        )

    rows = _anniv_details_rows(_anniv_rows(content))

    inner = (
        '<div style="padding:30px 28px 8px">'
        '<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{ANNIV_LAV};text-transform:uppercase;text-align:center">Your Entry Pass</p>'
        f'<p style="margin:0 0 16px;text-align:center;font-size:22px;letter-spacing:1px;color:{ANNIV_CREAM}">{guest.name}</p>'
        f"{qr_block}"
        '<div style="height:1px;background:rgba(195,178,222,0.28);margin:6px 0 18px"></div>'
        f"{rows}"
        '<p style="margin:16px 0 26px;font-size:14px;line-height:1.7;color:#cfc6d9">'
        "We look forward to welcoming you. Please arrive promptly and have this pass ready at the door."
        "</p>"
        "</div>"
    )

    return subject, body, _anniv_shell(inner)


def _build_invite_message(
    guest: Guest, event: Event,
    qr_url: str | None = None,
    flyer_url: str | None = None,
    qr_image_url: str | None = None,
    message_id: int | None = None,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> tuple[str, str, str]:
    # Media guests on BLACK MARKET (event 77 only) get the media accreditation
    # template: no QR, the MEDIA badge is the entry pass. Explicit custom
    # subject/body still wins when provided.
    _is_bm = (getattr(event, "id", None) == 77) or (
        event.title == "BLACK MARKET Movie World Record Attempt"
    )
    if _is_bm and (guest.category or "").strip().lower() == "media" and not custom_subject and not custom_body:
        return _build_media_invite_message(guest, event)

    # Post-event thank you (opt in per event). Checked before every invite shell
    # because an invite design carries a date table, an entry code and an RSVP
    # call to action, none of which make sense once the event has happened.
    if getattr(event, "thank_you_mode", False):
        if getattr(event, "id", None) == 78:
            return _build_mobola_thankyou_message(
                guest, event, flyer_url, message_id=message_id,
                custom_subject=custom_subject, custom_body=custom_body,
            )
        return _build_thankyou_message(
            guest, event, flyer_url, message_id=message_id,
            custom_subject=custom_subject, custom_body=custom_body,
        )

    from app.api.event_registration import is_gala_event as _is_gala, is_anniversary_event as _is_anniv, is_anchor_event as _is_anchor

    # Anchor Evening of Bliss (event 85 only): the client supplied the wording,
    # so their invitation goes out as written with the guest's own RSVP link.
    if _is_anchor(event) and not custom_subject and not custom_body:
        return _build_anchor_invite_message(
            guest, event, invite_link_for(event, guest), flyer_url=flyer_url
        )
    if _is_anniv(event) and not custom_subject and not custom_body:
        return _build_anniv_invite_message(
            guest, event, flyer_url, qr_image_url=qr_image_url, qr_url=qr_url, message_id=message_id
        )
    if _is_gala(event) and not custom_subject and not custom_body:
        return _build_gala_invite_message(
            guest, event, flyer_url, qr_image_url=qr_image_url, qr_url=qr_url, message_id=message_id
        )
    # Mobola's BIG 10 (event 78 only): designed cream and gold reminder with the
    # estate gate code lifted into its own block. Her saved copy still drives the
    # words; only the presentation is event specific.
    if getattr(event, "id", None) == 78:
        return _build_mobola_invite_message(
            guest,
            event,
            flyer_url,
            qr_image_url=qr_image_url,
            qr_url=qr_url,
            message_id=message_id,
            custom_subject=custom_subject,
            custom_body=custom_body,
        )
    if _is_annette_event(event):
        # Annette's BIG 40 (event 72): deep plum and copper black tie design
        # built from the client's own portrait. The dashboard copy still drives
        # the words, the shell only dresses them.
        return _build_annette_invite_message(
            guest,
            event,
            flyer_url,
            qr_image_url=qr_image_url,
            qr_url=qr_url,
            message_id=message_id,
            custom_subject=custom_subject,
            custom_body=custom_body,
        )
    rsvp_link = invite_link_for(event, guest)
    subject = custom_subject or event.invite_subject or f"You're Invited: {event.title}"
    invitation_text = custom_body or event.invite_body or event.description or "You're invited!"
    from datetime import date as dt_date, time as dt_time
    formatted_date = _format_date(event.event_date)
    formatted_time = _format_time(event.event_time, event.timezone or "WAT")
    def _fill_vars(text: str) -> str:
        return (
            text.replace("{{ guest_name }}", guest.name or "")
            .replace("{{ event_title }}", event.title or "")
            .replace("{{ event_date }}", str(formatted_date))
            .replace("{{ event_time }}", str(formatted_time))
            .replace("{{ venue }}", event.venue or "")
            .replace("{{ rsvp_link }}", rsvp_link)
            .replace("{{ host_name }}", event.host_name or "")
            .replace("{{ dress_code }}", event.dress_code or "")
            .replace("{guest name}", guest.name or "")
        )
    invitation_text = _fill_vars(invitation_text)
    subject = _fill_vars(subject)
    body = (
        f"{invitation_text}\n\n"
        f"Date: {formatted_date}\n"
        f"Time: {formatted_time}\n"
        f"Venue: {event.venue}\n"
        f"Dress Code: {event.dress_code or 'Any'}\n\n"
        f"RSVP: {rsvp_link}\n"
        f"{f'Your unique QR code: {qr_url}\n' if qr_url else ''}"
        f"{f'\n{event.host_name}' if event.host_name else ''}"
    )
    qr_html = ""
    if qr_image_url:
        absolute_qr = _absolute_url(qr_image_url)
        if absolute_qr:
            qr_html = f"""
        <div style="text-align:center;padding:16px;background:#f8f9fc;border-radius:12px;margin:16px 0">
            <p style="color:#23466f;font-size:13px;font-weight:bold;margin:0 0 12px">YOUR UNIQUE ENTRY CODE</p>
            <img src="{absolute_qr}" alt="Entry QR Code" style="width:180px;height:180px;display:block;margin:0 auto" />
            <p style="color:#94a3b8;font-size:11px;margin:8px 0 0">Show this code at the venue entrance</p>
        </div>"""
    elif qr_url:
        qr_html = (
            f'<p style="padding:14px;border:1px dashed #94a3b8;border-radius:12px;text-align:center">Your unique QR access code is attached to this email</p>'
        )
    flyer_html = ""
    if flyer_url:
        absolute_flyer = _absolute_url(flyer_url)
        if absolute_flyer:
            flyer_html = f'<img src="{absolute_flyer}" alt="{event.title}" style="width:100%;max-width:600px;max-height:400px;height:auto;display:block;border-radius:0" />'
    host_section = f'<p style="margin:0 0 4px;font-size:14px;font-weight:bold;color:#fff">Hosted by {event.host_name}</p>' if event.host_name else ''

    # Build dress code section
    dress_code_section = ''
    if event.dress_code:
        dress_code_section = '<tr><td colspan="2" style="padding:12px 0 8px;border-top:1px solid #e8edf2;font-size:12px;color:#888;font-weight:bold;text-transform:uppercase;letter-spacing:1px">DRESS CODE: ' + event.dress_code + '</td></tr>'

    dress_code_row = ''
    female_row = ''
    male_row = ''
    tracking_pixel = f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />' if message_id else ''
    rsvp_btn_color = getattr(event, "theme_color", None) or "#1ABC9C"
    html = (
        '<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#1a1a2e">'
        f'{flyer_html}'
        '<div style="padding:32px 28px;background:#ffffff">'
        f'<h1 style="font-size:28px;color:#07182f;margin:0 0 16px;line-height:1.2">{event.title}</h1>'
        f'<p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 20px">{invitation_text.replace(chr(10), "<br>")}</p>'
        '<table style="width:100%;border-collapse:collapse;margin:0 0 24px">'
        f'<tr><td style="padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top">DATE</td><td style="padding:8px 0;font-size:14px;font-weight:bold">{formatted_date}</td></tr>'
        f'<tr><td style="padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top">TIME</td><td style="padding:8px 0;font-size:14px;font-weight:bold">{formatted_time}</td></tr>'
        f'<tr><td style="padding:8px 0;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1px;width:100px;vertical-align:top">VENUE</td><td style="padding:8px 0;font-size:14px;font-weight:bold">{event.venue}</td></tr>'
        f'{dress_code_section}'
        '</table>'
        f'<div style="text-align:center;margin:24px 0">'
        f'<a href="{rsvp_link}" style="display:inline-block;background:{rsvp_btn_color};color:#fff;padding:14px 40px;border-radius:50px;text-decoration:none;font-weight:bold;font-size:15px;font-family:Arial,sans-serif">RSVP NOW</a>'
        '</div>'
        f'{qr_html}'
        '</div>'
        '<div style="background:#07182f;color:#d9e8f7;padding:24px;text-align:center;font-size:12px;font-family:Arial,sans-serif">'
        f'{host_section}'
        '<p style="margin:0;letter-spacing:1px">ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>'
        '</div>'
        f'{tracking_pixel}'
        '</div>'
    )
    return subject, body, html


MOBOLA_GOLD = "#C9A227"
MOBOLA_CREAM = "#FFF7EC"
MOBOLA_COCOA = "#2E2013"
MOBOLA_BROWN = "#5A4632"


def _mobola_copy_blocks(event: Event, custom_body: str | None = None) -> tuple[list[str], str, str]:
    """Split the organizer's saved reminder into prose, gate code and gate note.

    Date/time/venue lines, the greeting and the sign-off are lifted out of the
    prose because the designed template renders them as a details table, its own
    greeting and its own signature. The gate code line becomes a standalone
    block so guests read it as the real code and not as part of a sentence.
    """
    raw = (custom_body or event.invite_body or "").strip()
    gate_code = ""
    gate_note = ""
    paragraphs: list[str] = []

    for block in [b.strip() for b in raw.replace("\r\n", "\n").split("\n\n") if b.strip()]:
        kept: list[str] = []
        for line in [ln.strip() for ln in block.split("\n") if ln.strip()]:
            upper = line.upper()
            if upper.startswith("DEAR "):
                continue
            if upper.startswith("DATE:") or upper.startswith("TIME:") or upper.startswith("VENUE:"):
                continue
            if upper.startswith("ESTATE GATE CODE:"):
                gate_code = line.split(":", 1)[1].strip()
                continue
            if gate_code and not gate_note and upper.startswith("PLEASE MENTION"):
                gate_note = line
                continue
            if line.lower().rstrip(",") in ("with love", "team mobola"):
                continue
            kept.append(line)
        if kept:
            paragraphs.append(" ".join(kept))

    if not gate_code:
        gate_code = "Mobola's party"
    if not gate_note:
        gate_note = f'Please mention "{gate_code}" at the estate gate to be let in. Keep the code handy!'
    if not paragraphs:
        paragraphs = [
            "The countdown is officially OVER! This is your big reminder that MOBOLA'S BIG 10 "
            "birthday party is happening THIS Saturday, and you do not want to miss it!",
            "Come ready to eat, dance, and celebrate our birthday girl in grand style. See you on Saturday!",
        ]
    return paragraphs, gate_code, gate_note


def _build_mobola_invite_message(
    guest: Guest,
    event: Event,
    flyer_url: str | None,
    qr_image_url: str | None = None,
    qr_url: str | None = None,
    message_id: int | None = None,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> tuple[str, str, str]:
    """Designed cream and gold reminder for Mobola's BIG 10 (event 78 only).

    The organizer's saved reminder stays editable in the dashboard: whatever she
    writes is rendered inside this designed shell, with the estate gate code
    always pulled out into its own high contrast block.
    """
    rsvp_link = f"{settings.FRONTEND_URL}/rsvp/{guest.rsvp_token}"
    formatted_date = _format_date(event.event_date)
    formatted_time = _format_time(event.event_time, event.timezone or "WAT")
    # Match the client's copy: "Saturday, October 24, 2026" and "1:00 PM (WAT)".
    date_parts = str(formatted_date).split(" ", 1)
    if len(date_parts) == 2 and date_parts[0].endswith("day"):
        formatted_date = f"{date_parts[0]}, {date_parts[1]}"
    time_parts = str(formatted_time).split(" ", 1)
    if len(time_parts) == 2 and time_parts[0].isdigit():
        formatted_time = f"{time_parts[0]}:00 {time_parts[1]}"
    venue = event.venue or ""

    def _fill(text: str) -> str:
        return (
            text.replace("{{ guest_name }}", guest.name or "")
            .replace("{{ event_title }}", event.title or "")
            .replace("{{ event_date }}", str(formatted_date))
            .replace("{{ event_time }}", str(formatted_time))
            .replace("{{ venue }}", venue)
            .replace("{{ rsvp_link }}", rsvp_link)
            .replace("{{ host_name }}", event.host_name or "")
            .replace("{{ dress_code }}", event.dress_code or "")
            .replace("{guest name}", guest.name or "")
        )

    subject = _fill(custom_subject or event.invite_subject or f"Reminder: {event.title}")
    paragraphs, gate_code, gate_note = _mobola_copy_blocks(event, custom_body)
    paragraphs = [_fill(p) for p in paragraphs]
    gate_code = _fill(gate_code)
    gate_note = _fill(gate_note)

    body = (
        f"Dear {guest.name},\n\n"
        + "\n\n".join(paragraphs)
        + "\n\n"
        f"Date: {formatted_date}\n"
        f"Time: {formatted_time}\n"
        f"Venue: {venue}\n\n"
        f"ESTATE GATE CODE: {gate_code}\n\n"
        f"{gate_note}\n\n"
        f"RSVP: {rsvp_link}\n\n"
        "With love,\nTeam Mobola"
    )

    absolute_flyer = _absolute_url(flyer_url) if flyer_url else None
    photo_html = (
        f'<img src="{absolute_flyer}" alt="Mobola\'s BIG 10" width="600" '
        'style="width:100%;max-width:600px;height:auto;display:block;border:0" />'
        if absolute_flyer
        else ""
    )
    paras_html = "".join(
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.8;'
        f'color:{MOBOLA_BROWN}">{p}</p>'
        for p in paragraphs
    )
    rows_html = "".join(
        "<tr>"
        f'<td style="padding:9px 0;width:86px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:10px;letter-spacing:2px;color:{MOBOLA_GOLD};text-transform:uppercase">{label}</td>'
        f'<td style="padding:9px 0;font-size:15px;color:{MOBOLA_COCOA};line-height:1.5;font-weight:bold">{value}</td>'
        "</tr>"
        for label, value in (
            ("Date", formatted_date),
            ("Time", formatted_time),
            ("Venue", venue),
        )
        if value
    )
    gate_html = (
        f'<div style="margin:0 28px 26px;padding:26px 22px;border:2px solid {MOBOLA_GOLD};'
        f'border-radius:14px;background:{MOBOLA_COCOA};text-align:center">'
        f'<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{MOBOLA_GOLD};text-transform:uppercase">ESTATE GATE CODE</p>'
        f'<p style="margin:0;font-size:30px;line-height:1.2;color:{MOBOLA_CREAM};letter-spacing:1px">'
        f"{gate_code}</p>"
        f'<p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;'
        f'line-height:1.7;color:#E4D2AE">{gate_note}</p>'
        "</div>"
    )
    qr_html = ""
    if qr_image_url:
        absolute_qr = _absolute_url(qr_image_url)
        if absolute_qr:
            qr_html = (
                '<div style="text-align:center;padding:18px;margin:0 28px 24px;'
                f'background:#ffffff;border:1px solid {MOBOLA_GOLD};border-radius:12px">'
                f'<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
                f'letter-spacing:3px;color:{MOBOLA_GOLD};text-transform:uppercase">Your entry code</p>'
                f'<img src="{absolute_qr}" alt="Entry QR Code" width="180" height="180" '
                'style="display:block;margin:0 auto;width:180px;height:180px" />'
                "</div>"
            )
    tracking_pixel = (
        f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />'
        if message_id
        else ""
    )

    html = (
        f'<div style="margin:0;padding:0;background:{MOBOLA_CREAM}">'
        f'<div style="max-width:600px;margin:0 auto;background:{MOBOLA_CREAM};'
        "font-family:Georgia,'Times New Roman',serif\">"
        f"{photo_html}"
        f'<div style="background:{MOBOLA_COCOA};padding:26px 26px 24px;text-align:center">'
        f'<p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{MOBOLA_GOLD};text-transform:uppercase">You are invited</p>'
        f'<p style="margin:0;font-size:34px;line-height:1.1;letter-spacing:3px;color:{MOBOLA_CREAM}">'
        "MOBOLA'S</p>"
        f'<p style="margin:4px 0 0;font-size:19px;letter-spacing:7px;color:{MOBOLA_GOLD}">BIG 10</p>'
        "</div>"
        '<div style="padding:30px 28px 6px">'
        f'<p style="margin:0 0 18px;font-size:17px;color:{MOBOLA_COCOA}">Dear {guest.name},</p>'
        f"{paras_html}"
        "</div>"
        f'<div style="margin:0 28px 22px;padding:18px 22px;background:#FFFFFF;'
        f'border-left:3px solid {MOBOLA_GOLD};border-radius:8px">'
        f'<table style="width:100%;border-collapse:collapse">{rows_html}</table>'
        "</div>"
        f"{gate_html}"
        '<div style="text-align:center;padding:0 28px 6px">'
        f'<a href="{rsvp_link}" style="display:inline-block;background:{MOBOLA_GOLD};color:{MOBOLA_COCOA};'
        "padding:15px 44px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;"
        'font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">Reserve your seat</a>'
        "</div>"
        f"{qr_html}"
        '<div style="padding:26px 28px 30px;text-align:center">'
        f'<p style="margin:0 0 4px;font-size:13px;color:{MOBOLA_BROWN}">With love,</p>'
        f'<p style="margin:0;font-size:19px;color:{MOBOLA_COCOA}">Team Mobola</p>'
        "</div>"
        f'<div style="background:{MOBOLA_COCOA};padding:22px;text-align:center">'
        f'<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:3px;color:{MOBOLA_GOLD}">ACCREDIT INTERACTIVE</p>'
        '<p style="margin:7px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#8B7A5F">'
        "Premium Event Infrastructure</p>"
        "</div>"
        f"{tracking_pixel}"
        "</div></div>"
    )
    return subject, body, html


# ── Annette's BIG 40 (event 72 only) ──
# Colours lifted from the client's own portrait: deep plum, violet grey,
# copper and champagne. Black tie is a dark, dressed mail, not the platform
# default white template. The words still come from the dashboard save box.

ANNETTE_INK = "#241A1E"
ANNETTE_PLUM = "#403F54"
ANNETTE_COPPER = "#B87254"
ANNETTE_CHAMPAGNE = "#DDC7B3"
ANNETTE_CREAM = "#F7EFE7"
ANNETTE_TEXT = "#3A2A2E"
ANNETTE_SIGNOFF = ("Warm regards", "The BIG 40 Team")


def _is_annette_event(event: Event) -> bool:
    if getattr(event, "id", None) == 72:
        return True
    return (getattr(event, "slug", None) or "").strip().lower() == "annettes-big-40"


def _annette_details(event: Event) -> list[tuple[str, str]]:
    """Date, time, venue and dress code, formatted for a black tie mail."""
    formatted_date = str(_format_date(event.event_date))
    date_parts = formatted_date.split(" ", 1)
    if len(date_parts) == 2 and date_parts[0].endswith("day"):
        formatted_date = f"{date_parts[0]}, {date_parts[1]}"
    formatted_time = str(_format_time(event.event_time, event.timezone or "WAT"))
    time_parts = formatted_time.split(" ", 1)
    if len(time_parts) == 2 and time_parts[0].isdigit():
        formatted_time = f"{time_parts[0]}:00 {time_parts[1]}"
    return [
        ("Date", formatted_date),
        ("Time", formatted_time),
        ("Venue", event.venue or ""),
        ("Dress Code", event.dress_code or "Elegant"),
    ]


def _annette_copy_blocks(event: Event, custom_body: str | None = None) -> list[str]:
    """Turn the organizer's saved reminder into paragraphs for the shell.

    The greeting, the date/time/venue/dress lines and the sign off are lifted
    out because the design prints its own. Everything the host wrote in
    between survives word for word.
    """
    raw = (custom_body or event.invite_body or "").strip()
    paragraphs: list[str] = []
    for block in [b.strip() for b in raw.replace("\r\n", "\n").split("\n\n") if b.strip()]:
        kept: list[str] = []
        for line in [ln.strip() for ln in block.split("\n") if ln.strip()]:
            upper = line.upper()
            if upper.startswith("DEAR "):
                continue
            if upper.startswith(("DATE:", "TIME:", "VENUE:", "DRESS CODE:")):
                continue
            if line.lower().rstrip(",") in ("warm regards", "kind regards", "the big 40 team", "team annette"):
                continue
            kept.append(line)
        if kept:
            paragraphs.append(" ".join(kept))
    if not paragraphs:
        paragraphs = [
            "A gentle reminder that Annette's BIG 40, hosted by Ushbebe, takes place this Friday.",
        ]
    return paragraphs


def _annette_shell(inner: str, tracking_pixel: str = "") -> str:
    return (
        f'<div style="margin:0;padding:0;background:{ANNETTE_INK}">'
        f'<div style="max-width:600px;margin:0 auto;background:{ANNETTE_CREAM};'
        "font-family:Georgia,'Times New Roman',serif;color:" + ANNETTE_TEXT + '">'
        f"{inner}"
        f'<div style="background:{ANNETTE_INK};padding:22px 26px;text-align:center">'
        '<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:9px;'
        f'letter-spacing:4px;color:{ANNETTE_COPPER};text-transform:uppercase">Accredit Interactive</p>'
        '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        'letter-spacing:2px;color:#9A8388">Premium Event Infrastructure</p>'
        "</div>"
        f"{tracking_pixel}"
        "</div></div>"
    )


def _annette_title_band(event: Event) -> str:
    host = (event.host_name or "").strip()
    eyebrow = f"Hosted by {host}" if host else "You are invited"
    return (
        f'<div style="background:{ANNETTE_INK};padding:26px 26px 24px;text-align:center;'
        f'border-top:3px solid {ANNETTE_COPPER}">'
        '<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{ANNETTE_COPPER};text-transform:uppercase">{eyebrow}</p>'
        f'<p style="margin:0;font-size:33px;line-height:1.1;letter-spacing:4px;color:{ANNETTE_CHAMPAGNE}">'
        "ANNETTE'S</p>"
        f'<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;'
        f'letter-spacing:10px;color:{ANNETTE_COPPER};text-transform:uppercase">BIG 40</p>'
        "</div>"
    )


def _annette_details_card(rows: list[tuple[str, str]]) -> str:
    cells = "".join(
        "<tr>"
        f'<td style="padding:8px 0;width:92px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:10px;letter-spacing:2px;color:{ANNETTE_COPPER};text-transform:uppercase">{label}</td>'
        f'<td style="padding:8px 0;font-size:15px;color:{ANNETTE_INK};line-height:1.5;font-weight:bold">{value}</td>'
        "</tr>"
        for label, value in rows
        if value
    )
    return (
        '<div style="margin:0 0 26px;padding:18px 22px;background:#FFFFFF;'
        f'border-left:3px solid {ANNETTE_COPPER};border-radius:8px">'
        f'<table style="width:100%;border-collapse:collapse">{cells}</table>'
        "</div>"
    )


def _annette_qr_card(qr_image_url: str | None, note: str = "Show this code at the entrance") -> str:
    absolute_qr = _absolute_url(qr_image_url) if qr_image_url else None
    if not absolute_qr:
        return (
            f'<div style="text-align:center;padding:18px;margin:0 0 26px;background:#FFFFFF;'
            f'border:1px dashed {ANNETTE_CHAMPAGNE};border-radius:12px">'
            '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;'
            f'letter-spacing:1px;color:{ANNETTE_TEXT}">Your QR entry code is attached to this email</p>'
            "</div>"
        )
    return (
        '<div style="text-align:center;padding:20px;margin:0 0 26px;background:#FFFFFF;'
        f'border:1px solid {ANNETTE_CHAMPAGNE};border-radius:12px">'
        '<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:3px;color:{ANNETTE_COPPER};text-transform:uppercase">Your entry code</p>'
        f'<img src="{absolute_qr}" alt="Entry QR Code" width="190" height="190" '
        'style="display:block;margin:0 auto;width:190px;height:190px;border:0" />'
        '<p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;'
        f'color:{ANNETTE_TEXT}">{note}</p>'
        "</div>"
    )


def _build_annette_invite_message(
    guest: Guest,
    event: Event,
    flyer_url: str | None,
    qr_image_url: str | None = None,
    qr_url: str | None = None,
    message_id: int | None = None,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> tuple[str, str, str]:
    """Designed black tie mail for Annette's BIG 40 (event 72 only)."""
    rsvp_link = invite_link_for(event, guest)
    rows = _annette_details(event)
    row_map = dict(rows)

    def _fill(text: str) -> str:
        return (
            text.replace("{{ guest_name }}", guest.name or "")
            .replace("{{ event_title }}", event.title or "")
            .replace("{{ event_date }}", row_map.get("Date", ""))
            .replace("{{ event_time }}", row_map.get("Time", ""))
            .replace("{{ venue }}", event.venue or "")
            .replace("{{ rsvp_link }}", rsvp_link)
            .replace("{{ host_name }}", event.host_name or "")
            .replace("{{ dress_code }}", event.dress_code or "")
            .replace("{guest name}", guest.name or "")
        )

    subject = _fill(custom_subject or event.invite_subject or f"You are invited: {event.title}")
    paragraphs = [_fill(p) for p in _annette_copy_blocks(event, custom_body)]

    body = (
        f"Dear {guest.name},\n\n"
        + "\n\n".join(paragraphs)
        + "\n\n"
        f"Date: {row_map.get('Date', '')}\n"
        f"Time: {row_map.get('Time', '')}\n"
        f"Venue: {row_map.get('Venue', '')}\n"
        f"Dress Code: {row_map.get('Dress Code', '')}\n\n"
        f"RSVP: {rsvp_link}\n"
        + (f"Your QR code: {qr_url}\n" if qr_url else "")
        + f"\n{ANNETTE_SIGNOFF[0]},\n{ANNETTE_SIGNOFF[1]}"
    )

    absolute_flyer = _absolute_url(flyer_url) if flyer_url else None
    hero_html = (
        f'<img src="{absolute_flyer}" alt="Annette" width="600" '
        'style="width:100%;max-width:600px;height:auto;display:block;border:0" />'
        if absolute_flyer
        else ""
    )
    paras_html = "".join(
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.8;'
        f'color:{ANNETTE_TEXT}">{p}</p>'
        for p in paragraphs
    )
    tracking_pixel = (
        f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />'
        if message_id
        else ""
    )

    inner = (
        f"{hero_html}"
        f"{_annette_title_band(event)}"
        '<div style="padding:30px 28px 6px">'
        f'<p style="margin:0 0 18px;font-size:17px;color:{ANNETTE_INK}">Dear {guest.name},</p>'
        f"{paras_html}"
        "</div>"
        '<div style="padding:0 28px">'
        f"{_annette_details_card(rows)}"
        '<div style="text-align:center;padding:0 0 26px">'
        f'<a href="{rsvp_link}" style="display:inline-block;background:{ANNETTE_COPPER};color:#FFFFFF;'
        "padding:16px 46px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;"
        'font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">RSVP Now</a>'
        "</div>"
        f"{_annette_qr_card(qr_image_url)}"
        "</div>"
        '<div style="padding:0 28px 30px;text-align:center">'
        f'<p style="margin:0 0 4px;font-size:13px;color:{ANNETTE_TEXT}">{ANNETTE_SIGNOFF[0]},</p>'
        f'<p style="margin:0;font-size:19px;color:{ANNETTE_INK}">{ANNETTE_SIGNOFF[1]}</p>'
        "</div>"
    )

    return subject, body, _annette_shell(inner, tracking_pixel)


def _build_annette_qr_message(
    guest: Guest,
    event: Event,
    qr_image_url: str | None,
    flyer_url: str | None = None,
) -> tuple[str, str, str]:
    """Designed entry pass for Annette's BIG 40 (event 72 only)."""
    rows = _annette_details(event)
    row_map = dict(rows)
    pass_link = f"{settings.FRONTEND_URL}/qr/{guest.rsvp_token}"

    subject = f"Your Entry Pass: {event.title}"
    body = (
        f"Dear {guest.name},\n\n"
        "Your entry pass for Annette's BIG 40 is enclosed. Please present the QR code at "
        "the door for accreditation.\n\n"
        f"Date: {row_map.get('Date', '')}\n\n"
        f"Time: {row_map.get('Time', '')}\n\n"
        f"Venue: {row_map.get('Venue', '')}\n\n"
        f"Dress Code: {row_map.get('Dress Code', '')}\n\n"
        "This pass admits one guest.\n\n"
        f"View your pass: {pass_link}\n\n"
        f"{ANNETTE_SIGNOFF[0]},\n{ANNETTE_SIGNOFF[1]}"
    )

    inner = (
        f"{_annette_title_band(event)}"
        '<div style="padding:30px 28px 6px;text-align:center">'
        '<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{ANNETTE_COPPER};text-transform:uppercase">Your entry pass</p>'
        f'<p style="margin:0 0 20px;font-size:23px;letter-spacing:1px;color:{ANNETTE_INK}">{guest.name}</p>'
        "</div>"
        '<div style="padding:0 28px">'
        f"{_annette_qr_card(qr_image_url, 'Scan at the door')}"
        f"{_annette_details_card(rows)}"
        '<p style="margin:0 0 8px;text-align:center;font-family:Arial,Helvetica,sans-serif;'
        f'font-size:10px;letter-spacing:2px;color:{ANNETTE_COPPER};text-transform:uppercase">'
        "This pass admits one guest</p>"
        '<p style="margin:0 0 26px;font-size:14px;line-height:1.7;color:' + ANNETTE_TEXT + ';text-align:center">'
        "Please arrive promptly and have this pass ready at the entrance."
        "</p>"
        "</div>"
    )

    return subject, body, _annette_shell(inner)


# ── Post-event thank you (opt in per event via events.thank_you_mode) ──
# Once an event is over the invite shell is wrong: a date and venue table, an
# entry code block and a "reserve your seat" button all ask the guest to do
# something that already happened. When an event is flagged thank_you_mode the
# organizer's saved message is rendered as a plain note of thanks instead, in
# the same palette as the rest of that event's mail.

MOBOLA_THANKS_SIGNOFF = "Team Mobola 🎂💕"

MOBOLA_THANKS_FALLBACK = [
    "Thank you for joining us to celebrate Mobola's BIG 10! 🥳",
    "Your presence, love, and energy made her day extra special. "
    "We're grateful you shared this beautiful moment with us. ❤️",
]


def _thank_you_paragraphs(raw_body: str | None, fallback: list[str]) -> list[str]:
    """Turn a saved thank you note into paragraphs of prose.

    The greeting and the sign off are dropped because each design prints its own
    "Dear {name}," and its own signature underneath. Everything the organizer
    writes in between survives word for word, emoji included.
    """
    raw = (raw_body or "").strip()
    if not raw:
        return list(fallback)
    paragraphs: list[str] = []
    for block in [b.strip() for b in raw.replace("\r\n", "\n").split("\n\n") if b.strip()]:
        kept: list[str] = []
        for line in [ln.strip() for ln in block.split("\n") if ln.strip()]:
            low = line.lower().rstrip(",").strip()
            if line.upper().startswith("DEAR "):
                continue
            if low in ("with love", "with gratitude") or low.startswith("team "):
                continue
            kept.append(line)
        if kept:
            paragraphs.append(" ".join(kept))
    return paragraphs or list(fallback)


def _build_mobola_thankyou_message(
    guest: Guest,
    event: Event,
    flyer_url: str | None,
    message_id: int | None = None,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> tuple[str, str, str]:
    """Cream and gold thank you for Mobola's BIG 10 (event 78 only).

    Same identity as her invitation: her photograph, the cocoa and gold name
    block, Georgia body copy. Nothing to RSVP to, no entry code, no addresses.
    """

    def _fill(text: str) -> str:
        return (
            text.replace("{{ guest_name }}", guest.name or "")
            .replace("{guest name}", guest.name or "")
            .replace("{{ event_title }}", event.title or "")
            .replace("{{ host_name }}", event.host_name or "")
        )

    subject = _fill(custom_subject or event.invite_subject or "Thank you for celebrating Mobola's BIG 10")
    paragraphs = [_fill(p) for p in _thank_you_paragraphs(custom_body or event.invite_body, MOBOLA_THANKS_FALLBACK)]
    celebrated_on = str(_format_date(event.event_date))
    parts = celebrated_on.split(" ", 1)
    if len(parts) == 2 and parts[0].endswith("day"):
        celebrated_on = f"{parts[0]}, {parts[1]}"

    body = (
        f"Dear {guest.name},\n\n"
        + "\n\n".join(paragraphs)
        + f"\n\nWith love,\n{MOBOLA_THANKS_SIGNOFF}"
    )

    absolute_flyer = _absolute_url(flyer_url) if flyer_url else None
    photo_html = (
        f'<img src="{absolute_flyer}" alt="Mobola\'s BIG 10" width="600" '
        'style="width:100%;max-width:600px;height:auto;display:block;border:0" />'
        if absolute_flyer
        else ""
    )
    paras_html = "".join(
        '<p style="margin:0 0 16px;font-size:15px;line-height:1.8;'
        f'color:{MOBOLA_BROWN}">{p}</p>'
        for p in paragraphs
    )
    tracking_pixel = (
        f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />'
        if message_id
        else ""
    )

    html = (
        f'<div style="margin:0;padding:0;background:{MOBOLA_CREAM}">'
        f'<div style="max-width:600px;margin:0 auto;background:{MOBOLA_CREAM};'
        "font-family:Georgia,'Times New Roman',serif\">"
        f"{photo_html}"
        f'<div style="background:{MOBOLA_COCOA};padding:26px 26px 24px;text-align:center">'
        f'<p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:4px;color:{MOBOLA_GOLD};text-transform:uppercase">Thank you for celebrating</p>'
        f'<p style="margin:0;font-size:34px;line-height:1.1;letter-spacing:3px;color:{MOBOLA_CREAM}">'
        "MOBOLA'S</p>"
        f'<p style="margin:4px 0 0;font-size:19px;letter-spacing:7px;color:{MOBOLA_GOLD}">BIG 10</p>'
        "</div>"
        '<div style="padding:30px 28px 4px">'
        f'<p style="margin:0 0 18px;font-size:17px;color:{MOBOLA_COCOA}">Dear {guest.name},</p>'
        f"{paras_html}"
        "</div>"
        f'<div style="margin:10px 28px 0;border-top:1px solid {MOBOLA_GOLD}"></div>'
        '<div style="padding:16px 28px 2px;text-align:center">'
        f'<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:3px;color:{MOBOLA_BROWN};text-transform:uppercase">Celebrated on {celebrated_on}</p>'
        "</div>"
        '<div style="padding:14px 28px 30px;text-align:center">'
        f'<p style="margin:0 0 4px;font-size:13px;color:{MOBOLA_BROWN}">With love,</p>'
        f'<p style="margin:0;font-size:19px;color:{MOBOLA_COCOA}">{MOBOLA_THANKS_SIGNOFF}</p>'
        "</div>"
        f'<div style="background:{MOBOLA_COCOA};padding:22px;text-align:center">'
        f'<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:3px;color:{MOBOLA_GOLD}">ACCREDIT INTERACTIVE</p>'
        '<p style="margin:7px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#8B7A5F">'
        "Premium Event Infrastructure</p>"
        "</div>"
        f"{tracking_pixel}"
        "</div></div>"
    )
    return subject, body, html


def _build_thankyou_message(
    guest: Guest,
    event: Event,
    flyer_url: str | None,
    message_id: int | None = None,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> tuple[str, str, str]:
    """Plain thank you for any other event flagged thank_you_mode.

    Takes its accent from the event's own theme colour, the same way the invite
    and QR mails do, so a thank you never arrives in another event's palette.
    """
    accent = getattr(event, "theme_color", None) or "#1ABC9C"
    subject = custom_subject or event.invite_subject or f"Thank you from {event.title}"
    paragraphs = _thank_you_paragraphs(
        custom_body or event.invite_body,
        ["Thank you for celebrating with us. Your presence made the day what it was."],
    )
    body = f"Dear {guest.name},\n\n" + "\n\n".join(paragraphs) + f"\n\nWith love,\n{event.host_name or event.title}"

    absolute_flyer = _absolute_url(flyer_url) if flyer_url else None
    photo_html = (
        f'<img src="{absolute_flyer}" alt="{event.title}" width="600" '
        'style="width:100%;max-width:600px;height:auto;display:block;border:0" />'
        if absolute_flyer
        else ""
    )
    paras_html = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#4A5568">{p}</p>'
        for p in paragraphs
    )
    tracking_pixel = (
        f'<img src="{settings.FRONTEND_URL}/api/v1/track/open/{message_id}" alt="" width="1" height="1" style="display:none" />'
        if message_id
        else ""
    )

    html = (
        '<div style="margin:0;padding:0;background:#F4F6F8">'
        '<div style="max-width:600px;margin:0 auto;background:#ffffff;'
        "font-family:Georgia,'Times New Roman',serif\">"
        f"{photo_html}"
        f'<div style="background:{accent};padding:26px;text-align:center">'
        '<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        'letter-spacing:4px;color:#ffffff;text-transform:uppercase">With gratitude</p>'
        f'<p style="margin:0;font-size:24px;line-height:1.25;color:#ffffff">{event.title}</p>'
        "</div>"
        '<div style="padding:30px 28px 8px">'
        f'<p style="margin:0 0 18px;font-size:17px;color:#1a1a2e">Dear {guest.name},</p>'
        f"{paras_html}"
        "</div>"
        '<div style="padding:6px 28px 30px">'
        '<p style="margin:0 0 4px;font-size:13px;color:#718096">With love,</p>'
        f'<p style="margin:0;font-size:17px;color:#1a1a2e">{event.host_name or event.title}</p>'
        "</div>"
        '<div style="background:#0D1B2A;padding:22px;text-align:center">'
        '<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;'
        f'letter-spacing:3px;color:{accent}">ACCREDIT INTERACTIVE</p>'
        '<p style="margin:7px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#94a3b8">'
        "Premium Event Infrastructure</p>"
        "</div>"
        f"{tracking_pixel}"
        "</div></div>"
    )
    return subject, body, html


MAX_INVITE_ATTEMPTS = 999


async def _send_to_guest(
    guest: Guest,
    event: Event,
    channel: str,
    batch_id: int,
    db: AsyncSession,
    custom_subject: str | None = None,
    custom_body: str | None = None,
) -> tuple[bool, str]:
    if guest.invite_attempts >= MAX_INVITE_ATTEMPTS:
        return False, "max_attempts"

    guest.invite_attempts += 1

    flyer_result = await db.execute(select(FlierAsset).where(FlierAsset.event_id == event.id).order_by(FlierAsset.created_at.desc()))
    flyer = flyer_result.scalars().first()
    flyer_url = flyer.url if flyer else event.cover_image

    include_qr = event.qr_delivery == "with_qr"
    qr_url = None
    qr_image_url = None
    if include_qr:
        qr = await get_or_create_guest_qr(db, event.id, guest.id)
        qr_url = f"{settings.FRONTEND_URL}/qr/{qr.token}"
        qr_image_path = _upload_path_from_url(flyer_url) if flyer_url else None
        qr_image_url = qr_to_url(qr_url, image_path=qr_image_path, size=250)

    msg = InviteMessage(batch_id=batch_id, guest_id=guest.id, channel=channel)
    db.add(msg)
    await db.flush()

    subject, body, html = _build_invite_message(guest, event, qr_url=qr_url, flyer_url=flyer_url, qr_image_url=qr_image_url, message_id=msg.id, custom_subject=custom_subject, custom_body=custom_body)

    try:
        if channel == "email" and guest.email:
            from_addr = f"{event.title} <noreply@wristbandsng.com>"
            ok = await asyncio.wait_for(send_email(guest.email, subject, html, from_addr=from_addr), timeout=15)
        elif channel == "whatsapp" and guest.phone:
            from app.api.event_registration import is_wedding_event as _is_wedding, is_gala_event as _is_gala, is_anchor_event as _is_anchor

            invite_content_sid = settings.TWILIO_WHATSAPP_INVITE_CONTENT_SID
            annette_invite_template = False
            # The configured invite template (ACAMB v4) carries ACAMB's flyer
            # image + ACAMB wording, so it must only ever fire for event 67.
            # Every other event sends its own flyer + text free-form.
            use_invite_template = getattr(event, "id", None) == 67 and bool(invite_content_sid)
            if _is_wedding(event) and getattr(settings, "TWILIO_WHATSAPP_WEDDING_INVITE_CONTENT_SID", ""):
                # Wedding invite template (couple monogram header + {{1}}=name,
                # {{2}}=per-guest RSVP link). Falls back to free-form below.
                invite_content_sid = settings.TWILIO_WHATSAPP_WEDDING_INVITE_CONTENT_SID
                use_invite_template = True
            if getattr(event, "id", None) == 78:
                # Mobola's BIG 10 has two approved shapes: the "this Saturday"
                # reminder while the party is coming, and a thank you once the
                # event is flagged thank_you_mode. Both take {{1}} = guest name;
                # free-form flyer plus text stays as the fallback.
                thanks_sid = getattr(settings, "TWILIO_WHATSAPP_MOBOLA_THANKS_CONTENT_SID", "")
                reminder_sid = getattr(settings, "TWILIO_WHATSAPP_MOBOLA_INVITE_CONTENT_SID", "")
                if getattr(event, "thank_you_mode", False) and thanks_sid:
                    invite_content_sid = thanks_sid
                    use_invite_template = True
                elif reminder_sid and not getattr(event, "thank_you_mode", False):
                    invite_content_sid = reminder_sid
                    use_invite_template = True
            if _is_gala(event) and getattr(settings, "TWILIO_WHATSAPP_GALA_INVITE_CONTENT_SID", ""):
                # The Art of Attention invite template (gala poster header +
                # {{1}}=name, {{2}}=per-guest RSVP link). Falls back to the
                # free-form flyer + text below until Meta approves it.
                invite_content_sid = settings.TWILIO_WHATSAPP_GALA_INVITE_CONTENT_SID
                use_invite_template = True
            from app.api.event_registration import is_anniversary_event as _is_anniversary

            if _is_anniversary(event) and getattr(settings, "TWILIO_WHATSAPP_ANNIV_INVITE_CONTENT_SID", ""):
                # Nelkon & Blessing 30th anniversary invite template (client
                # banner header + {{1}}=name, {{2}}=per-guest RSVP link).
                # Template first, free-form flyer + text as the fallback.
                invite_content_sid = settings.TWILIO_WHATSAPP_ANNIV_INVITE_CONTENT_SID
                use_invite_template = True
            if getattr(event, "id", None) == 72 and getattr(settings, "TWILIO_WHATSAPP_ANNETTE_INVITE_CONTENT_SID", ""):
                # Annette's BIG 40 reminder template (portrait header +
                # {{1}}=name, {{2}}=per-guest RSVP link). The QR travels by email,
                # so WhatsApp never needs to carry media here.
                invite_content_sid = settings.TWILIO_WHATSAPP_ANNETTE_INVITE_CONTENT_SID
                use_invite_template = True
                annette_invite_template = True
            if _is_anchor(event) and getattr(settings, "TWILIO_WHATSAPP_ANCHOR_INVITE_CONTENT_SID", ""):
                # Anchor Evening of Bliss (event 85): flier header + {{1}}=name
                # and {{2}} = the guest's own RSVP link. Free-form flyer + text
                # stays the fallback until Meta approves the template.
                invite_content_sid = settings.TWILIO_WHATSAPP_ANCHOR_INVITE_CONTENT_SID
                use_invite_template = True
            media_to_send = _absolute_url(flyer_url) if flyer_url else None
            if include_qr and annette_invite_template:
                # Event 72 only: the approved template carries the wording and the
                # RSVP link while the QR arrives by email. Free-form media is what
                # WhatsApp rejects with 63016 outside the 24 hour window.
                rsvp_link = invite_link_for(event, guest)
                content_vars = {
                    "1": guest.name or "",
                    "2": rsvp_link,
                    "_content_sid": invite_content_sid,
                }
                ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
                if not ok:
                    qr_media_url = _absolute_url(qr_image_url) if qr_image_url else None
                    ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=qr_media_url or media_to_send)
            elif include_qr:
                # Single media item on WhatsApp: the QR (flyer embedded in it).
                qr_media_url = _absolute_url(qr_image_url) if qr_image_url else None
                ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=qr_media_url or media_to_send)
            elif use_invite_template:
                # Twilio WhatsApp template (fixed flyer header + {{1}}=name; ACAMB
                # and wedding templates also take {{2}}=per-guest RSVP link)
                rsvp_link = invite_link_for(event, guest)
                content_vars = {"1": guest.name or "", "_content_sid": invite_content_sid}
                if getattr(event, "id", None) == 67 or _is_wedding(event) or _is_gala(event) or _is_anniversary(event) or _is_anchor(event):
                    content_vars["2"] = rsvp_link
                ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
                if not ok and media_to_send:
                    # Fallback to free-form (flyer + text) until template is Meta-approved
                    ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=media_to_send)
            elif media_to_send:
                # Send the same flyer image + invite text as the email (via Twilio)
                ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=media_to_send)
            else:
                ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=media_to_send)
            if not ok and settings.EVOLUTION_API_URL:
                from app.services.evolution_service import send_evolution_whatsapp
                ok2, evolution_id = await send_evolution_whatsapp(guest.phone, body, media_url=media_to_send)
                if ok2:
                    ok, provider_id = True, evolution_id
            if provider_id:
                msg.provider_message_id = provider_id
            elif not ok:
                msg.error = provider_id or "WhatsApp send failed (no error detail)"
        elif channel == "sms" and guest.phone:
            ok = await send_sms(guest.phone, body)
        else:
            msg.status = "skipped"
            await db.flush()
            return False, "skipped"

        if ok:
            msg.sent_at = func.now()
        msg.status = "sent" if ok else "failed"
        await db.flush()
        return ok, msg.status
    except Exception as e:
        msg.status = "failed"
        msg.error = str(e)
        await db.flush()
        return False, "failed"


def _build_qr_message(guest: Guest, event: Event, qr_image_url: str | None = None, custom_message: str | None = None, qr_message: str | None = None, message_type: str = "qr_only", flyer_url: str | None = None) -> tuple[str, str, str]:
    # Black Market dashboard QRs (event 77 only) use the client-approved
    # design. Every other caller: burial, regular RSVP flows, other events —
    # keeps the original template below untouched.
    _bm = (getattr(event, "id", None) == 77) or (
        event.title == "BLACK MARKET Movie World Record Attempt"
    )
    if _bm and message_type == "qr_only" and not custom_message and not qr_message:
        return _build_bm_qr_message(guest, event, qr_image_url)
    from app.api.event_registration import is_gala_event as _is_gala, is_anniversary_event as _is_anniv, is_anchor_event as _is_anchor

    if _is_anchor(event) and message_type == "qr_only" and not custom_message and not qr_message:
        # Event 85 pass: event details plus the code, deliberately no flier.
        return _build_anchor_qr_message(guest, event, qr_image_url)
    if _is_anniv(event) and message_type == "qr_only" and not custom_message and not qr_message:
        return _build_anniv_qr_message(guest, event, qr_image_url, flyer_url)
    if _is_annette_event(event) and message_type == "qr_only" and not custom_message and not qr_message:
        # Annette's BIG 40 entry pass, same plum and copper palette as the invite.
        return _build_annette_qr_message(guest, event, qr_image_url, flyer_url)
    if _is_gala(event) and message_type == "qr_only" and not custom_message and not qr_message:
        return _build_gala_qr_message(guest, event, qr_image_url, flyer_url)
    subject = f"Your QR Access Code: {event.title}"
    body = custom_message or (
        f"==============================\n"
        f"{event.title.upper()}\n"
        f"QR Access Code for {guest.name}\n"
        f"==============================\n\n"
        f"Your unique QR access code is ready.\n\n"
        f"Please note, this invite admits only one person.\n\n"
        f"Show this at the event entrance for quick access.\n\n"
        f"Warm regards,\n{event.host_name}"
    )
    qr_img_html = ""
    if qr_image_url:
        absolute_qr = _absolute_url(qr_image_url)
        if absolute_qr:
            qr_img_html = f'<img src="{absolute_qr}" alt="Entry QR Code" style="width:200px;height:200px;display:block;margin:0 auto" />'
    # Category-aware content: Premium/VIP guests get VIP entry info,
    # General Access guests get regular-zone info. No category → generic.
    cat = (guest.category or "").strip()
    is_premium = "premium" in cat.lower() or "vip" in cat.lower()
    is_vvip = "vvip" in cat.lower().replace(" ", "")
    # Black Market emails use the client's burnt-orange branding instead of
    # the default Accredit teal. Everything else keeps the platform theme.
    bm_event = (getattr(event, "id", None) == 77) or (
        event.title == "BLACK MARKET Movie World Record Attempt"
    )
    _theme = (getattr(event, "theme_color", None) or "").strip() or "#1ABC9C"
    try:
        _pr, _pg, _pb = (int(_theme.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))
    except (ValueError, IndexError):
        _theme, _pr, _pg, _pb = "#1ABC9C", 26, 188, 156
    accent = "#C2410C" if bm_event else _theme
    accent_light = "#FDBA74" if bm_event else _theme
    pulse_rgb = "194,65,12" if bm_event else f"{_pr},{_pg},{_pb}"
    category_html = ""
    if cat:
        badge = "★ VVIP ★" if is_vvip else ("★ PREMIUM VIP ★" if is_premium else cat.upper())
        if is_premium:
            category_html = (
                f'<div style="background:{accent};color:#fff;display:inline-block;padding:6px 22px;border-radius:20px;font-weight:bold;font-size:13px;letter-spacing:1px;margin-bottom:6px">{badge}</div>'
                '<div style="background:#f8f9fc;border:1px solid #e8edf2;border-radius:8px;padding:16px;margin:0 0 4px;text-align:left">'
                f'<p style="margin:0 0 6px;font-weight:bold;color:{accent};font-size:13px">YOUR ENTRY & PARKING</p>'
                '<p style="margin:4px 0;font-size:13px;color:#0D1B2A"><strong>Entry Zone:</strong> ZONE D</p>'
                '<p style="margin:4px 0;font-size:13px;color:#0D1B2A"><strong>Entry Gate:</strong> Closest to Office of the Surveyor General of the Federation</p>'
                '<p style="margin:8px 0 2px;font-size:13px;color:#0D1B2A"><strong>Parking:</strong> Odeya Car Park • East Pavilion Car Park</p>'
                '</div>'
            )
        else:
            category_html = (
                f'<div style="background:{accent};color:#fff;display:inline-block;padding:6px 22px;border-radius:20px;font-weight:bold;font-size:13px;letter-spacing:1px;margin-bottom:6px">{cat.upper()}</div>'
                '<div style="background:#f8f9fc;border:1px solid #e8edf2;border-radius:8px;padding:16px;margin:0 0 4px;text-align:left">'
                f'<p style="margin:0 0 6px;font-weight:bold;color:{accent};font-size:13px">YOUR ENTRY & PARKING</p>'
                '<p style="margin:4px 0;font-size:13px;color:#0D1B2A"><strong>Entry Zone:</strong> ZONE A & ZONE B</p>'
                '<p style="margin:8px 0 2px;font-size:13px;color:#0D1B2A"><strong>Parking:</strong> Hassan • Under Bridge • Banquet • Marquee • Independence Car Parks</p>'
                '</div>'
            )
    flyer_html = ""
    if flyer_url:
        absolute_flyer = _absolute_url(flyer_url)
        if absolute_flyer:
            flyer_html = f'<img src="{absolute_flyer}" alt="{event.title}" style="width:100%;max-width:600px;max-height:400px;height:auto;display:block;border-radius:0" />'
    html = (
        '<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#1a1a2e">'
        f'{flyer_html}'
        f'<style>@keyframes accredit-pulse{{0%,100%{{box-shadow:0 0 0 0 rgba({pulse_rgb},0.35)}}50%{{box-shadow:0 0 0 12px rgba({pulse_rgb},0)}}}}</style>'
        '<div style="background:#07182f;color:#fff;padding:32px 28px;text-align:center">'
        f'<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:{accent_light};margin-bottom:8px">QR Access Code</div>'
        f'<h1 style="margin:0 0 4px;font-size:30px;line-height:1.1;color:#fff">{event.title}</h1>'
        f'<p style="margin:0;color:#d9e8f7;font-size:13px">Sent to {guest.name}</p>'
        '</div>'
        '<div style="padding:32px 28px;background:#ffffff;text-align:center">'
        f'{category_html}'
        f'<p style="margin:0 0 20px;font-size:14px;color:#555">Your unique QR access code is ready for entry.</p>'
        f'{qr_img_html}'
        f'<p style="margin:20px 0 0;font-size:12px;color:#94a3b8;font-weight:bold">Please note, this invite admits only one person.</p>'
        f'<p style="margin:8px 0 0;font-size:12px;color:#94a3b8">Show this code at the venue entrance for quick access.</p>'
        '</div>'
        '<div style="background:#07182f;color:#d9e8f7;padding:20px;text-align:center;font-size:11px;font-family:Arial,sans-serif">'
        '<p style="margin:0;letter-spacing:1px">ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>'
        '</div>'
        '</div>'
    )
    return subject, body, html


def _build_bm_qr_message(
    guest: Guest, event: Event, qr_image_url: str | None = None
) -> tuple[str, str, str]:
    """Client-approved BLACK MARKET QR email for dashboard sends.

    EVENT 77 ONLY (see gate in _build_qr_message). Reuses the ticket
    template so dashboard and purchase emails look identical.
    """
    from app.services.ticket_delivery import format_black_market_email

    cat = (guest.category or "").strip() or "General Access"
    is_premium = "premium" in cat.lower() or "vip" in cat.lower()
    package_name = cat if is_premium else "General Access"
    absolute_qr = _absolute_url(qr_image_url) if qr_image_url else None
    org_name = None
    if cat.lower() == "vendor's assistant":
        org_name = ((guest.custom_data or {}).get("organization") or "").strip() or None
    subject, html = format_black_market_email(
        buyer_name=guest.name,
        event_title=event.title,
        event_date=str(event.event_date),
        event_time=str(event.event_time),
        venue=event.venue or "",
        ticket_reference=f"GUEST-{guest.id}",
        ticket_count=1,
        amount_paid=0,
        qr_code_base64="",
        package_name=package_name,
        is_premium=is_premium,
        qr_image_url=absolute_qr,
        org_name=org_name,
    )
    body = (
        f"{event.title}\nQR Access Code for {guest.name} ({cat})\n\n"
        "Your unique QR access code is ready. A PDF copy is attached to this email.\n\n"
        "Please note, this invite admits only one person.\n"
        "Show this code at the event entrance for quick access.\n"
    )
    return subject, body, html


async def _send_qr_to_guest(
    guest: Guest,
    event: Event,
    channel: str,
    batch_id: int,
    db: AsyncSession,
) -> tuple[bool, str]:
    qr = await get_or_create_guest_qr(db, event.id, guest.id)
    qr_token_url = f"{settings.FRONTEND_URL}/qr/{qr.token}"

    flyer_result = await db.execute(select(FlierAsset).where(FlierAsset.event_id == event.id).order_by(FlierAsset.created_at.desc()))
    flyer = flyer_result.scalars().first()
    flyer_url = flyer.url if flyer else event.cover_image
    qr_image_path = _upload_path_from_url(flyer_url) if flyer_url else None
    qr_image_url = qr_to_url(qr_token_url, image_path=qr_image_path, size=250)

    from app.api.event_registration import is_anchor_event as _is_anchor_qr

    if _is_anchor_qr(event):
        # Event 85 keeps the pass clean: a bare code and no flier anywhere.
        qr_image_url = qr_to_url(qr_token_url, size=250)
        flyer_url = None

    bm_event = (getattr(event, "id", None) == 77) or (
        event.title == "BLACK MARKET Movie World Record Attempt"
    )
    if bm_event:
        # Client-approved design carries no banner header image.
        flyer_url = None

    subject, body, html = _build_qr_message(guest, event, qr_image_url, flyer_url=flyer_url)

    msg = InviteMessage(batch_id=batch_id, guest_id=guest.id, channel=channel)
    db.add(msg)

    # QR as a PDF attachment on Black Market emails (client design).
    pdf_bytes, pdf_filename = None, None
    if bm_event:
        try:
            from app.services.ticket_delivery import build_ticket_pdf

            qr_disk = _upload_path_from_url(qr_image_url) if qr_image_url else None
            if qr_disk and os.path.exists(qr_disk):
                with open(qr_disk, "rb") as f:
                    import base64 as _b64

                    pdf_bytes = build_ticket_pdf(
                        _b64.b64encode(f.read()).decode(),
                        guest.name,
                        (guest.category or "").strip() or "General Access",
                        f"GUEST-{guest.id}",
                        event.title,
                    )
                    pdf_filename = f"BLACK-MARKET-QR-GUEST-{guest.id}.pdf"
        except Exception:
            pdf_bytes = None

    try:
        if channel == "email" and guest.email:
            from_addr = f"{event.title} <noreply@wristbandsng.com>"
            if pdf_bytes and pdf_filename:
                from app.services.email_service import send_email_with_pdf

                ok = await asyncio.wait_for(
                    send_email_with_pdf(
                        guest.email, subject, html, pdf_bytes, pdf_filename,
                        from_addr=from_addr,
                    ),
                    timeout=20,
                )
            else:
                ok = await asyncio.wait_for(send_email(guest.email, subject, html, from_addr=from_addr), timeout=15)
        elif channel == "whatsapp" and guest.phone:
            # WhatsApp free-form carries a single media item: send the QR
            # image (the event flyer is already embedded inside it). Fall
            # back to the flyer alone only if QR generation failed.
            qr_media_url = _absolute_url(qr_image_url)
            flyer_media_url = _absolute_url(flyer_url)
            ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=qr_media_url or flyer_media_url)
            if not ok:
                from app.api.event_registration import is_gala_event as _is_gala, is_anniversary_event as _is_anniversary

                gala_qr_sid = getattr(settings, "TWILIO_WHATSAPP_GALA_QR_CONTENT_SID", "")
                if _is_gala(event) and gala_qr_sid:
                    # Cold contact (outside the 24h free-form window): the
                    # approved utility template confirms the pass was emailed.
                    content_vars = {"1": guest.name or "", "_content_sid": gala_qr_sid}
                    ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
                anniv_qr_sid = getattr(settings, "TWILIO_WHATSAPP_ANNIV_QR_CONTENT_SID", "")
                if not ok and _is_anniversary(event) and anniv_qr_sid:
                    # Same contract for event 84: the template confirms the pass
                    # and links to it, the QR image itself travels by email.
                    content_vars = {
                        "1": guest.name or "",
                        "2": qr_token_url,
                        "_content_sid": anniv_qr_sid,
                    }
                    ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
                annette_qr_sid = getattr(settings, "TWILIO_WHATSAPP_ANNETTE_QR_CONTENT_SID", "")
                if not ok and getattr(event, "id", None) == 72 and annette_qr_sid:
                    # Event 72: the utility template reaches a cold contact and
                    # points at the pass, the QR image itself travels by email.
                    # It carries a single name variable, so no link is passed.
                    content_vars = {
                        "1": guest.name or "",
                        "_content_sid": annette_qr_sid,
                    }
                    ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
                anchor_qr_sid = getattr(settings, "TWILIO_WHATSAPP_ANCHOR_QR_CONTENT_SID", "")
                if not ok and _is_anchor_qr(event) and anchor_qr_sid:
                    # Anchor Evening of Bliss (event 85): the utility template
                    # confirms the pass to a cold contact. It carries a single
                    # name variable, and the code itself travels by email.
                    content_vars = {
                        "1": guest.name or "",
                        "_content_sid": anchor_qr_sid,
                    }
                    ok, provider_id = await _send_whatsapp(guest.phone, body, media_url=None, content_vars=content_vars)
            if not ok and settings.EVOLUTION_API_URL:
                from app.services.evolution_service import send_evolution_whatsapp
                ok2, evolution_id = await send_evolution_whatsapp(guest.phone, body, media_url=qr_media_url)
                if ok2:
                    ok, provider_id = True, evolution_id
            if provider_id:
                msg.provider_message_id = provider_id
            elif not ok:
                msg.error = provider_id or "WhatsApp send failed (no error detail)"
        elif channel == "sms" and guest.phone:
            ok = await send_sms(guest.phone, body)
        else:
            msg.status = "skipped"
            await db.flush()
            return False, "skipped"

        if ok:
            msg.sent_at = func.now()
        msg.status = "sent" if ok else "failed"
        await db.flush()
        return ok, msg.status
    except Exception as e:
        msg.status = "failed"
        msg.error = str(e)
        await db.flush()
        return False, "failed"


# ── Send invite to ALL unsent guests (or force resend) ──

@router.post("/{event_id}/send-invites")
async def send_invites(
    event_id: int,
    req: SendInvitesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    force: bool = Query(False, description="Resend to already-sent guests"),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    channels = req.get_channels()

    query = select(Guest).where(Guest.event_id == event_id)
    if not force:
        query = query.where(Guest.invite_sent == False)
    guests_result = await db.execute(query)
    guests = guests_result.scalars().all()
    if not guests:
        return {"channels": {}, "total_sent": 0, "total_guests": 0, "already_sent": True, "message": "All guests have already been invited. Use ?force=true to resend."}

    if force:
        already_sent_guests = [g for g in guests if g.invite_sent]
        if already_sent_guests:
            guest_ids = [g.id for g in already_sent_guests]
            payment_result = await db.execute(
                select(Payment).where(
                    Payment.event_id == event_id,
                    Payment.guest_id.in_(guest_ids),
                    Payment.payment_type == "resend",
                    Payment.status == "completed",
                )
            )
            paid_guest_ids = {p.guest_id for p in payment_result.scalars().all()}
            unpaid = [g for g in already_sent_guests if g.id not in paid_guest_ids]
            if unpaid:
                pass  # Allow free resend during testing

    def has_contact(guest: Guest, ch: str) -> bool:
        return (ch == "email" and guest.email) or (ch in ("whatsapp", "sms") and guest.phone)

    total_sent = 0
    results_for_channels = {}
    sent_guest_ids: set[int] = set()
    all_invalid_phone_guests: list[dict] = []
    all_no_contact_guests: list[dict] = []  # guests with no contact for ANY selected channel

    for ch in channels:
        invalid_phone_guests: list[dict] = []
        no_contact_guests: list[dict] = []
        if ch in {"whatsapp", "sms"}:
            invalid_phone_guests = [
                {"id": guest.id, "name": guest.name, "phone": guest.phone}
                for guest in guests
                if has_contact(guest, ch) and not is_valid_phone(guest.phone)
            ]
            all_invalid_phone_guests.extend(invalid_phone_guests)

            # Track guests who have phone but it's invalid (already captured above)
            # Track guests who have NO phone for this channel
            no_contact_guests = [
                {"id": guest.id, "name": guest.name, "reason": f"no phone for {ch}"}
                for guest in guests
                if not has_contact(guest, ch)
            ]
        else:
            # email channel
            no_contact_guests = [
                {"id": guest.id, "name": guest.name, "reason": "no email"}
                for guest in guests
                if not has_contact(guest, ch)
            ]

        if ch in {"whatsapp", "sms"}:
            eligible = [g for g in guests if has_contact(g, ch) and is_valid_phone(g.phone)]
        else:
            eligible = [g for g in guests if has_contact(g, ch)]

        if not eligible:
            if invalid_phone_guests:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": f"None of these guests has a usable phone number for {ch}. Fix these numbers and try again.",
                        "invalid_phone_guests": invalid_phone_guests,
                    },
                )
            results_for_channels[ch] = {
                "sent": 0, "total": 0, "skipped_max_attempts": 0,
                "skipped_no_contact": len(no_contact_guests),
                "no_contact_guests": no_contact_guests,
                "message": "No guests with contact info for this channel"
            }
            continue

        batch = InviteBatch(event_id=event_id, channel=ch)
        db.add(batch)
        await db.flush()

        sent = 0
        failed = 0
        skipped_attempts = 0
        for guest in eligible:
            ok, status = await _send_to_guest(guest, event, ch, batch.id, db, custom_subject=req.message_subject, custom_body=req.message_body)
            if status == "max_attempts":
                skipped_attempts += 1
                continue
            if ok:
                sent += 1
                sent_guest_ids.add(guest.id)
            else:
                failed += 1
            await db.flush()

        batch.total_sent = sent
        batch.status = "completed"
        results_for_channels[ch] = {
            "batch_id": batch.id,
            "sent": sent,
            "failed": failed,
            "total": len(eligible),
            "skipped_max_attempts": skipped_attempts,
            "skipped_no_contact": len(no_contact_guests),
            "no_contact_guests": no_contact_guests,
        }
        if invalid_phone_guests:
            results_for_channels[ch]["skipped_invalid_phone"] = len(invalid_phone_guests)
            results_for_channels[ch]["invalid_phone_guests"] = invalid_phone_guests
        total_sent += sent

    # Guests who had no contact info for ANY selected channel
    for guest in guests:
        has_any = any(has_contact(guest, ch) and (ch != "email" or guest.email) and (ch in ("whatsapp", "sms") and is_valid_phone(guest.phone) if ch in ("whatsapp", "sms") else True) for ch in channels)
        # Simpler: check if guest has contact for at least one channel
        guest_has_contact = False
        for ch in channels:
            if has_contact(guest, ch):
                if ch in ("whatsapp", "sms"):
                    if is_valid_phone(guest.phone):
                        guest_has_contact = True
                        break
                else:
                    guest_has_contact = True
                    break
        if not guest_has_contact:
            all_no_contact_guests.append({"id": guest.id, "name": guest.name, "reason": "no contact info for any selected channel"})

    if sent_guest_ids:
        for guest in guests:
            if guest.id in sent_guest_ids:
                guest.invite_sent = True

    await db.commit()
    response = {
        "channels": results_for_channels,
        "total_sent": total_sent,
        "total_guests": len(guests),
        "guests_with_no_contact": all_no_contact_guests,
        "skipped_no_contact_total": len(all_no_contact_guests),
    }
    if all_invalid_phone_guests:
        response["invalid_phone_guests"] = all_invalid_phone_guests
        response["skipped_invalid_phone"] = len(all_invalid_phone_guests)
    return response


# ── Send invite to ONE specific guest ──

@router.post("/{event_id}/guests/{guest_id}/send-invite")
async def send_guest_invite(
    event_id: int,
    guest_id: int,
    req: SendGuestInviteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    force: bool = Query(False, description="Resend even if already sent"),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guest_result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.event_id == event_id)
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    channels = req.get_channels()

    if guest.invite_sent:
        if not force:
            raise HTTPException(
                status_code=400,
                detail=f"Invite already sent to {guest.name}. Use ?force=true to resend.",
            )
        pass  # Allow free resend during testing

    results = []
    any_sent = False
    for ch in channels:
        def has_contact(ch: str) -> bool:
            return (ch == "email" and guest.email) or (ch in ("whatsapp", "sms") and guest.phone)
        if not has_contact(ch):
            results.append({"channel": ch, "sent": False, "status": "skipped", "message": f"No contact info for {ch}"})
            continue

        batch = InviteBatch(event_id=event_id, channel=ch)
        db.add(batch)
        await db.flush()

        ok, status = await _send_to_guest(guest, event, ch, batch.id, db, custom_subject=req.message_subject, custom_body=req.message_body)

        if status == "max_attempts":
            batch.total_sent = 0
            batch.status = "completed"
            results.append({"channel": ch, "sent": False, "status": "max_attempts"})
            continue

        if status != "skipped":
            any_sent = True
        batch.total_sent = 1 if ok else 0
        batch.status = "completed"
        results.append({"channel": ch, "sent": ok, "status": status})

    if any_sent:
        guest.invite_sent = True

    await db.commit()
    return {"guest_id": guest_id, "channels": results}


# ── Send QR code to ONE specific guest ──

@router.post("/{event_id}/guests/{guest_id}/send-qr")
async def send_guest_qr(
    event_id: int,
    guest_id: int,
    req: SendGuestInviteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guest_result = await db.execute(
        select(Guest).where(Guest.id == guest_id, Guest.event_id == event_id)
    )
    guest = guest_result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    channels = req.get_channels()
    results = []
    for ch in channels:
        batch = InviteBatch(event_id=event_id, channel=ch)
        db.add(batch)
        await db.flush()

        ok, status = await _send_qr_to_guest(guest, event, ch, batch.id, db)
        batch.total_sent = 1 if ok else 0
        batch.status = "completed"
        results.append({"channel": ch, "sent": ok, "status": status})

    await db.commit()
    return {"guest_id": guest_id, "channels": results}


# ── Send QR codes to ALL unsent guests ──

async def _send_qr_track(event_id: int, guests: list, channels: list, req, user, db) -> dict:
    """Shared logic for sending QR codes with detailed tracking."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not guests:
        raise HTTPException(status_code=400, detail="No guests to send QR codes to")

    results_for_channels = {}
    total_sent = 0
    all_invalid_phone_guests: list[dict] = []
    all_no_contact_guests: list[dict] = []

    def has_qr_contact(guest: Guest, ch: str) -> bool:
        return (ch == "email" and guest.email) or (ch in ("whatsapp", "sms") and guest.phone)

    for ch in channels:
        invalid_phone_guests: list[dict] = []
        no_contact_guests: list[dict] = []

        if ch in {"whatsapp", "sms"}:
            invalid_phone_guests = [
                {"id": g.id, "name": g.name, "phone": g.phone}
                for g in guests if g.phone and not is_valid_phone(g.phone)
            ]
            all_invalid_phone_guests.extend(invalid_phone_guests)

            # Guests with no phone for this channel
            no_contact_guests = [
                {"id": g.id, "name": g.name, "reason": f"no phone for {ch}"}
                for g in guests if not has_qr_contact(g, ch)
            ]
        else:
            no_contact_guests = [
                {"id": g.id, "name": g.name, "reason": "no email"}
                for g in guests if not has_qr_contact(g, ch)
            ]

        if ch in {"whatsapp", "sms"}:
            targets = [g for g in guests if has_qr_contact(g, ch) and is_valid_phone(g.phone)]
        else:
            targets = [g for g in guests if has_qr_contact(g, ch)]

        if not targets:
            if invalid_phone_guests:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": f"None of these guests has a usable phone number for {ch}. Fix these numbers and try again.",
                        "invalid_phone_guests": invalid_phone_guests,
                    },
                )
            results_for_channels[ch] = {
                "sent": 0, "total": 0, "failed": 0,
                "skipped_no_contact": len(no_contact_guests),
                "no_contact_guests": no_contact_guests,
                "message": "No guests with contact info for this channel"
            }
            continue

        batch = InviteBatch(event_id=event_id, channel=ch)
        db.add(batch)
        await db.flush()

        sent = 0
        failed = 0
        for guest in targets:
            ok, status = await _send_qr_to_guest(guest, event, ch, batch.id, db)
            if ok:
                sent += 1
            else:
                failed += 1
            await db.flush()

        batch.total_sent = sent
        batch.status = "completed"
        results_for_channels[ch] = {
            "batch_id": batch.id,
            "sent": sent,
            "failed": failed,
            "total": len(targets),
            "skipped_no_contact": len(no_contact_guests),
            "no_contact_guests": no_contact_guests,
        }
        if invalid_phone_guests:
            results_for_channels[ch]["skipped_invalid_phone"] = len(invalid_phone_guests)
            results_for_channels[ch]["invalid_phone_guests"] = invalid_phone_guests
        total_sent += sent

    # Guests with no contact for ANY selected channel
    for guest in guests:
        guest_has_contact = any(
            has_qr_contact(guest, ch) and (ch not in ("whatsapp", "sms") or is_valid_phone(guest.phone))
            for ch in channels
        )
        if not guest_has_contact:
            all_no_contact_guests.append({"id": guest.id, "name": guest.name, "reason": "no contact info for any selected channel"})

    await db.commit()
    return {
        "channels": results_for_channels,
        "total_sent": total_sent,
        "total_guests": len(guests),
        "guests_with_no_contact": all_no_contact_guests,
        "skipped_no_contact_total": len(all_no_contact_guests),
        "invalid_phone_guests": all_invalid_phone_guests,
        "skipped_invalid_phone": len(all_invalid_phone_guests),
    }


@router.post("/{event_id}/send-qrs")
async def send_all_qrs(
    event_id: int,
    req: SendInvitesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    guests_result = await db.execute(
        select(Guest).where(Guest.event_id == event_id)
    )
    guests = guests_result.scalars().all()
    return await _send_qr_track(event_id, guests, req.get_channels(), req, user, db)


# ── Re-send payment check ──

@router.post("/{event_id}/resend-cost")
async def resend_cost(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    guest_ids: list[int] = Query(None),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if guest_ids:
        guests_result = await db.execute(
            select(Guest).where(Guest.id.in_(guest_ids), Guest.event_id == event_id, Guest.invite_sent == True)
        )
    else:
        guests_result = await db.execute(
            select(Guest).where(Guest.event_id == event_id, Guest.invite_sent == True)
        )
    already_sent = guests_result.scalars().all()

    total_cost = len(already_sent) * RESEND_PRICE_PER_GUEST
    return {
        "already_sent_count": len(already_sent),
        "cost_per_guest": RESEND_PRICE_PER_GUEST,
        "total_cost": total_cost,
    }


# ── Delivery logs ──

@router.get("/{event_id}/delivery-logs")
async def delivery_logs(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            InviteMessage.id,
            InviteMessage.guest_id,
            Guest.name.label("guest_name"),
            InviteMessage.channel,
            InviteMessage.status,
            InviteMessage.sent_at,
            InviteMessage.delivered_at,
            InviteMessage.opened_at,
            InviteMessage.error,
        )
        .join(InviteBatch, InviteMessage.batch_id == InviteBatch.id)
        .join(Guest, InviteMessage.guest_id == Guest.id)
        .where(InviteBatch.event_id == event_id)
        .order_by(InviteMessage.sent_at.desc().nulls_last(), InviteMessage.created_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": r.id,
            "guest_id": r.guest_id,
            "guest_name": r.guest_name,
            "channel": r.channel,
            "status": r.status,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
            "opened_at": r.opened_at.isoformat() if r.opened_at else None,
            "error": r.error,
        }
        for r in rows
    ]


class SendInvitesBatchRequest(BaseModel):
    channel: str = "email"
    channels: Optional[List[str]] = None
    guest_ids: list[int]
    message_subject: Optional[str] = None
    message_body: Optional[str] = None

    def get_channels(self) -> List[str]:
        return self.channels if self.channels else [self.channel]


@router.post("/{event_id}/send-invites-batch")
async def send_invites_batch(
    event_id: int,
    req: SendInvitesBatchRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(req.guest_ids) > 5:
        raise HTTPException(status_code=400, detail="Can only send invites to up to 5 guests at a time")

    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    guests_result = await db.execute(
        select(Guest).where(Guest.id.in_(req.guest_ids), Guest.event_id == event_id)
    )
    guests = guests_result.scalars().all()
    if not guests:
        raise HTTPException(status_code=400, detail="No valid guests found")

    channels = req.get_channels()
    results_for_channels = {}
    total_sent = 0
    sent_guest_ids: set[int] = set()
    all_invalid_phone_guests: list[dict] = []
    all_no_contact_guests: list[dict] = []

    def has_contact(guest: Guest, ch: str) -> bool:
        return (ch == "email" and guest.email) or (ch in ("whatsapp", "sms") and guest.phone)

    for ch in channels:
        invalid_phone_guests: list[dict] = []
        no_contact_guests: list[dict] = []
        if ch in {"whatsapp", "sms"}:
            invalid_phone_guests = [
                {"id": g.id, "name": g.name, "phone": g.phone}
                for g in guests
                if has_contact(g, ch) and not is_valid_phone(g.phone)
            ]
            all_invalid_phone_guests.extend(invalid_phone_guests)

            no_contact_guests = [
                {"id": g.id, "name": g.name, "reason": f"no phone for {ch}"}
                for g in guests if not has_contact(g, ch)
            ]
        else:
            no_contact_guests = [
                {"id": g.id, "name": g.name, "reason": "no email"}
                for g in guests if not has_contact(g, ch)
            ]

        if ch in {"whatsapp", "sms"}:
            eligible = [g for g in guests if has_contact(g, ch) and is_valid_phone(g.phone)]
        else:
            eligible = [g for g in guests if has_contact(g, ch)]

        if not eligible:
            if invalid_phone_guests:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": f"None of these guests has a usable phone number for {ch}. Fix these numbers and try again.",
                        "invalid_phone_guests": invalid_phone_guests,
                    },
                )
            results_for_channels[ch] = {
                "sent": 0, "total": 0, "failed": 0, "results": [],
                "skipped_no_contact": len(no_contact_guests),
                "no_contact_guests": no_contact_guests,
            }
            continue

        batch = InviteBatch(event_id=event_id, channel=ch)
        db.add(batch)
        await db.flush()

        sent = 0
        failed = 0
        results = []
        for guest in eligible:
            ok, status = await _send_to_guest(guest, event, ch, batch.id, db, custom_subject=req.message_subject, custom_body=req.message_body)
            if status == "max_attempts":
                results.append({"guest_id": guest.id, "name": guest.name, "status": "max_attempts"})
                continue
            if ok:
                sent += 1
                sent_guest_ids.add(guest.id)
                results.append({"guest_id": guest.id, "name": guest.name, "status": "delivered"})
            else:
                failed += 1
                results.append({"guest_id": guest.id, "name": guest.name, "status": status})
            await db.flush()

        batch.total_sent = sent
        batch.status = "completed"
        results_for_channels[ch] = {
            "batch_id": batch.id,
            "sent": sent,
            "failed": failed,
            "total": len(eligible),
            "results": results,
            "skipped_no_contact": len(no_contact_guests),
            "no_contact_guests": no_contact_guests,
        }
        if invalid_phone_guests:
            results_for_channels[ch]["skipped_invalid_phone"] = len(invalid_phone_guests)
            results_for_channels[ch]["invalid_phone_guests"] = invalid_phone_guests
        total_sent += sent

    # Guests with no contact for ANY selected channel
    for guest in guests:
        guest_has_contact = any(
            has_contact(guest, ch) and (ch not in ("whatsapp", "sms") or is_valid_phone(guest.phone))
            for ch in channels
        )
        if not guest_has_contact:
            all_no_contact_guests.append({"id": guest.id, "name": guest.name, "reason": "no contact info for any selected channel"})

    if sent_guest_ids:
        for guest in guests:
            if guest.id in sent_guest_ids:
                guest.invite_sent = True

    await db.commit()
    response = {
        "channels": results_for_channels,
        "total_sent": total_sent,
        "total_guests": len(guests),
        "guests_with_no_contact": all_no_contact_guests,
        "skipped_no_contact_total": len(all_no_contact_guests),
    }
    if all_invalid_phone_guests:
        response["invalid_phone_guests"] = all_invalid_phone_guests
        response["skipped_invalid_phone"] = len(all_invalid_phone_guests)
    return response


@router.get("/{event_id}/export-guests")
async def export_guests(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str = Query("all", description="Filter: all, sent, not_sent, delivered, failed"),
):
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")

    query = select(Guest).where(Guest.event_id == event_id)
    if status == "sent":
        query = query.where(Guest.invite_sent == True)
    elif status == "not_sent":
        query = query.where(Guest.invite_sent == False)
    elif status == "delivered":
        query = query.where(Guest.invite_sent == True)
    elif status == "failed":
        query = query.where(Guest.invite_sent == True)

    result = await db.execute(query)
    guests = result.scalars().all()

    import csv, io, json
    output = io.StringIO()
    # BOM for Excel UTF-8 support
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Phone", "Email", "RSVP Status", "RSVP Note", "RSVPed At",
        "Invite Sent", "Invite Attempts", "Invite Viewed At",
        "Notes", "Tags", "Custom Data", "Created At",
    ])
    for g in guests:
        writer.writerow([
            g.name,
            g.phone or "",
            g.email or "",
            g.rsvp_status,
            g.rsvp_note or "",
            g.rsvped_at.isoformat() if g.rsvped_at else "",
            "Yes" if g.invite_sent else "No",
            g.invite_attempts or 0,
            g.invite_viewed_at.isoformat() if g.invite_viewed_at else "",
            g.notes or "",
            json.dumps(g.tags or [], ensure_ascii=False),
            json.dumps(g.custom_data or {}, ensure_ascii=False),
            g.created_at.isoformat() if g.created_at else "",
        ])

    from fastapi.responses import StreamingResponse
    filename = f"guests-event-{event_id}-{status}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{event_id}/export-rocket")
async def export_rocket(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export guests as CSV for Rocket Sender import (name, phone, invite link)."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    result = await db.execute(
        select(Guest).where(Guest.event_id == event_id).order_by(Guest.name)
    )
    guests = result.scalars().all()

    import csv, io
    from fastapi.responses import StreamingResponse
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(["Name", "Phone", "Invite Link"])
    for g in guests:
        link = invite_link_for(event, g)
        writer.writerow([g.name, g.phone or "", link])

    filename = f"rocket-sender-event-{event_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/{event_id}/export-messages")
async def export_messages(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str = Query("all", description="Filter: all, sent, delivered, failed, queued, read"),
    channel: str = Query("all", description="Filter: all, email, whatsapp, sms"),
):
    """Export invite messages with delivery status as CSV."""
    event_result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not event_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")

    query = (
        select(InviteMessage, Guest.name)
        .join(Guest, InviteMessage.guest_id == Guest.id)
        .where(Guest.event_id == event_id)
    )
    if status != "all":
        query = query.where(InviteMessage.status == status)
    if channel != "all":
        query = query.where(InviteMessage.channel == channel)
    query = query.order_by(InviteMessage.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    import csv, io, json
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(["ID", "Guest ID", "Guest Name", "Channel", "Status", "Sent At", "Delivered At", "Opened At", "Error", "Provider Message ID", "Created At"])
    for m, guest_name in rows:
        writer.writerow([
            m.id, m.guest_id, guest_name,
            m.channel, m.status,
            m.sent_at.isoformat() if m.sent_at else "",
            m.delivered_at.isoformat() if m.delivered_at else "",
            m.opened_at.isoformat() if m.opened_at else "",
            m.error or "",
            m.provider_message_id or "",
            m.created_at.isoformat() if m.created_at else "",
        ])

    from fastapi.responses import StreamingResponse
    filename = f"messages-event-{event_id}-{status}-{channel}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


class TestSendRequest(BaseModel):
    channel: str
    email: str | None = None
    phone: str | None = None


@router.post("/test-send")
async def test_send(
    req: TestSendRequest,
    user: User = Depends(get_current_user),
):
    sent = []
    if req.channel == "email" and req.email:
        ok = await asyncio.wait_for(send_email(req.email, "Accredit.vip Test Message", "<h2>Test Send</h2><p>This is a test message from Accredit.vip.</p>"), timeout=15)
        sent.append(f"email to {req.email}: {'OK' if ok else 'FAILED'}")
    elif req.channel == "whatsapp" and req.phone:
        ok, _ = await _send_whatsapp(req.phone, "Hello! This is a test WhatsApp message from Accredit.vip.")
        sent.append(f"whatsapp to {req.phone}: {'OK' if ok else 'FAILED'}")
    elif req.channel == "sms" and req.phone:
        ok = await send_sms(req.phone, "Hello! This is a test SMS from Accredit.vip.")
        sent.append(f"sms to {req.phone}: {'OK' if ok else 'FAILED'}")
    else:
        return {"message": f"Missing recipient for channel {req.channel}. Provide email for email, phone for whatsapp/sms.", "sent": False}
    return {"message": "Test send completed.", "details": sent, "sent": True}
