"""Anchor Evening of Bliss (event 85 only) guest messages.

The client supplied the exact wording for this event, so the words in here are
theirs and are not passed through the generic invite template. Two messages live
here:

* the invite: the client's invitation, with the guest's own RSVP link, dressed
  in the palette taken from their own flier, and
* the pass: the same event details plus the entry code, deliberately with no
  flier, which is the one way this event differs from the normal QR flow.

Nothing in this module is shared with another event. `messaging.py` dispatches
to it behind `is_anchor_event()` and every other event keeps its own builder.
"""

from __future__ import annotations

from html import escape as _escape

from app.core.config import settings

# Palette lifted from the client's own flier.
CREAM = "#F3F1E5"
PAPER = "#FFFDF7"
RED = "#D22E2D"
RED_DARK = "#A8201F"
BROWN = "#5C5048"
INK = "#2E2723"
MUTED = "#7A6E64"
RULE = "#E2DAC9"

TITLE = "Anchor Evening of Bliss"
PITCH = "An evening hosted by Anchor Insurance Company."
PITCH_LOWER = "an evening hosted by Anchor Insurance Company."
HOST = "Anchor Insurance Company"

# The client's approved lines, kept verbatim. Event 85's stored start time is a
# placeholder; the approved invitation says 3 PM, so the copy wins here.
DATE_LINE = "Saturday, December 12th, 2026"
VENUE_LINE = "Harbour Point Marquee, Victoria Island, Lagos."
TIME_LINE = "3 PM (WAT)"
DRESS_LINE = "Contemporary Native (No Agbada. No Gele.)"

SERIF = "Georgia,'Times New Roman',serif"
SANS = "Arial,Helvetica,sans-serif"


def _abs(url: str | None) -> str | None:
    if not url:
        return None
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if url.startswith("/"):
        return f"{settings.FRONTEND_URL}{url}"
    return url


def _details_rows(include_dress: bool = True) -> list[tuple[str, str]]:
    rows = [
        ("Date", DATE_LINE),
        ("Venue", VENUE_LINE),
        ("Time", TIME_LINE),
    ]
    if include_dress:
        rows.append(("Dress code", DRESS_LINE))
    return rows


def _details_card(include_dress: bool = True) -> str:
    cells = []
    for label, value in _details_rows(include_dress):
        cells.append(
            "<tr>"
            f'<td valign="top" style="padding:12px 14px 12px 0;border-bottom:1px solid {RULE};'
            f"font:600 10px/1.2 {SANS};letter-spacing:2px;text-transform:uppercase;"
            f'color:{RED};width:96px">{_escape(label)}</td>'
            f'<td valign="top" style="padding:12px 0;border-bottom:1px solid {RULE};'
            f'font:400 15px/1.55 {SERIF};color:{INK}">{_escape(value)}</td>'
            "</tr>"
        )
    return (
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="border-collapse:collapse;border-top:1px solid '
        + RULE
        + '">'
        + "".join(cells)
        + "</table>"
    )


def _shell(inner: str, header_band: str) -> str:
    """Cream page, red band, and the platform footer shared by both mails."""
    return (
        f'<div style="margin:0;padding:0;background:{CREAM}">'
        f'<div style="max-width:600px;margin:0 auto;background:{CREAM};'
        f'font-family:{SERIF};color:{INK}">'
        f"{header_band}"
        f"{inner}"
        f'<div style="padding:26px 28px 34px;text-align:center;border-top:1px solid {RULE}">'
        f'<p style="margin:0 0 4px;font:600 11px/1.6 {SANS};letter-spacing:2.4px;'
        f'text-transform:uppercase;color:{BROWN}">{HOST}</p>'
        f'<p style="margin:0;font:400 11px/1.6 {SANS};color:{MUTED};letter-spacing:.6px">'
        "ACCREDIT INTERACTIVE - Premium Event Infrastructure</p>"
        "</div>"
        "</div></div>"
    )

def _band(kicker: str, title: str, sub: str) -> str:
    return (
        f'<div style="background:{RED};padding:34px 28px 30px;text-align:center">'
        f'<p style="margin:0 0 12px;font:600 10px/1 {SANS};letter-spacing:3.4px;'
        f'text-transform:uppercase;color:#F7C9C8">{_escape(kicker)}</p>'
        f'<h1 style="margin:0 0 10px;font:400 32px/1.18 {SERIF};color:#FFFFFF;letter-spacing:.4px">'
        f"{_escape(title)}</h1>"
        f'<p style="margin:0;font:italic 400 14px/1.5 {SERIF};color:#FBE3E2">{_escape(sub)}</p>'
        "</div>"
    )


def _slim_band(kicker: str) -> str:
    """One line of red used under the flyer, where the artwork already carries
    the title and the pitch, so the mail never says them twice."""
    return (
        f'<div style="background:{RED};padding:16px 28px;text-align:center">'
        f'<p style="margin:0;font:600 10px/1 {SANS};letter-spacing:3.4px;'
        f'text-transform:uppercase;color:#FFFFFF">{_escape(kicker)}</p>'
        "</div>"
    )


def _rule_ornament() -> str:
    return (
        f'<div style="margin:0 auto 18px;width:64px;height:2px;background:{RED};'
        'border-radius:2px"></div>'
    )


