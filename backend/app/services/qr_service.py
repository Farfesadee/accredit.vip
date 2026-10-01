import qrcode
from io import BytesIO
import base64
import logging
from PIL import Image, ImageDraw
import io
import os
from datetime import datetime

logger = logging.getLogger(__name__)


def generate_qr_code(data: str, size: int = 200) -> Image.Image:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return img.resize((size, size), Image.Resampling.LANCZOS)


def overlay_image_on_qr(qr_img: Image.Image, overlay_img: Image.Image, max_overlay_pct: float = 0.40) -> Image.Image:
    qr_size = qr_img.width
    max_overlay = int(qr_size * max_overlay_pct)
    overlay = overlay_img.convert("RGBA")
    overlay.thumbnail((max_overlay, max_overlay), Image.Resampling.LANCZOS)

    qr_rgba = qr_img.convert("RGBA")
    paste_x = (qr_size - overlay.width) // 2
    paste_y = (qr_size - overlay.height) // 2

    mask = Image.new("L", overlay.size, 0)
    draw = ImageDraw.Draw(mask)
    corner_radius = min(overlay.width, overlay.height) // 6
    draw.rounded_rectangle(
        [(0, 0), (overlay.width - 1, overlay.height - 1)],
        radius=corner_radius, fill=255,
    )

    shadow = Image.new("RGBA", overlay.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        [(0, 0), (overlay.width - 1, overlay.height - 1)],
        radius=corner_radius, fill=(255, 255, 255, 220),
    )
    qr_rgba.paste(shadow, (paste_x, paste_y), shadow)
    qr_rgba.paste(overlay, (paste_x, paste_y), mask)
    return qr_rgba


def generate_image_qr_with_overlay(data: str, image_path: str | None = None, size: int = 200) -> bytes:
    qr_img = generate_qr_code(data, size)

    if image_path and os.path.exists(image_path):
        try:
            overlay = Image.open(image_path)
            qr_img = overlay_image_on_qr(qr_img, overlay)
        except Exception as e:
            logger.warning(f"Failed to overlay image on QR: {e}")

    if qr_img.mode != "RGB":
        qr_img = qr_img.convert("RGB")

    buffer = BytesIO()
    qr_img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer.getvalue()


def qr_to_base64(data: str, size: int = 200) -> str:
    qr_img = generate_qr_code(data, size)
    buffer = BytesIO()
    qr_img.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"


def qr_to_url(data: str, image_path: str | None = None, size: int = 200) -> str | None:
    try:
        png_bytes = generate_image_qr_with_overlay(data, image_path, size)
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "qrs")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"qr_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.png"
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(png_bytes)
        return f"/uploads/qrs/{filename}"
    except Exception as e:
        logger.error(f"Failed to generate QR URL: {e}")
        return None


def styled_qr_to_url(data: str, image_data: bytes | None = None, size: int = 250) -> str | None:
    """Generate a styled QR code with embedded image and return a URL."""
    try:
        from app.services.qr_generator import generate_styled_qr
        qr_base64 = generate_styled_qr(data, image_data, size) if image_data else None
        if not qr_base64:
            return None

        png_bytes = base64.b64decode(qr_base64)
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "qrs")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"styled_qr_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.png"
        filepath = os.path.join(upload_dir, filename)
        with open(filepath, "wb") as f:
            f.write(png_bytes)
        return f"/uploads/qrs/{filename}"
    except Exception as e:
        logger.error(f"Failed to generate styled QR URL: {e}")
        return None
