import httpx
from app.core.config import settings


async def send_evolution_whatsapp(to: str, message: str, media_url: str | None = None) -> tuple[bool, str | None]:
    """
    Send WhatsApp via Evolution API (self-hosted Baileys-based WhatsApp Web API).
    Requires: EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE in settings.
    Fallback for when Twilio/Cloud API fails or hits limits.
    """
    base_url = settings.EVOLUTION_API_URL.rstrip("/")
    api_key = settings.EVOLUTION_API_KEY
    instance = settings.EVOLUTION_INSTANCE

    if not base_url or not api_key or not instance:
        print(f"[Evolution] Not configured: skipping send to {to}")
        return False, "Evolution API not configured"

    headers = {
        "apikey": api_key,
        "Content-Type": "application/json",
    }

    if media_url:
        endpoint = f"{base_url}/message/sendMedia/{instance}"
        payload = {
            "number": to,
            "media": media_url,
            "mediatype": "image",
            "caption": message,
            "delay": 1200,
        }
    else:
        endpoint = f"{base_url}/message/sendText/{instance}"
        payload = {
            "number": to,
            "text": message,
            "delay": 1200,
        }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(endpoint, headers=headers, json=payload)
            if not res.is_success:
                print(f"[Evolution Error] {res.status_code}: {res.text[:200]}")
                return False, res.text[:200]
            body = res.json()
            key = body.get("key", {})
            msg_id = key.get("id") or body.get("messageId") or body.get("id")
            return True, msg_id
    except Exception as e:
        print(f"[Evolution Exception] {e}")
        return False, str(e)
