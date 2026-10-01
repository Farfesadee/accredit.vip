import asyncio
import os
import smtplib
import ssl
from email.mime.image import MIMEImage
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from app.core.config import settings


async def send_email(to: str, subject: str, html: str, from_addr: str | None = None) -> bool:
    sender = from_addr or settings.EMAIL_FROM
    for label, host, port, username, password in _smtp_accounts():
        ok = await _send_smtp(to, subject, html, sender, host, port, username, password, label)
        if ok:
            return True
        print(f"[Email] {label} failed, trying next sender...")
    if settings.SENDGRID_API_KEY:
        ok = await _send_sendgrid(to, subject, html, sender)
        if ok:
            return True
        print("[Email] SendGrid failed, trying Resend...")
    if settings.RESEND_API_KEY:
        return await _send_resend(to, subject, html, sender)
    print(f"[Email Mock] From: {sender} -> To: {to}, Subject: {subject}")
    return True


def _smtp_accounts() -> list[tuple[str, str, int, str, str]]:
    """All configured SMTP senders in failover order (primary first)."""
    accounts = [
        ("SMTP", settings.SMTP_HOST, settings.SMTP_PORT, settings.SMTP_USERNAME, settings.SMTP_PASSWORD),
        ("SMTP2", settings.SMTP2_HOST, settings.SMTP2_PORT, settings.SMTP2_USERNAME, settings.SMTP2_PASSWORD),
        ("SMTP3", settings.SMTP3_HOST, settings.SMTP3_PORT, settings.SMTP3_USERNAME, settings.SMTP3_PASSWORD),
        ("SMTP4", settings.SMTP4_HOST, settings.SMTP4_PORT, settings.SMTP4_USERNAME, settings.SMTP4_PASSWORD),
    ]
    return [(label, host, port, user, pw) for (label, host, port, user, pw) in accounts if host and user]


async def send_email_with_pdf(
    to: str,
    subject: str,
    html: str,
    pdf_bytes: bytes,
    pdf_filename: str,
    from_addr: str | None = None,
) -> bool:
    """Send HTML email with a PDF attachment (tries each SMTP sender in order)."""
    from email.mime.application import MIMEApplication

    sender = from_addr or settings.EMAIL_FROM
    accounts = _smtp_accounts()
    if not accounts:
        print("[Email] No SMTP sender configured, cannot send PDF attachment")
        return False
    msg = MIMEMultipart("mixed")
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    part = MIMEApplication(pdf_bytes, _subtype="pdf")
    part.add_header("Content-Disposition", "attachment", filename=pdf_filename)
    msg.attach(part)
    envelope_from = _extract_email(sender) or sender
    for label, host, port, username, password in accounts:
        try:
            ok = await asyncio.wait_for(
                asyncio.to_thread(_sync_send_smtp, msg, to, envelope_from, host, port, username, password),
                timeout=60,
            )
            if ok:
                return True
            print(f"[Email] {label} failed, trying next sender...")
        except asyncio.TimeoutError:
            print(f"[SMTP Error] {label} timed out after 60s")
    return False


async def send_email_with_images(to: str, subject: str, html: str, images: list[tuple[str, str]], from_addr: str | None = None) -> bool:
    """Send HTML email with inline images embedded as MIME attachments (cid: references).
    images: list of (cid_name, filepath) tuples. HTML should reference them as <img src='cid:cid_name'>.
    Tries SMTP first, falls back to SendGrid, then Resend if available.
    """
    sender = from_addr or settings.EMAIL_FROM
    for label, host, port, username, password in _smtp_accounts():
        ok = await _send_smtp_with_images(to, subject, html, images, sender, host, port, username, password, label)
        if ok:
            return True
        print(f"[Email] {label} failed, trying next sender...")
    if settings.SENDGRID_API_KEY:
        ok = await _send_sendgrid_with_images(to, subject, html, images, sender)
        if ok:
            return True
        print("[Email] SendGrid failed, trying Resend...")
    if settings.RESEND_API_KEY:
        return await _send_resend_with_images(to, subject, html, images, sender)
    print(f"[Email Mock] From: {sender} -> To: {to}, Subject: {subject}")
    return True


def _build_multipart_with_images(html: str, images: list[tuple[str, str]]) -> MIMEMultipart:
    msg = MIMEMultipart("related")
    msg.attach(MIMEText(html, "html"))
    for cid, filepath in images:
        try:
            with open(filepath, "rb") as f:
                img_data = f.read()
            subtype = filepath.rsplit(".", 1)[-1] if "." in filepath else None
            img = MIMEImage(img_data, _subtype=subtype)
            img.add_header("Content-ID", f"<{cid}>")
            img.add_header("Content-Disposition", "inline")
            msg.attach(img)
        except Exception as e:
            print(f"[Email] Failed to attach image {filepath}: {e}")
    return msg


