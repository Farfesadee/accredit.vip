"""Ticket delivery service - generates QR codes and sends via email/WhatsApp"""

import asyncio
import os
import qrcode
import io
import base64
from datetime import datetime
from app.core.config import settings


BLACK_MARKET_GENERAL_EMAIL = {
    "subject": "YOUR ENTRY BARCODE: BLACK MARKET Movie World Record Attempt",
    "template": "general",
}

BLACK_MARKET_PREMIUM_EMAIL = {
    "subject": "VIP/VVIP Accreditation: BLACK MARKET Movie World Record Attempt",
    "template": "premium",
}


def generate_ticket_qr(
    ticket_reference: str,
    event_title: str,
    event_date: str,
    image_data: bytes | None = None,
) -> str:
    """Generate QR code for ticket and return as base64 image.

    The encoded payload is the public ticket URL, so scanning it with any
    phone camera opens the ticket page with the guest details. The
    accreditation scanner also resolves it (it falls back to the URL's last
    segment, which matches the stored QRCode token).

    If image_data is provided, generates styled QR with embedded image.
    Otherwise falls back to simple black/white QR.
    """
    qr_data = f"{settings.FRONTEND_URL.rstrip('/')}/ticket/{ticket_reference}"

    # Try styled QR if image data available
    if image_data:
        try:
            from app.services.qr_generator import generate_styled_qr
            return generate_styled_qr(qr_data, image_data, size=300)
        except Exception as e:
            print(f"Warning: Failed to generate styled QR for ticket: {e}")

    # Fallback to simple QR
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    img_base64 = base64.b64encode(buffer.getvalue()).decode()

    return img_base64


def save_ticket_qr_image(qr_code_base64: str, reference: str) -> str | None:
    """Persist a generated ticket QR as a hosted PNG and return its public URL.

    Gmail blocks data: URIs, so ticket emails reference this URL instead
    (the data URI stays as a fallback). Returns None on any failure.
    """
    try:
        b64 = qr_code_base64
        if "," in b64 and "base64" in b64.split(",")[0]:
            b64 = b64.split(",", 1)[1]
        upload_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"
        )
        filename = f"ticket-qr-{reference}.png"
        with open(os.path.join(upload_dir, filename), "wb") as f:
            f.write(base64.b64decode(b64))
        return f"{settings.FRONTEND_URL.rstrip('/')}/uploads/{filename}"
    except Exception:
        return None


