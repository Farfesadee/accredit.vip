"""Public self-registration / RSVP for regular (non-burial) events.

Provides a public form flow where guests fill in name, email, phone and a
Yes/No attendance response. Submitted registrations create Guest records that
appear in the organizer's dashboard Guests tab, where the organizer can send
QR codes and confirmatory messages (which include the event flyer).
"""

import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.event import Event
from app.models.guest import AsoEbiOrder, Guest
from app.models.flier import FlierAsset
from app.models.user import User

router = APIRouter()


class RegistrationRequest(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    response: str = "accepted"
    organization: str = ""
    sub_department: str = ""
    category: str = ""
    # Event 82 (gala) only: one companion on the same pass. Ignored elsewhere.
    plus_one: bool = False
    plus_one_name: str = ""


# Wedding experience (Patrick & Sarah, Dec 19 2026). Everything gated on
# this slug so no other event's flow, templates or behavior change.
WEDDING_SLUGS = ("patrick-sarah-white-wedding",)


def is_wedding_event(event: Event) -> bool:
    return (event.slug or "") in WEDDING_SLUGS


ASOEBI_PRICE = 100000
ASOEBI_BANK = {"bank": "Zenith Bank", "number": "2051777597", "name": "Anadoo Ayegh"}
ASOEBI_WHATSAPP = "+2349046751511"


def wedding_content() -> dict:
    from urllib.parse import quote

    return {
        "groom": "Patrick Ekperikpe Ekpo",
        "bride": "Sarah Ekene Elumeze",
        "hashtag": "#HeavyOnTheEkpos",
        "countdown_to": "2026-12-19T12:00:00+01:00",
        "ceremony": {
            "label": "White Wedding Ceremony",
            "venue": "Church of the Assumption",
            "location": "No. 2 Kwame Nkrumah Cres, Asokoro Abuja",
            "date": "Saturday, December 19, 2026",
            "time": "12:00 PM",
        },
        "reception": {
            "venue": "Los Angeles Event Center, Kado, Abuja",
            "time": "3:00 PM",
        },
        # Two days, two looks. The white wedding is black tie and pastels; the
        # traditional, two days earlier, is green for the men and asoebi for
        # the women (client direction, October 2026).
        "dress_code": {
            "label": "Dress Code",
            "message": "Come dressed for each with us.",
            "wedding": {
                "label": "The White Wedding",
                "when": "Saturday, 19 December 2026",
                "men": "Suit or black tie",
                "women": "Pastel colours",
                "note": "Gentlemen, a suit or black tie. Ladies, soft pastel tones.",
            },
            "traditional": {
                "label": "The Traditional Wedding",
                "when": "Thursday, 17 December 2026",
                "men": "Green, the colour of the day",
                "women": "Asoebi",
                "note": "Gentlemen wear green, the colour of the day. Asoebi is for the ladies only.",
            },
            # Names only: the client asked us to drop the colour swatches and
            # keep the shade names as words.
            "colors": [
                "Blush Pink",
                "Powder Blue",
                "Lavender",
                "Sage Green",
                "Soft Peach",
                "Butter Yellow",
                "Dusty Rose",
            ],
            "colors_note": "Pastel shades for the ladies at the white wedding.",
        },
        "video_url": "/uploads/wedding-0cd6a8bc64df.mp4",
        # Opening curtain the client supplied (their montage). Silent clip: the
        # music below plays over it. reveal_at is the moment the curtain has
        # fully left the frame, so the invitation photo takes over instead of
        # sitting on the black tail of the clip.
        "invite_video_url": "/uploads/patrick-sarah-opening.mp4",
        "invite_poster_url": "/uploads/patrick-sarah-opening-poster.jpg",
        "reveal_at": 2.4,
        "hero_image": "/uploads/wedding-7e961344fddf.jpg",
        "hero_line": "To join in the celebration of love at their White Wedding, Abuja, Saturday 19 December 2026.",
        "photos": [
            "/uploads/wedding-313c597dfe3a.jpg",
            "/uploads/wedding-7e961344fddf.jpg",
            "/uploads/wedding-476c3bda1342.jpg",
        ],
        "monogram_url": "/uploads/wedding-crest-cream.png",
        "hotels_note": "For our guests coming from outside Nigeria or far from Abuja who need a place to stay before the wedding.",
        "hotels": [
            {"name": "Fraser Suites", "address": "Plot 294, Leventis Close, Central Business District, Abuja"},
            {"name": "Transcorp Hilton", "address": "1 Aguiyi Ironsi Street, Maitama District, Abuja"},
            {"name": "Summerset Continental Hotels", "address": "73 Usuma St, Maitama, Abuja 900271, FCT"},
            {"name": "John Woods", "address": "6 Sokode Crescent, Wuse Zone 5, Abuja, FCT"},
            {"name": "Bolton White", "address": "7 Gwandu Street, Area 11, Garki, opposite Sahad Stores, Abuja, FCT"},
            {"name": "Belanova Apartment", "address": "Plot 3349 Lualaba Close, Off Madeira Street, Maitama District, Abuja"},
            {"name": "The Palms Hotel", "address": "Plot 269, Muhammadu Buhari Way, Central Business District, Abuja"},
        ],
        # The traditional holds two days before the white wedding. Only the date
        # and the dress direction are stated: the couple has not published a
        # traditional venue, so the page never invents one.
        "traditional": {
            "label": "The Traditional Wedding",
            "date": "Thursday, 17 December 2026",
            "note": "The asoebi is worn at the traditional. Gentlemen wear green, the colour of the day.",
        },
        # Friends of the couple asoebi: for the ladies, worn at the traditional
        # on 17 December. The client was explicit that men do not wear it.
        "asoebi": {
            "name": "Friends of the Couple Asoebi",
            "short": "Asoebi",
            "for_who": "For the ladies",
            "occasion": "Worn at the traditional wedding, Thursday, 17 December 2026.",
            "note": "Asoebi is for the women only. Gentlemen, your colour of the day for the traditional is green.",
            "price": ASOEBI_PRICE,
            "items": ["3 yards of lace", "3 yards of lining", "Gele", "Souvenir from the couple"],
            "bank": ASOEBI_BANK,
            "whatsapp": ASOEBI_WHATSAPP,
            "whatsapp_link": "https://wa.me/2349046751511?text=" + quote("Hello, I just paid for the Asoebi package. Please confirm my payment."),
        },
        # Anything about the day, answered from the details above. No invented
        # facts: times, venues, dress and the asoebi are all on the invitation.
        "faq": [
            {
                "q": "What time should I arrive?",
                "a": "The white wedding ceremony begins at 12:00 PM at Church of the Assumption, Asokoro. Please come a little early so you are seated before the procession.",
            },
            {
                "q": "Where do I go after the church?",
                "a": "The reception follows from 3:00 PM at Los Angeles Event Center, Kado, Abuja. The When and Where section carries directions from wherever you are.",
            },
            {
                "q": "What should I wear to the white wedding?",
                "a": "Gentlemen, a suit or black tie. Ladies, pastel colours in soft, sophisticated tones. The shade names are on the Dress Code section if you want a steer.",
            },
            {
                "q": "What should I wear to the traditional?",
                "a": "The traditional holds on Thursday, 17 December 2026. Gentlemen wear green, the colour of the day. Ladies wear the friends of the couple asoebi.",
            },
            {
                "q": "Who is the asoebi for, and how do I get it?",
                "a": "The asoebi is for the ladies, worn at the traditional wedding on 17 December 2026. Open the Aso Ebi page, pay into the account shown, then claim your reference and send your receipt on WhatsApp.",
            },
            {
                "q": "Do I need to RSVP?",
                "a": "Yes, please. The RSVP is how we count for the catering and the seating, and it is the list the organisers work from.",
            },
            {
                "q": "How do I get into the venue on the day?",
                "a": "Once you confirm, your entry QR code is sent to you by email or WhatsApp. Please have it ready at the door.",
            },
            {
                "q": "Where can I stay?",
                "a": "The Hotel Recommendations section lists hotels close to the venues, with directions from your current location. Please book directly with the hotel you choose.",
            },
        ],
    }


# Nelkon & Blessing Obi-Uzu 30th Wedding Anniversary (event 84).
# Everything gated on this slug so no other event's flow, templates or
# behavior change.
ANNIVERSARY_SLUGS = ("nelkon-blessing-30th-anniversary",)


def is_anniversary_event(event: Event) -> bool:
    return (event.slug or "") in ANNIVERSARY_SLUGS


def anniversary_content() -> dict:
    return {
        "groom": "Nelkon",
        "bride": "Blessing",
        "surname": "Obi-Uzu",
        "hashtag": "#NelkonBlessing30",
        "since": "December 1996",
        "countdown_to": "2026-12-15T15:00:00+01:00",
        "ceremony": {
            "label": "30th Wedding Anniversary",
            "venue": "Landmark Centre, Hall 2",
            "location": "Plot 3 & 4, Water Corporation Road, Victoria Island, Lagos",
            "date": "Tuesday, December 15, 2026",
            "time": "3:00 PM",
        },
        "dress_code": {
            "label": "Dress Code",
            "theme": "Elegant",
            "note": "Come dressed to celebrate thirty years with us.",
            "colors": [],
        },
        # One companion rides on the guest's own pass (same rule as event 82).
        "plus_one": {
            "allowed": True,
            "note": "Your invitation admits two: you and one companion.",
        },
        # Short montage cut from the couple's own photographs, set to "Ordinary".
        # Versioned so a replaced cut is never served from cache.
        "video_url": "/uploads/anniversary-montage.mp4?v=4",
        "invite_video_url": "/uploads/anniversary-montage.mp4?v=4",
        # The opening carries their traditional attire portrait (red cap, white
        # agbada, red lace), which the client chose by name, so the names and
        # "Together since December 1996" read at a glance on a phone. The page
        # shows the whole frame, never a crop, so both of them stay in view.
        "invite_poster_url": "/uploads/anniv-hero.jpg?v=3",
        "hero_image": "/uploads/anniv-hero.jpg?v=3",
        "hero_line": "Celebrating 30 beautiful years of love, laughter and lifelong companionship.",
        # Gallery: six whole frames from the photographs the client sent in
        # October 2026. Nothing is cropped, so no one is ever cut at the edge of
        # a frame. width/height travel with each one so the boxes hold their
        # shape before the bytes arrive (no layout shift while a guest scrolls).
        "photos": [
            {
                "url": "/uploads/anniv-g1.jpg?v=3",
                "caption": "Still them",
                "note": "Thirty years on",
                "width": 900,
                "height": 1200,
            },
            {
                "url": "/uploads/anniv-g2.jpg?v=3",
                "caption": "Black tie",
                "note": "An evening out",
                "width": 900,
                "height": 1200,
            },
            {
                "url": "/uploads/anniv-g3.jpg?v=3",
                "caption": "Out and about",
                "note": "Somewhere warm",
                "width": 900,
                "height": 1200,
            },
            {
                "url": "/uploads/anniv-g4.jpg?v=3",
                "caption": "Laughing",
                "note": "Still",
                "width": 900,
                "height": 1200,
            },
            {
                "url": "/uploads/anniv-g5.jpg?v=3",
                "caption": "Dressed up",
                "note": "Ready to celebrate",
                "width": 900,
                "height": 1200,
            },
            {
                "url": "/uploads/anniv-g6.jpg?v=3",
                "caption": "The family",
                "note": "All of us, together",
                "width": 900,
                "height": 1200,
            },
        ],
        "music_url": "/uploads/anniversary-ordinary.mp3",
    }


# The Art of Attention (exclusive lifestyle gala dinner + book launch).
# Everything gated on this slug so no other event's flow, templates or
# behavior change.
GALA_SLUGS = ("the-art-of-attention",)


def is_gala_event(event: Event) -> bool:
    return (event.slug or "") in GALA_SLUGS


def experience_for(event: Event) -> str:
    """Which cinematic page an event opens with.

    "wedding", "anniversary" and "gala" are the events that open with a film
    and a montage, so every RSVP link they send (invite, pass, resend, host
    link) has to land on that page. "standard" means the event has no film at
    all, and the generic RSVP page is the right surface for it.
    """
    if is_wedding_event(event):
        return "wedding"
    if is_anniversary_event(event):
        return "anniversary"
    if is_gala_event(event):
        return "gala"
    return "standard"


def gala_content() -> dict:
    from urllib.parse import quote

    venue_query = "Federal Palace Hotel and Casino, Victoria Island, Lagos"
    after_query = "Proxy Lagos"

    return {
        # Client direction (Oct 2026): the invitation leads with the gala dinner
        # experience. The Art of Attention and its book launch stay present, but
        # only as a quiet part of the evening, never the headline.
        "title": "A Gala Dinner Experience",
        "title_lines": ["A Gala Dinner", "Experience"],
        "kicker": "An Exclusive Lifestyle Gala",
        "line": "An evening of fine dining, presence and quiet power.",
        "book_launch": {
            "title": "The Art of Attention",
            "note": "The evening will also mark the launch of The Art of Attention, with a short reading from the author.",
        },
        "plus_one": {
            "allowed": True,
            "note": "Your invitation admits two: you and one companion.",
        },
        "host": "The Iconic Lifestyle Connoisseur",
        "countdown_to": "2026-12-02T17:00:00+01:00",
        "date": {
            "full": "Wednesday, 2 December 2026",
            "weekday": "Wednesday",
            "day": "2",
            "month": "December",
            "year": "2026",
        },
        "red_carpet": "5:00 PM prompt",
        "venue": {
            "name": "Federal Palace Hotel",
            "room": "Balmoral Convention Centre",
            "location": "Victoria Island, Lagos",
            "map_url": "https://www.google.com/maps/dir/?api=1&destination=" + quote(venue_query),
        },
        "after_party": {
            "venue": "Proxy Lagos",
            "note": "Immediately after the gala",
            "map_url": "https://www.google.com/maps/dir/?api=1&destination=" + quote(after_query),
        },
        "dress_code": {
            "style": "Stylish in All Black",
            "note": "Strictly all black, elegantly executed. A touch of gold is welcome.",
        },
        "evening": [
            {"time": "5:00 PM", "title": "Red Carpet", "detail": "Arrival, cocktails and portraits"},
            {
                "time": "To follow",
                "title": "Gala Dinner",
                "detail": "The heart of the evening: a seated dinner in the Balmoral Convention Centre, with wine and conversation",
            },
            {
                "time": "After dinner",
                "title": "A short reading",
                "detail": "A few words from the author to mark the launch of The Art of Attention",
            },
            {"time": "Late", "title": "After Party", "detail": "Proxy Lagos"},
        ],
        "quote": {
            "text": "Good company, good wine, good welcome, can make good people.",
            "author": "William Shakespeare",
        },
        # Versioned URLs so the replaced poster, banner and films load fresh
        # for everyone instead of a cached copy of the old artwork.
        "poster_url": "/uploads/gala-poster.jpg?v=2",
        "emblem_url": "/uploads/gala-emblem.jpg",
        "portrait_url": "/uploads/gala-portrait.jpg",
        "film_url": "/uploads/gala-film.mp4?v=4",
        "film_poster_url": "/uploads/gala-poster.jpg?v=2",
        # Phones get a dedicated 9:16 cut so the film fills the screen and the
        # type stays readable (a 16:9 film shrinks to a stamp on a handset).
        "film_vertical_url": "/uploads/gala-film-vertical.mp4?v=4",
        "film_vertical_poster_url": "/uploads/gala-film-vertical-poster.jpg?v=2",
        # The client's score, extracted from the approved film. One audio
        # element owns it for the whole visit (standing montage rule): the
        # montage itself is silent and the music plays on past the film.
        "music_url": "/uploads/gala-score.mp3?v=1",
    }


def _normalize_phone(phone: str) -> str:
    """Normalize phone. If an explicit country code (+...) is supplied keep it;
    otherwise default to Nigeria (+234)."""
    phone = phone.strip()
    # Explicit country code supplied (e.g. "+1 2025550123" or "+234 8012345678")
    if phone.startswith('+'):
        digits = ''.join(c for c in phone if c.isdigit())
        # Drop a Nigerian trunk zero typed after the country code ("+2340810..." -> "+234810...")
        if digits.startswith('2340') and len(digits) > 4:
            digits = '234' + digits[4:]
        return '+' + digits

    digits_only = ''.join(c for c in phone if c.isdigit())
    if not digits_only:
        return phone

    if digits_only.startswith('0'):
        digits_only = digits_only[1:]

    if digits_only.startswith('2340'):
        digits_only = '234' + digits_only[4:]

    if not digits_only.startswith('234'):
        digits_only = '234' + digits_only

    return '+' + digits_only


async def _get_event_by_slug(event_slug: str, db: AsyncSession) -> Event:
    result = await db.execute(select(Event).where(Event.slug == event_slug))
    event = result.scalar_one_or_none()
    if not event:
        # Slug alias fallback: event 67's slug has been toggled between the bare
        # form and a "-1" suffix (acamb-30th-anniversary <-> acamb-30th-anniversary-1).
        # Accept both variants so public registration links keep working regardless
        # of which one is currently stored.
        alias = event_slug + "-1" if not event_slug.endswith("-1") else event_slug[:-2]
        result = await db.execute(select(Event).where(Event.slug == alias))
        event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.event_type == "burial":
        raise HTTPException(status_code=400, detail="Use the burial RSVP link for this event")
    return event


def _registration_effectively_open(event: Event) -> bool:
    """Manual toggle AND scheduled auto-close both gate registration."""
    if getattr(event, "registration_open", True) is False:
        return False
    close_at = getattr(event, "registration_close_at", None)
    if close_at is not None:
        from datetime import datetime, timezone as _tz

        now = datetime.now(_tz.utc)
        try:
            if close_at.tzinfo is None:
                close_at = close_at.replace(tzinfo=_tz.utc)
            if now >= close_at:
                return False
        except Exception:
            pass
    return True


def _raise_if_registration_closed(event: Event) -> None:
    """Reject submissions when the organizer has closed registration for the event."""
    if not _registration_effectively_open(event):
        raise HTTPException(
            status_code=403,
            detail="Registration for this event is closed.",
        )


@router.get("/rsvp/register/{event_slug}")
async def get_registration_event_info(
    event_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Get event details for the public registration form."""
    event = await _get_event_by_slug(event_slug, db)

    # Event 67 (ACAMB) and event 72 (Annette's BIG 40) use a two-step procedure:
    # the attendance question is shown first, then a details form only for "Yes".
    # The Art of Attention (gala) uses the same two-step logic.
    is_two_step = (
        event.id in (67, 72) or is_gala_event(event) or is_anniversary_event(event)
    )

    wedding = is_wedding_event(event)
    gala = is_gala_event(event)

    flyer_result = await db.execute(
        select(FlierAsset).where(FlierAsset.event_id == event.id).order_by(FlierAsset.created_at.desc())
    )
    flyer = flyer_result.scalars().first()
    flyer_url = flyer.url if flyer else None

    return {
        "event": {
            "id": event.id,
            "title": event.title,
            "slug": event.slug,
            "date": str(event.event_date),
            "time": str(event.event_time),
            "venue": event.venue,
            "city": event.city,
            "state": event.state,
            "cover_image": event.cover_image,
            "flyer_url": flyer_url,
            "theme_color": getattr(event, "theme_color", "#1ABC9C") or "#1ABC9C",
            "host_name": event.host_name,
            "dress_code": event.dress_code,
            "registration_open": _registration_effectively_open(event),
        },
        "two_step": is_two_step,
        "wedding": wedding,
        "wedding_content": wedding_content() if wedding else None,
        "anniversary": is_anniversary_event(event),
        "anniversary_content": anniversary_content() if is_anniversary_event(event) else None,
        "gala": gala,
        "gala_content": gala_content() if gala else None,
        "extra_fields": ["organization", "sub_department"] if event.id == 67 else ["category"] if event.id == 74 else [],
    }


@router.post("/rsvp/register/{event_slug}")
async def submit_registration(
    event_slug: str,
    req: RegistrationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit registration. Creates/updates a Guest record for the event."""
    event = await _get_event_by_slug(event_slug, db)
    _raise_if_registration_closed(event)

    is_two_step = (
        event.id in (67, 72) or is_gala_event(event) or is_anniversary_event(event)
    )
    response_lower = req.response.lower()
    if response_lower not in ("accepted", "yes", "declined", "no"):
        raise HTTPException(status_code=400, detail="Please choose whether you will attend")

    # Two-step procedure: guests who answer "No" fill no form and are not added to
    # the dashboard: the flow simply ends.
    if is_two_step and response_lower in ("declined", "no"):
        return {
            "status": "success",
            "response": "declined",
            "message": "Your response has been recorded. Thank you.",
        }

    name = req.name.strip()
    email = req.email.strip().lower()
    phone = _normalize_phone(req.phone)
    organization = req.organization.strip()
    sub_department = req.sub_department.strip()
    category = req.category.strip()
    # Events 82 and 84: one companion rides on the guest's own pass.
    party_allowed = is_gala_event(event) or is_anniversary_event(event)
    plus_one = bool(req.plus_one) and party_allowed
    plus_one_name = req.plus_one_name.strip() if plus_one else ""

    if event.id == 67:
        if not (name and email and phone and organization and sub_department):
            raise HTTPException(
                status_code=400,
                detail="Please provide your full name, email, phone number, organization and sub department.",
            )
    elif event.id == 74:
        if not (name and email and phone and category):
            raise HTTPException(status_code=400, detail="Please provide your full name, email, phone number, and category (Student or Professional)")
        if category not in ("Student", "Professional"):
            raise HTTPException(status_code=400, detail="Category must be either Student or Professional")
    elif not (name and email and phone):
        raise HTTPException(status_code=400, detail="Name, email and phone number are required")

    if party_allowed and plus_one and not plus_one_name:
        raise HTTPException(status_code=400, detail="Please provide the name of your plus one")

    existing_guest = None
    if phone:
        existing_result = await db.execute(
            select(Guest).where(and_(Guest.event_id == event.id, Guest.phone == phone))
        )
        existing_guest = existing_result.scalars().first()

    if not existing_guest and email:
        existing_result = await db.execute(
            select(Guest).where(and_(Guest.event_id == event.id, func.lower(Guest.email) == email))
        )
        existing_guest = existing_result.scalars().first()

    if not existing_guest:
        existing_result = await db.execute(
            select(Guest).where(
                and_(Guest.event_id == event.id, func.lower(Guest.name) == name.lower())
            )
        )
        existing_guest = existing_result.scalars().first()

    if existing_guest and existing_guest.rsvp_status in ("accepted", "declined"):
        raise HTTPException(
            status_code=409,
            detail="The name, email, or phone number provided is already registered for this event. No need to register again."
        )

    # ACAMB cap: limit accepted registrations to 300 (only counts NEW guests).
    if event.id == 67 and not existing_guest and response_lower in ("accepted", "yes"):
        count_result = await db.execute(
            select(func.count())
            .select_from(Guest)
            .where(Guest.event_id == event.id, Guest.rsvp_status == "accepted")
        )
        accepted_count = count_result.scalar_one()
        if accepted_count >= 300:
            raise HTTPException(
                status_code=409,
                detail="Registration for this event is now full. We have reached the maximum of 300 attendees.",
            )

    if existing_guest:
        guest = existing_guest
        guest.name = name
        guest.phone = phone
        guest.email = email
    else:
        # New registrations respect the event's guest cap (event 67 keeps
        # its own bespoke 300-attendee rule handled below).
        if event.id != 67:
            from app.api.guests import ensure_guest_capacity

            await ensure_guest_capacity(db, event, 2 if plus_one else 1)
        guest = Guest(
            event_id=event.id,
            name=name,
            phone=phone,
            email=email,
            invited_by=event.host_name,
        )
        db.add(guest)

    guest.rsvp_status = "accepted" if response_lower in ("accepted", "yes") else "declined"
    guest.rsvped_at = datetime.now(timezone.utc)

    if event.id == 67 and (organization or sub_department):
        guest.custom_data = {
            **(guest.custom_data or {}),
            "organization": organization,
            "sub_department": sub_department,
        }

    if event.id == 74 and category:
        guest.custom_data = {
            **(guest.custom_data or {}),
            "category": category,
        }
        guest.category = category

    if party_allowed and (organization or plus_one):
        data = {**(guest.custom_data or {})}
        if organization:
            data["organization"] = organization
        if plus_one:
            data["plus_one"] = True
            data["plus_one_name"] = plus_one_name
            data["party_size"] = 2
        guest.custom_data = data

    await db.commit()
    await db.refresh(guest)

    # ACAMB-style flow (qr_later): the ONLY thing a registered guest receives is
    # their QR code (with the flyer) via email + WhatsApp. Trigger that delivery
    # here so it fires on registration, not only on the per-guest RSVP "Yes" flow.
    if guest.rsvp_status == "accepted" and getattr(event, "qr_delivery", None) == "qr_later":
        try:
            from app.api.rsvp import _send_qr_after_rsvp
            asyncio.create_task(_send_qr_after_rsvp(guest.id, event.id))
        except Exception:
            pass

    if guest.rsvp_status == "accepted":
        message = "Your attendance has been recorded. You will receive your QR code via email or WhatsApp shortly."
    else:
        message = "Your response has been recorded. Thank you."

    return {
        "status": "success",
        "guest_id": guest.id,
        "guest_name": guest.name,
        "response": guest.rsvp_status,
        "message": message,
    }


class AsoEbiRequest(BaseModel):
    name: str = ""
    phone: str = ""
    email: str = ""
    quantity: int = 1


@router.post("/rsvp/asoebi/{event_slug}")
async def submit_asoebi_order(
    event_slug: str,
    req: AsoEbiRequest,
    db: AsyncSession = Depends(get_db),
):
    """Aso Ebi package order (bank-transfer flow). Records the order, links
    it to a guest when phone/email match, and returns receipt details plus
    the WhatsApp confirmation link. Scoped to wedding events only."""
    from urllib.parse import quote

    event = await _get_event_by_slug(event_slug, db)
    if not is_wedding_event(event):
        raise HTTPException(status_code=404, detail="Aso Ebi is not available for this event")

    name = req.name.strip()
    phone = _normalize_phone(req.phone)
    email = req.email.strip().lower()
    quantity = max(1, min(int(req.quantity or 1), 50))
    if not (name and phone and email):
        raise HTTPException(status_code=400, detail="Please provide your full name, phone number and email address")

    guest = None
    if phone:
        guest = (await db.execute(
            select(Guest).where(and_(Guest.event_id == event.id, Guest.phone == phone))
        )).scalars().first()
    if not guest and email:
        guest = (await db.execute(
            select(Guest).where(and_(Guest.event_id == event.id, func.lower(Guest.email) == email))
        )).scalars().first()

    reference = "ASO-" + uuid.uuid4().hex[:8].upper()
    order = AsoEbiOrder(
        event_id=event.id,
        guest_id=guest.id if guest else None,
        buyer_name=name,
        phone=phone,
        email=email or None,
        quantity=quantity,
        amount=ASOEBI_PRICE * quantity,
        reference=reference,
        status="submitted",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    wa_text = quote(
        f"Hello, I just paid ₦{order.amount:,} for {quantity} Aso Ebi package(s). "
        f"My name is {name} and my receipt reference is {reference}. Please confirm my payment."
    )
    return {
        "status": "success",
        "reference": reference,
        "buyer_name": name,
        "quantity": quantity,
        "amount": order.amount,
        "bank": ASOEBI_BANK,
        "whatsapp": ASOEBI_WHATSAPP,
        "whatsapp_link": f"https://wa.me/2349046751511?text={wa_text}",
        "guest_linked": bool(guest),
    }


@router.get("/events/{event_id}/asoebi-orders")
async def list_asoebi_orders(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Organizer view of Aso Ebi orders (fallback when WhatsApp confirmations go missing)."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")
    orders = (await db.execute(
        select(AsoEbiOrder).where(AsoEbiOrder.event_id == event_id).order_by(AsoEbiOrder.id.desc())
    )).scalars().all()
    return {
        "orders": [
            {
                "id": o.id,
                "buyer_name": o.buyer_name,
                "phone": o.phone,
                "email": o.email,
                "quantity": o.quantity,
                "amount": o.amount,
                "reference": o.reference,
                "status": o.status,
                "guest_id": o.guest_id,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orders
        ]
    }


class AsoEbiStatusUpdate(BaseModel):
    status: str


@router.patch("/events/{event_id}/asoebi-orders/{order_id}")
async def update_asoebi_order(
    event_id: int,
    order_id: int,
    req: AsoEbiStatusUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Organizer confirms (or cancels) an Aso Ebi order."""
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.organizer_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Event not found")
    order = (await db.execute(
        select(AsoEbiOrder).where(AsoEbiOrder.id == order_id, AsoEbiOrder.event_id == event_id)
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if req.status not in ("submitted", "confirmed", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    order.status = req.status
    await db.commit()
    return {"status": order.status, "reference": order.reference}
