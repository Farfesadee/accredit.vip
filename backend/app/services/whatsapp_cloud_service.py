import httpx, re
from app.core.config import settings


def _normalize_phone(raw: str) -> str:
    if not raw:
        return raw
    s = str(raw).strip()
    has_plus = s.startswith("+")
    digits = re.sub(r"\D", "", s)
    if not digits:
        return raw
    if has_plus and digits.startswith("2340") and len(digits) == 14:
        return "+234" + digits[4:]
    if has_plus:
        return "+" + digits
    if digits.startswith("234") and len(digits) >= 12:
        return "+" + digits
    if digits.startswith("0"):
        return "+234" + digits[1:]
    if len(digits) == 10:
        return "+234" + digits
    return "+" + digits


async def send_whatsapp_cloud(to: str, message: str, media_url: str | None = None) -> tuple[bool, str | None]:
    to = _normalize_phone(to)
    """
    Send WhatsApp message via Meta WhatsApp Cloud API.
    Requires: WHATSAPP_CLOUD_TOKEN, WHATSAPP_CLOUD_PHONE_ID in settings.
    """
    token = settings.WHATSAPP_CLOUD_TOKEN
    phone_id = settings.WHATSAPP_CLOUD_PHONE_ID
    if not token or not phone_id:
        print(f"[WhatsApp Cloud Mock] To: {to}, Message: {message[:50]}...")
        return True, None

    data: dict = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+") if to.startswith("+") else to,
        "type": "text",
        "text": {"body": message},
    }
    if media_url:
        from urllib.parse import urlparse
        parsed = urlparse(media_url)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            data["type"] = "image"
            data["image"] = {"link": media_url, "caption": message}

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.post(
                f"https://graph.facebook.com/v22.0/{phone_id}/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=data,
            )
            if not res.is_success:
                print(f"[WhatsApp Cloud Error] {res.status_code}: {res.text}")
                return False, res.text[:200]
            body = res.json()
            msg_id = body.get("messages", [{}])[0].get("id") if body.get("messages") else None
            return True, msg_id
        except Exception as e:
            print(f"[WhatsApp Cloud Exception] {e}")
            return False, str(e)


async def send_whatsapp_cloud_template(
    to: str,
    template_name: str,
    parameters: list[str],
    media_url: str | None = None,
) -> tuple[bool, str | None]:
    to = _normalize_phone(to)
    """
    Send a pre-approved template message via WhatsApp Cloud API.
    Use this for first-contact messages (no opt-in required).
    """
    token = settings.WHATSAPP_CLOUD_TOKEN
    phone_id = settings.WHATSAPP_CLOUD_PHONE_ID
    if not token or not phone_id:
        print(f"[WhatsApp Cloud Template Mock] To: {to}, Template: {template_name}")
        return True, None

    data: dict = {
        "messaging_product": "whatsapp",
        "to": to.lstrip("+"),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": "en"},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in parameters],
                }
            ],
        },
    }
    if media_url:
        data["type"] = "template"
        data["template"]["components"].append(
            {
                "type": "header",
                "parameters": [{"type": "image", "image": {"link": media_url}}],
            }
        )

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.post(
                f"https://graph.facebook.com/v22.0/{phone_id}/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=data,
            )
            if not res.is_success:
                print(f"[WhatsApp Cloud Template Error] {res.status_code}: {res.text}")
                return False, res.text[:200]
            body = res.json()
            msg_id = body.get("messages", [{}])[0].get("id") if body.get("messages") else None
            return True, msg_id
        except Exception as e:
            print(f"[WhatsApp Cloud Template Exception] {e}")
            return False, str(e)