async def _send_smtp(to: str, subject: str, html: str, from_addr: str, host: str, port: int, username: str, password: str, label: str = "SMTP") -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    size_kb = len(msg.as_string()) / 1024
    print(f"[{label}] Sending {size_kb:.1f}KB email to {to} via {host}...")
    envelope_from = _extract_email(from_addr) or from_addr

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_sync_send_smtp, msg, to, envelope_from, host, port, username, password),
            timeout=60
        )
    except asyncio.TimeoutError:
        print(f"[{label} Error] Timed out after 60s")
        return False


def _extract_email(addr: str) -> str | None:
    import re
    m = re.search(r'<([^>]+)>', addr)
    return m.group(1) if m else None


def _sync_send_smtp(msg, to: str, envelope_from: str, host: str, port: int, username: str, password: str) -> bool:
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as server:
            server.login(username, password)
            server.sendmail(envelope_from, [to], msg.as_string())
        print(f"[SMTP] Sent successfully to {to} via {host}")
        return True
    except Exception as e:
        print(f"[SMTP Error] {host}: {e}")
        return False


async def _send_smtp_with_images(to: str, subject: str, html: str, images: list[tuple[str, str]], from_addr: str, host: str, port: int, username: str, password: str, label: str = "SMTP") -> bool:
    envelope_from = _extract_email(from_addr) or from_addr
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(_sync_send_smtp_with_images, html, images, subject, to, from_addr, envelope_from, host, port, username, password),
            timeout=60
        )
    except asyncio.TimeoutError:
        print(f"[{label} Error] Timed out after 60s")
        return False


def _sync_send_smtp_with_images(html: str, images: list[tuple[str, str]], subject: str, to: str, from_addr: str, envelope_from: str, host: str, port: int, username: str, password: str) -> bool:
    try:
        msg = _build_multipart_with_images(html, images)
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = to
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as server:
            server.login(username, password)
            server.sendmail(envelope_from, [to], msg.as_string())
        print(f"[SMTP] Sent successfully to {to} via {host}")
        return True
    except Exception as e:
        print(f"[SMTP Error] {host}: {e}")
        return False


def _split_sender(from_addr: str) -> tuple[str, str | None]:
    """Split 'Name <email>' into (email, name) for APIs that need them separate."""
    email = _extract_email(from_addr) or from_addr
    name = from_addr.rsplit("<", 1)[0].strip().strip('"') or None
    if name == email:
        name = None
    return email, name


async def _send_sendgrid(to: str, subject: str, html: str, from_addr: str) -> bool:
    try:
        from_email, from_name = _split_sender(from_addr)
        sender_obj = {"email": from_email}
        if from_name:
            sender_obj["name"] = from_name
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": sender_obj,
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html}],
                },
            )
            return res.is_success
    except Exception as e:
        print(f"[SendGrid Error] {e}")
        return False


async def _send_sendgrid_with_images(to: str, subject: str, html: str, images: list[tuple[str, str]], from_addr: str) -> bool:
    try:
        from_email, from_name = _split_sender(from_addr)
        sender_obj = {"email": from_email}
        if from_name:
            sender_obj["name"] = from_name
        attachments = []
        for cid, filepath in images:
            try:
                with open(filepath, "rb") as f:
                    img_data = f.read()
                import base64
                encoded = base64.b64encode(img_data).decode()
                subtype = filepath.rsplit(".", 1)[-1] if "." in filepath else "png"
                attachments.append({
                    "content": encoded,
                    "type": f"image/{subtype}",
                    "filename": f"{cid}.{subtype}",
                    "disposition": "inline",
                    "content_id": cid,
                })
            except Exception as e:
                print(f"[SendGrid] Failed to attach {filepath}: {e}")
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": sender_obj,
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html}],
                    "attachments": attachments,
                },
            )
            return res.is_success
    except Exception as e:
        print(f"[SendGrid Error] {e}")
        return False


async def _send_resend_with_images(to: str, subject: str, html: str, images: list[tuple[str, str]], from_addr: str) -> bool:
    try:
        attachments = []
        for cid, filepath in images:
            try:
                with open(filepath, "rb") as f:
                    img_data = f.read()
                import base64
                encoded = base64.b64encode(img_data).decode()
                subtype = filepath.rsplit(".", 1)[-1] if "." in filepath else "png"
                attachments.append({
                    "content": encoded,
                    "filename": f"{cid}.{subtype}",
                    "disposition": "inline",
                    "content_id": cid,
                })
            except Exception as e:
                print(f"[Resend] Failed to attach {filepath}: {e}")
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": from_addr,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "attachments": attachments,
                },
            )
            return res.is_success
    except Exception as e:
        print(f"[Resend Error] {e}")
        return False


async def _send_resend(to: str, subject: str, html: str, from_addr: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": from_addr,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
            return res.is_success
    except Exception as e:
        print(f"[Resend Error] {e}")
        return False
