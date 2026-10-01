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


async def send_sms_termii(to: str, message: str) -> bool:
    if not settings.TERMII_API_KEY:
        print(f"[SMS Termii Mock] To: {to}, Message: {message[:50]}...")
        return True

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.termii.com/api/sms/send",
            json={
                "api_key": settings.TERMII_API_KEY,
                "to": to,
                "from": "Accredit",
                "sms": message,
                "type": "plain",
                "channel": "generic",
            },
        )
        return res.is_success


async def send_sms_africastalking(to: str, message: str) -> bool:
    if not settings.AFRICASTALKING_API_KEY:
        print(f"[SMS Africa's Talking Mock] To: {to}, Message: {message[:50]}...")
        return True

    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://api.africastalking.com/version1/messaging",
            headers={
                "apiKey": settings.AFRICASTALKING_API_KEY,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "username": settings.AFRICASTALKING_USERNAME,
                "to": to,
                "message": message,
            },
        )
        return res.is_success


async def send_sms(to: str, message: str) -> bool:
    to = _normalize_phone(to)
    if settings.TERMII_API_KEY:
        return await send_sms_termii(to, message)
    return await send_sms_africastalking(to, message)
