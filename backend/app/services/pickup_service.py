import os, io, secrets, base64, string, logging
from datetime import datetime, timezone
try:
    from PIL import Image
except ImportError:
    Image = None

from app.core.config import settings

logger = logging.getLogger(__name__)

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "pickup")
LOGO_PATH = os.path.join(ASSETS_DIR, "logo.png")
FLYER_PATH = os.path.join(ASSETS_DIR, "flyer.png")

BRAND_NAME = "Lajokes Fashion"
LOCATION = "Lajokesfashion, 1 Emmanuel High, Ogudu Road, (Opp. Webic Church), Lagos"
VENUE_PHONE = "+2349079004771"

FLYER_URL = "https://accredit.vip/uploads/pickup_flyer.jpeg"


def generate_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_qr_token() -> str:
    import uuid
    return str(uuid.uuid4())


def _resize_image_for_email(image_path: str, max_w: int = 150) -> str:
    try:
        if Image is None:
            return ""
        img = Image.open(image_path).convert("RGBA")
        w, h = img.size
        if w > max_w:
            ratio = max_w / w
            img = img.resize((max_w, int(h * ratio)), Image.LANCZOS)
        elif h > max_w:
            ratio = max_w / h
            img = img.resize((int(w * ratio), max_w), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return ""


def _ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        return f"{n}th"
    suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def format_dt(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    wday = dt.strftime("%A")
    day = dt.day
    month = dt.strftime("%B")
    year = dt.year
    hour = dt.strftime("%I").lstrip("0") or "12"
    minute = dt.strftime("%M")
    ampm = dt.strftime("%p")
    return f"{wday} {_ordinal(day)} {month}, {year} ({hour}:{minute} {ampm}) WAT"


def build_email_html(name: str, code: str, start_time: str, end_time: str) -> str:
    logo_b64 = _resize_image_for_email(LOGO_PATH) if os.path.exists(LOGO_PATH) else ""
    logo_html = f'<img src="data:image/png;base64,{logo_b64}" alt="{BRAND_NAME}" style="max-width:150px;height:auto;display:block"/>' if logo_b64 else ""

    return f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;margin:0">
<table cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden">
<tr><td style="padding:14px 30px;background:#6F3D14;text-align:left">
{logo_html}
</td></tr>
<tr><td style="padding:30px">
<p style="font-size:16px;color:#333">Hi <strong>{name}</strong>,</p>
<p style="font-size:15px;color:#555">Your order is available for pickup at:</p>
<p style="font-size:16px;font-weight:bold;color:#6F3D14">Venue: {LOCATION}</p>
<p style="font-size:14px;color:#555">Phone Number: <a href="https://wa.me/{VENUE_PHONE.replace('+', '')}" style="color:#6F3D14;text-decoration:underline">{VENUE_PHONE}</a></p>
<div style="text-align:center;margin:20px 0">
<img src="{FLYER_URL}" alt="Flyer" style="max-width:100%;height:auto;display:block;margin:0 auto"/>
</div>
<div style="background:#fef6ee;border:1px solid #e8d5b5;border-radius:6px;padding:16px;margin:20px 0;text-align:center">
<p style="font-size:13px;color:#666;margin:0 0 8px">Your one-time code</p>
<p style="font-size:28px;font-weight:bold;color:#6F3D14;letter-spacing:6px;margin:0 0 8px">{code}</p>
</div>
<div style="background:#fef6ee;border:1px solid #f5e6d3;border-radius:6px;padding:12px;margin:20px 0">
<p style="font-size:13px;color:#8B4513;margin:0 0 4px"><strong>Valid</strong></p>
<p style="font-size:14px;color:#555;margin:0">
<strong>From:</strong> {start_time}<br>
<strong>To:</strong> {end_time}</p>
</div>
<div style="background:#fff3e0;border:1px solid #ffcc80;border-radius:6px;padding:12px;margin:20px 0">
<p style="font-size:12px;color:#e65100;margin:0">Kindly present this to an authorized staff member for pickup.</p>
</div>
<p style="font-size:14px;color:#888;margin-top:20px;text-align:center">Service delivered by <strong>{BRAND_NAME}</strong></p>
</td></tr></table></body></html>"""


def build_whatsapp_message(name: str, code: str, start_time: str, end_time: str) -> str:
    return f"""Lajokes Fashion

Hi {name},

Your order is available for pickup at:

Venue: {LOCATION}
Phone Number: {VENUE_PHONE}

Your one-time code: {code}

Valid:
From: {start_time}
To: {end_time}

Kindly present this to an authorized staff member for pickup.

Service delivered by {BRAND_NAME}."""


def format_dt_short(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.strftime("%d/%m/%Y, %I:%M %p")
