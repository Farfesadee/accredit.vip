import json, httpx, asyncio, re
from app.core.config import settings


def _normalize_phone(raw: str) -> str:
    """Normalize to E.164. Strips spaces/dashes/ parens and ensures a + prefix."""
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


async def send_whatsapp(to: str, message: str, media_url: str | None = None, content_vars: dict | None = None, media_urls: list[str] | None = None) -> tuple[bool, str | None]:
    to = _normalize_phone(to)
    """
    Send WhatsApp via Twilio.
    If settings.TWILIO_WHATSAPP_CONTENT_SID is set, sends as content template.
    media_urls (list) sends multiple media attachments in one message (Twilio supports up to 10).
    Returns (success, provider_message_id_or_error).
    """
    if not settings.TWILIO_ACCOUNT_SID:
        print(f"[WhatsApp Mock] To: {to}, Message: {message[:50]}...")
        return True, None

    from_ = settings.TWILIO_WHATSAPP_FROM.removeprefix("whatsapp:")
    # Build as a list of (key, value) tuples so MediaUrl can be repeated for each
    # attachment (Twilio expects MediaUrl repeated per media item). urllib.parse
    # urlencode turns this into a proper repeated-key form body.
    form: list = [
        ("From", f"whatsapp:{from_}"),
        ("To", f"whatsapp:{to}"),
        ("StatusCallback", f"{settings.FRONTEND_URL}/api/v1/webhooks/twilio/status"),
    ]

    sid = content_vars.get("_content_sid") if content_vars else None
    content_sid = sid or settings.TWILIO_WHATSAPP_CONTENT_SID
    if content_sid and content_vars:
        vars_to_send = {k: v for k, v in content_vars.items() if not k.startswith("_")}
        form.append(("ContentSid", content_sid))
        form.append(("ContentVariables", json.dumps(vars_to_send)))
    else:
        form.append(("Body", message))
        urls = media_urls if media_urls else ([media_url] if media_url else [])
        for u in urls:
            form.append(("MediaUrl", u))

    import urllib.parse
    body = urllib.parse.urlencode(form)

    for attempt in range(2):
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    content=body,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if res.is_success:
                    body = res.json()
                    sid = body.get("sid")
                    return True, sid
                error_detail = res.text[:200]
                print(f"[Twilio Error] attempt {attempt + 1}: {res.status_code} - {error_detail}")
                if attempt == 0:
                    await asyncio.sleep(2)
        except Exception as e:
            print(f"[Twilio Exception] attempt {attempt + 1}: {e}")
            if attempt == 0:
                await asyncio.sleep(2)

    return False, "Twilio send failed after retry"