def _build_anchor_invite_message(
    guest,
    event,
    rsvp_link: str,
    flyer_url: str | None = None,
) -> tuple[str, str, str]:
    """The client's invitation, with the guest's own RSVP link.

    The flyer leads the mail (the normal invite flow for every other event), the
    wording underneath is the copy the client approved, and the only personal
    detail is the RSVP link plus a reserved-for line.
    """
    guest_name = (getattr(guest, "name", None) or "Guests").strip()
    link = rsvp_link

    subject = f"{TITLE}: Invitation"

    body = (
        f"{TITLE}, {PITCH_LOWER}\n"
        "\n"
        f"Date: {DATE_LINE}\n"
        "\n"
        f"Venue: {VENUE_LINE}\n"
        "\n"
        f"Time: {TIME_LINE}\n"
        "\n"
        f"Dress code: {DRESS_LINE}\n"
        "\n"
        f"RSVP: {link}\n"
        "\n"
        f"{HOST}"
    )

    flyer_html = ""
    absolute_flyer = _abs(flyer_url)
    if absolute_flyer:
        flyer_html = (
            f'<img src="{_escape(absolute_flyer)}" alt="{_escape(TITLE)}" width="600" '
            'style="display:block;width:100%;max-width:600px;height:auto;border:0" />'
        )

    inner = (
        '<div style="padding:34px 28px 6px">'
        f'<p style="margin:0 0 14px;font:600 10px/1 {SANS};letter-spacing:2.6px;'
        f'text-transform:uppercase;color:{RED}">Invitation</p>'
        f'<p style="margin:0 0 6px;font:400 16px/1.7 {SERIF};color:{INK}">'
        f"{_escape(TITLE)}, {_escape(PITCH_LOWER)}</p>"
        f'<p style="margin:0 0 26px;font:400 13px/1.7 {SANS};color:{MUTED}">'
        f"Reserved for {_escape(guest_name)}</p>"
        f"{_details_card()}"
        "</div>"
        '<div style="padding:8px 28px 34px;text-align:center">'
        f'<a href="{_escape(link)}" style="display:inline-block;background:{RED};color:#FFFFFF;'
        f"font:700 12px/1 {SANS};letter-spacing:2px;text-transform:uppercase;text-decoration:none;"
        f'padding:16px 38px;border-radius:3px">{_escape("RSVP Now")}</a>'
        f'<p style="margin:18px 0 0;font:400 12px/1.7 {SANS};color:{MUTED}">'
        "Or open your personal link:</p>"
        f'<p style="margin:4px 0 0;font:400 12px/1.7 {SANS};word-break:break-all">'
        f'<a href="{_escape(link)}" style="color:{RED_DARK};text-decoration:underline">'
        f"{_escape(link)}</a></p>"
        "</div>"
    )

    html = _shell(inner, flyer_html + _slim_band("Anchor Insurance Company presents"))
    return subject, body, html


def _build_anchor_qr_message(guest, event, qr_image_url: str | None = None):
    """The entry pass: event details plus the code, and deliberately no flier."""
    guest_name = (getattr(guest, "name", None) or "Guest").strip()

    subject = f"Your Entry Pass: {TITLE}"

    body = (
        f"{TITLE}, an evening hosted by Anchor Insurance Company.\n"
        "\n"
        f"Dear {guest_name},\n"
        "\n"
        "Your entry code is ready. Please present the QR code below at the entrance.\n"
        "\n"
        f"Date: {DATE_LINE}\n"
        "\n"
        f"Venue: {VENUE_LINE}\n"
        "\n"
        f"Time: {TIME_LINE}\n"
        "\n"
        f"Dress code: {DRESS_LINE}\n"
        "\n"
        "This pass admits one guest.\n"
        "\n"
        f"{HOST}"
    )

    qr_html = ""
    absolute_qr = _abs(qr_image_url)
    if absolute_qr:
        qr_html = (
            f'<img src="{_escape(absolute_qr)}" alt="Entry QR Code" width="230" height="230" '
            'style="display:block;margin:0 auto;width:230px;height:230px;border:0" />'
        )

    inner = (
        '<div style="padding:32px 28px 10px;text-align:center">'
        f'<p style="margin:0 0 16px;font:600 10px/1 {SANS};letter-spacing:2.8px;'
        f'text-transform:uppercase;color:{RED}">Entry Pass</p>'
        f'<p style="margin:0 0 6px;font:400 17px/1.55 {SERIF};color:{INK}">'
        f"Dear {_escape(guest_name)},</p>"
        f'<p style="margin:0 0 24px;font:400 14px/1.7 {SANS};color:{MUTED}">'
        "Your entry code is ready. Please present the QR code below at the entrance.</p>"
        f'<div style="background:{PAPER};border:1px solid {RULE};border-radius:6px;'
        'padding:22px 18px;display:inline-block">'
        f"{qr_html}"
        "</div>"
        f'<p style="margin:20px 0 0;font:600 11px/1.6 {SANS};letter-spacing:1.8px;'
        f'text-transform:uppercase;color:{RED_DARK}">This pass admits one guest</p>'
        "</div>"
        '<div style="padding:26px 28px 30px">'
        f"{_rule_ornament()}"
        f"{_details_card()}"
        "</div>"
    )

    html = _shell(inner, _band("Anchor Insurance Company presents", TITLE, PITCH))
    return subject, body, html