def format_ticket_email(
    buyer_name: str,
    event_title: str,
    event_date: str,
    event_time: str,
    venue: str,
    ticket_reference: str,
    ticket_count: int,
    amount_paid: float,
    qr_code_base64: str,
    flyer_url: str | None = None,
    qr_image_url: str | None = None,
) -> tuple[str, str]:
    """Format ticket email content - returns (subject, html_content)"""

    subject = f"Your Ticket for {event_title} - {ticket_reference}"
    flyer_html = ""
    if flyer_url:
        flyer_html = (
            f'<img src="{flyer_url}" alt="{event_title}" '
            f'style="width:100%;max-width:600px;height:auto;border-radius:8px;display:block;margin:0 auto 18px;" />'
        )
    # Gmail blocks data: URIs: prefer a hosted image URL when available.
    qr_src = qr_image_url or f"data:image/png;base64,{qr_code_base64}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #1ABC9C, #0D1B2A); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .ticket {{ background: white; border: 1px solid #e8edf2; padding: 20px; }}
            .qr-section {{ text-align: center; margin: 20px 0; }}
            .qr-section img {{ max-width: 200px; }}
            .details {{ background: #f8f9fc; padding: 15px; border-radius: 5px; margin: 15px 0; }}
            .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e8edf2; }}
            .label {{ font-weight: bold; color: #64748b; }}
            .value {{ color: #0D1B2A; }}
            .footer {{ background: #f8f9fc; padding: 15px; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 8px 8px; }}
            .success-badge {{ display: inline-block; background: #dcfce7; color: #166534; padding: 10px 15px; border-radius: 5px; margin: 10px 0; font-weight: bold; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Ticket Confirmed</h1>
                <p>Your ticket has been issued successfully</p>
            </div>

            <div class="ticket">
                {flyer_html}
                <div class="success-badge">✓ Payment Received</div>

                <h2 style="color: #1ABC9C; margin-top: 20px;">{event_title}</h2>

                <div class="details">
                    <div class="detail-row">
                        <span class="label">Ticket Reference:</span>
                        <span class="value">{ticket_reference}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Attendee Name:</span>
                        <span class="value">{buyer_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Number of Tickets:</span>
                        <span class="value">{ticket_count} ticket{'s' if ticket_count > 1 else ''}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Date & Time:</span>
                        <span class="value">{event_date} at {event_time}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Venue:</span>
                        <span class="value">{venue}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Amount Paid:</span>
                        <span class="value" style="color: #166534;">₦{amount_paid:,.0f}</span>
                    </div>
                </div>

                <div class="qr-section">
                    <p style="font-weight: bold; color: #0D1B2A;">Your Entry QR Code</p>
                    <img src="{qr_src}" alt="Ticket QR Code" style="width:200px;height:200px;" />
                    <p style="font-size: 12px; color: #64748b;">Present this QR code at the gate for entry</p>
                </div>

                <div style="background: #e6faf5; padding: 15px; border-radius: 5px; margin: 15px 0;">
                    <p style="font-weight: bold; color: #1ABC9C;">📱 Keep This Email Safe</p>
                    <p style="font-size: 14px; color: #0D1B2A;">You'll need to show this QR code to gain entry to the event. Save this email or take a screenshot.</p>
                </div>
            </div>

            <div class="footer">
                <p>Powered by Accredit Interactive</p>
                <p>If you have any questions, contact us at support@accredit.vip</p>
            </div>
        </div>
    </body>
    </html>
    """

    return subject, html_content


def _bm_section(title: str, inner: str) -> str:
    return (
        f'<div style="background:#ffffff;border:1px solid #F0DCC3;border-radius:10px;'
        f'padding:18px;margin:14px 0;">'
        f'<h3 style="margin:0 0 10px;color:#C2410C;font-size:15px;letter-spacing:1px;">{title}</h3>'
        f"{inner}</div>"
    )


def _bm_timeline_rows(rows: list) -> str:
    return "".join(
        f'<p style="margin:6px 0;font-size:14px;"><strong style="color:#FDBA74;">{t}</strong>'
        f'<span style="color:#FFF8F0;">: {text}</span></p>'
        for t, text in rows
    )


def _bm_important_box(title: str, paragraphs: list) -> str:
    paras = "".join(
        f'<p style="margin:6px 0;font-size:14px;color:#5B3A24;">{p}</p>' for p in paragraphs
    )
    return (
        '<div style="background:#FFF3E8;border:1px solid #C2410C;border-radius:10px;'
        'padding:18px;margin:14px 0;">'
        f'<p style="margin:0 0 8px;font-weight:bold;color:#9A3412;font-size:14px;">{title}</p>'
        f"{paras}</div>"
    )


def _bm_qr_block(qr_src: str, caption: str, sub: str) -> str:
    return (
        '<div style="text-align:center;margin:20px 0;">'
        f'<p style="font-weight:bold;color:#2B1A12;font-size:16px;margin:0 0 10px;">{caption}</p>'
        f'<img src="{qr_src}" alt="Entry Barcode" '
        'style="max-width:250px;border:3px solid #C2410C;border-radius:10px;padding:10px;background:#ffffff;" />'
        f'<p style="font-size:12px;color:#8A6A4F;margin:8px 0 0;">{sub}</p>'
        "</div>"
    )


def _bm_footer() -> str:
    return (
        '<div style="background:#2B1A12;padding:15px;text-align:center;'
        'font-size:12px;color:#FDBA74;border-radius:0 0 10px 10px;font-family:Arial,sans-serif;">'
        "<p style=\"margin:0;letter-spacing:1px;\">ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>"
        "</div>"
    )


def _bm_shell(eyebrow: str, badge: str, ticket_inner: str, qr_block: str) -> str:
    return f"""
        <!DOCTYPE html>
        <html><head><style>
            body {{ font-family: Georgia, serif; line-height: 1.6; color: #2B1A12; background: #FFF8F0; }}
            .container {{ max-width: 650px; margin: 0 auto; padding: 20px; }}
            .header {{ background: #2B1A12; color: #FFF8F0; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .header h1 {{ margin: 0; font-size: 28px; color: #FFF8F0; }}
            .header p {{ margin: 6px 0 0; color: #FDBA74; }}
            .badge {{ display: inline-block; background: #C2410C; color: #FFF8F0; padding: 5px 20px; border-radius: 20px; font-weight: bold; margin-top: 12px; font-size: 13px; letter-spacing: 1px; }}
            .ticket {{ background: #FFF8F0; border: 1px solid #F0DCC3; border-top: none; padding: 22px; border-radius: 0; }}
            .ticket p {{ font-size: 14px; }}
            .darkbox {{ background: #2B1A12; color: #FFF8F0; padding: 20px; border-radius: 10px; margin: 14px 0; text-align: center; }}
        </style></head><body>
        <div class="container">
            <div class="header">
                <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#FDBA74;margin-bottom:6px;">{eyebrow}</div>
                <h1>BLACK MARKET</h1>
                <p>Movie World Record Attempt</p>
                <span class="badge">{badge}</span>
            </div>
            <div class="ticket">
                {ticket_inner}
            </div>
            {qr_block}
            {_bm_footer()}
        </div>
        </body></html>
        """


def format_black_market_email(
    buyer_name: str,
    event_title: str,
    event_date: str,
    event_time: str,
    venue: str,
    ticket_reference: str,
    ticket_count: int,
    amount_paid: float,
    qr_code_base64: str,
    package_name: str,
    is_premium: bool,
    flyer_url: str | None = None,
    qr_image_url: str | None = None,
    org_name: str | None = None,
) -> tuple[str, str]:
    # Gmail blocks data: URIs: prefer a hosted image URL when available.
    qr_src = qr_image_url or f"data:image/png;base64,{qr_code_base64}"
    # Vendor assistants get a duty section naming their vendor team
    # (general variant only). Everyone else renders exactly as approved.
    vendor_section = (
        _bm_section(
            "VENDOR TEAM",
            f"<p>You are accredited as a <strong>vendor assistant</strong> supporting "
            f"<strong>{org_name}</strong> at the BLACK MARKET Movie World Record Attempt.</p>"
            "<p>Please report to your vendor lead on arrival and keep this barcode "
            "readily accessible: it admits you as part of the vendor crew.</p>",
        )
        if (org_name and not is_premium)
        else ""
    )
    # Client-approved design carries no banner header image; flyer_url kept
    # for signature compatibility only.
    if is_premium:
        subject = f"VIP/VVIP Accreditation: {event_title}"
        ticket_inner = (
            f'<p style="color:#8A6A4F;font-size:14px;">Dear {buyer_name},</p>'
            '<p style="font-size:16px;font-weight:bold;color:#2B1A12;margin:10px 0;">'
            "We are excited to welcome you to the BLACK MARKET Movie World Record Attempt "
            "taking place on Saturday, 26 September 2026 at Tafawa Balewa Square, Lagos.</p>"
            "<p>As a VIP/VVIP guest, please find your personal accreditation barcode attached "
            "to this email. Kindly have it readily accessible on your phone upon arrival.</p>"
            + _bm_section(
                "YOUR ENTRY & PARKING",
                '<p><span style="background:#C2410C;color:#FFF8F0;display:inline-block;'
                'padding:4px 16px;border-radius:20px;font-weight:bold;">ZONE D</span></p>'
                "<p><strong>Entry Gate:</strong> Closest to Office of the Surveyor General "
                "of the Federation</p>"
                "<p><strong>For parking, the closest designated car parks to Zone D are:</strong></p>"
                "<p>• <strong>Odeya Car Park</strong></p>"
                "<p>• <strong>East Pavilion Car Park</strong></p>"
                "<p style=\"font-size:13px;color:#8A6A4F;\">Please follow the event signage and "
                "security personnel directing VIP/VVIP guests to Zone D upon arrival.</p>",
            )
            + '<div style="background:#2B1A12;padding:20px;border-radius:10px;margin:14px 0;">'
            '<h3 style="margin:0 0 8px;color:#C2410C;">EVENT TIMELINE</h3>'
            + _bm_timeline_rows(
                [
                    ("2:00 PM", "Gates Open"),
                    ("4:00 PM", "Red Carpet Begins"),
                    ("7:00 PM", "BLACK MARKET Screening Begins"),
                    ("8:30 PM", "Screening Ends"),
                ]
            )
            + "</div>"
            + _bm_important_box(
                "IMPORTANT FOR THE RECORD ATTEMPT",
                [
                    "For your attendance to count as part of the official attempt, you must be "
                    "accredited and checked in before the film begins at 7:00 PM.",
                    "Guests who arrive after the film has started will not be counted.",
                    "You are also required to remain in the screening area and watch the film "
                    "until the end.",
                    "We strongly encourage all VIP/VVIP guests to arrive early to allow sufficient "
                    "time for parking, accreditation and entry.",
                    "<strong>Please, no African Time.</strong>",
                ],
            )
            + _bm_section(
                "Your Presence Counts",
                "<p>Your presence is an important part of this historic moment, and we look "
                "forward to welcoming you to BLACK MARKET.</p>",
            )
            + '<p style="text-align:center;font-size:16px;font-weight:bold;color:#2B1A12;">'
            "See you at TBS.</p>"
            '<p style="text-align:center;font-weight:bold;color:#C2410C;">BLACK MARKET EVENT TEAM</p>'
        )
        qr_block = _bm_qr_block(
            qr_src,
            "Your Personal Accreditation Barcode",
            "Present this barcode at the VIP/VVIP entry gate",
        )
        body = _bm_shell("VIP Accreditation", "★ PREMIUM VIP/VVIP ★", ticket_inner, qr_block)
    else:
        subject = f"YOU'RE IN: {event_title}"
        ticket_inner = (
            f'<p style="color:#8A6A4F;font-size:14px;">Dear {buyer_name},</p>'
            '<p style="font-size:18px;font-weight:bold;color:#2B1A12;margin:10px 0;">'
            "YOU'RE IN. NOW LET'S MAKE HISTORY TOGETHER.</p>"
            "<p>We are excited to welcome you to the BLACK MARKET Movie World Record Attempt "
            "on Saturday, 26 September 2026 at Tafawa Balewa Square, Lagos.</p>"
            "<p>Your personal event barcode is attached to this email.</p>"
            + vendor_section
            + _bm_important_box(
                "IMPORTANT: THIS IS THE BARCODE THAT COUNTS",
                [
                    "Please note that the new barcode attached to this email is your official "
                    "and valid event barcode.",
                    "If you have received or used a previous barcode, please disregard it. The new "
                    "barcode attached here is the one that will be used for your accreditation and "
                    "check-in on the day of the event.",
                    "Please keep this barcode readily accessible on your phone when you arrive. Only "
                    "guests successfully checked in with this barcode before the 7:00 PM screening "
                    "will be counted as part of the attempt.",
                    "Please do not share your barcode with anyone else.",
                ],
            )
            + _bm_section(
                "YOUR ENTRY ZONE",
                "<p><strong>REGULAR ENTRY: ZONE A & ZONE B</strong></p>"
                "<p style=\"font-size:13px;\">Please follow the event signage and directions from "
                "our event stewards when you arrive.</p>",
            )
            + _bm_section(
                "PARKING",
                "<p>The car parks closest to the Regular entry zones are:</p>"
                "<p>• <strong>Hassan Car Park</strong></p>"
                "<p>• <strong>Under Bridge Car Park</strong></p>"
                "<p>• <strong>Banquet Car Park</strong></p>"
                "<p>• <strong>Marquee Car Park</strong></p>"
                "<p>• <strong>Independence Car Park</strong></p>"
                "<p style=\"font-size:13px;color:#8A6A4F;\">Please follow traffic and parking "
                "instructions from the relevant officials and event personnel.</p>",
            )
            + '<div style="background:#2B1A12;padding:20px;border-radius:10px;margin:14px 0;">'
            '<h3 style="margin:0 0 8px;color:#C2410C;">HERE\u2019S WHAT\u2019S HAPPENING</h3>'
            "<p style=\"color:#FFF8F0;\">The event starts long before the movie.</p>"
            + _bm_timeline_rows([("2:00 PM", "Gates Open")])
            + "<p style=\"color:#FFF8F0;\">Come early. There will be plenty happening around the "
            "venue from 2PM, including:</p>"
            "<p style=\"color:#FFF8F0;\">🎁 Live raffle draws from 2PM with amazing gift items to be won</p>"
            "<p style=\"color:#FFF8F0;\">🎤 Live artist performances</p>"
            "<p style=\"color:#FFF8F0;\">🎁 Brand giveaways and gifts throughout the day</p>"
            "<p style=\"color:#FFF8F0;\">🛍️ Vendors on ground with food, drinks and other essentials "
            "available for you</p>"
            "<p style=\"color:#FFF8F0;\">And of course, the BLACK MARKET experience itself.</p>"
            "</div>"
            + '<div style="background:#2B1A12;padding:20px;border-radius:10px;margin:14px 0;">'
            '<h3 style="margin:0 0 8px;color:#C2410C;">EVENT TIMELINE</h3>'
            + _bm_timeline_rows(
                [
                    ("2:00 PM", "Gates Open"),
                    ("4:00 PM", "Red Carpet Begins"),
                    ("7:00 PM", "BLACK MARKET Screening Begins"),
                    ("8:30 PM", "Screening Ends"),
                ]
            )
            + "</div>"
            + _bm_important_box(
                "YOUR PRESENCE COUNTS",
                [
                    "For your attendance to count as part of the official attempt, you must be "
                    "accredited and checked in before the film begins at 7:00 PM.",
                    "If you arrive after the film has started, you will not be counted.",
                    "You must also stay and watch the film until the end. The film has a runtime of "
                    "approximately 1 hour and 30 minutes, ending at about 8:30 PM.",
                    "<strong>So please, no African Time.</strong>",
                ],
            )
            + '<div class="darkbox">'
            '<p style="font-size:20px;font-weight:bold;margin-bottom:5px;color:#FFF8F0;">'
            "LET'S BREAK THIS TOGETHER.</p>"
            "<p style=\"font-size:14px;color:#FFF8F0;\">This isn't just about watching a movie. It is "
            "about showing up, watching BLACK MARKET together and creating a moment that we can all "
            "say we were there for.</p>"
            "<p style=\"font-size:14px;color:#FFF8F0;\">So come early. Bring your energy. Bring your friends.</p>"
            '<p style="font-size:22px;font-weight:bold;color:#C2410C;margin-top:10px;">'
            "BE PART OF HISTORY.</p>"
            "<p style=\"color:#FFF8F0;\">See you at TBS on 26 September 2026.</p>"
            "</div>"
        )
        qr_block = _bm_qr_block(
            qr_src, "Your Entry Barcode", "Present this barcode at the gate for entry"
        )
        body = _bm_shell("General Access", "GENERAL ACCESS", ticket_inner, qr_block)
    return subject, body



def build_ticket_pdf(
    qr_code_base64: str,
    buyer_name: str,
    package_name: str,
    ticket_reference: str,
    event_title: str,
) -> bytes:
    """Build a one-page PDF ticket: buyer name, package, reference and QR code."""
    import io as _io

    from reportlab.lib.colors import HexColor
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image as RLImage
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    TEAL = HexColor("#1ABC9C")
    NAVY = HexColor("#0D1B2A")
    GREY = HexColor("#475569")

    buf = _io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    title_style = ParagraphStyle(
        "TicketTitle", fontSize=22, leading=26, textColor=NAVY,
        alignment=TA_CENTER, fontName="Helvetica-Bold",
    )
    accent_style = ParagraphStyle(
        "TicketAccent", fontSize=14, leading=18, textColor=TEAL,
        alignment=TA_CENTER, fontName="Helvetica-Bold",
    )
    sub_style = ParagraphStyle(
        "TicketSub", fontSize=12, leading=16, textColor=GREY, alignment=TA_CENTER,
    )
    ref_style = ParagraphStyle(
        "TicketRef", fontSize=11, leading=14, textColor=GREY,
        alignment=TA_CENTER, fontName="Helvetica-Bold",
    )
    story = [
        Paragraph(event_title, title_style),
        Spacer(1, 4 * mm),
        Paragraph(package_name, accent_style),
        Spacer(1, 6 * mm),
    ]
    try:
        qr_bytes = base64.b64decode(qr_code_base64)
        story.append(RLImage(_io.BytesIO(qr_bytes), width=60 * mm, height=60 * mm))
    except Exception:
        pass
    story += [
        Spacer(1, 6 * mm),
        Paragraph(buyer_name, ref_style),
        Paragraph(ticket_reference, sub_style),
        Spacer(1, 4 * mm),
        Paragraph("Present this code at the entrance for accreditation.", sub_style),
    ]
    doc.build(story)
    return buf.getvalue()


async def send_ticket_email(
    buyer_email: str,
    buyer_name: str,
    event_title: str,
    event_date: str,
    event_time: str,
    venue: str,
    ticket_reference: str,
    ticket_count: int,
    amount_paid: float,
    qr_code_base64: str,
    template_type: str | None = None,
    package_name: str | None = None,
    flyer_url: str | None = None,
    qr_image_url: str | None = None,
    pdf_bytes: bytes | None = None,
    pdf_filename: str | None = None,
):
    """Send ticket via email (SMTP); attaches the QR PDF when provided."""
    from app.services.email_service import send_email, send_email_with_pdf

    if template_type and template_type == "black_market" and package_name:
        is_premium = "premium" in package_name.lower() or "VIP" in package_name
        subject, html_content = format_black_market_email(
            buyer_name=buyer_name,
            event_title=event_title,
            event_date=str(event_date),
            event_time=str(event_time),
            venue=venue,
            ticket_reference=ticket_reference,
            ticket_count=ticket_count,
            amount_paid=amount_paid,
            qr_code_base64=qr_code_base64,
            package_name=package_name,
            is_premium=is_premium,
            flyer_url=flyer_url,
            qr_image_url=qr_image_url,
        )
    else:
        subject, html_content = format_ticket_email(
            buyer_name=buyer_name,
            event_title=event_title,
            event_date=str(event_date),
            event_time=str(event_time),
            venue=venue,
            ticket_reference=ticket_reference,
            ticket_count=ticket_count,
            amount_paid=amount_paid,
            qr_code_base64=qr_code_base64,
            flyer_url=flyer_url,
            qr_image_url=qr_image_url,
        )

    if pdf_bytes and pdf_filename:
        await asyncio.wait_for(
            send_email_with_pdf(
                to=buyer_email,
                subject=subject,
                html=html_content,
                pdf_bytes=pdf_bytes,
                pdf_filename=pdf_filename,
            ),
            timeout=20,
        )
    else:
        await asyncio.wait_for(
            send_email(to=buyer_email, subject=subject, html=html_content),
            timeout=15,
        )


async def send_ticket_whatsapp(
    buyer_phone: str,
    buyer_name: str,
    ticket_reference: str,
    event_title: str,
    event_date: str,
):
    """Send ticket via WhatsApp using Twilio"""
    import httpx

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        return False

    message = f"""
🎉 *Ticket Confirmed!*

Hi {buyer_name},

Your ticket for *{event_title}* on {event_date} has been confirmed!

Reference: {ticket_reference}

Please check your email for the full ticket details and QR code.

See you at the event! 🎊
    """.strip()

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json",
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                data={
                    "From": settings.TWILIO_PHONE_NUMBER,
                    "To": buyer_phone,
                    "Body": message,
                },
            )
        return True
    except Exception as e:
        print(f"WhatsApp send failed: {e}")
        return False
