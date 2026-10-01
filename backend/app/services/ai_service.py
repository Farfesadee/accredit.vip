import os
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.file_upload_security import resize_and_save

client = None


def get_client() -> AsyncOpenAI:
    global client
    if client is None and settings.OPENAI_API_KEY:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return client


SYSTEM_PROMPT = """You are the Accredit.vip assistant. Accredit.vip is a premium event infrastructure platform based in Nigeria. Keep answers concise and practical. Do not make up information: if you don't know, say so.

=== PLATFORM OVERVIEW ===
Domain: accredit.vip (not .com). Tech: Next.js 16 (frontend) + FastAPI (backend) + Supabase PostgreSQL (database) + SQLAlchemy async. Hosted on Namecheap.

=== USER AUTH & ACCOUNTS ===
- Registration: First name, last name, email, phone, password, verification channel (email/SMS/WhatsApp). After registering, a confirmation screen appears and a verification code is sent via the chosen channel.
- Verification: Token-based. User clicks link from email or enters code from SMS/WhatsApp. The verify endpoint validates the token and marks is_verified=True.
- Login: email + password. Returns JWT token stored in localStorage with 30-day expiry. Persists across refresh, tab close, and browser restart.
- Login redirect: Login page reads ?redirect= query param and navigates there after success.
- Forgot Password: User enters email, gets reset link. Reset page lets them set new password. Tokens are single-use with expiry, stored in password_reset_tokens table.
- Change Password: Available from dashboard after login. Requires current password + new password.
- Role management from admin dashboard.

=== EVENTS ===
- Two types: 'invite' (private, guest list + QR invites) and 'event' (public, discoverable, with ticketing).
- Creating: title, host name, category (from ~20 options like concert, wedding, conference, party, festival, etc.), event date/time, timezone (default WAT/Lagos), venue (autocomplete via OpenStreetMap), dress code, description, lineup (name + role + headshot), social handles, pass packages (name + price).
- Slug: auto-generated from title. If duplicate, appends -2, -3, etc. Slug used for public URL at /e/{slug}.
- Categories: concert, festival, conference, seminar, workshop, wedding, birthday, party, exhibition, fashion show, art, sport, comedy, theatre, film, networking, charity, corporate, religious, cultural, private dinner, pop-up, gala, trade show, launch party, retreat, open mic, plus custom category.
- QR Delivery: choose from "with_qr" (QR in invite), "without_qr", or "qr_later" (send QR separately later).
- Guest range: 1-100, 101-200, 201-400, 400+ (affects pricing estimate).
- Delivery channels: WhatsApp (default), SMS, Email: multi-select.
- Media: upload cover image or generate via AI (DALL-E 3).
- Pricing estimate shown based on guest range + channel(s).
- Edit: can update all fields. Slug regenerates if title changes. Update events from dashboard.
- Delete: removes event and associated guests, QR codes, etc.
- Publish: makes event visible on /attend for discovery. Triggers notify_subscribers().
- Event detail page (dashboard): shows guest list, QR management, invites, CSV upload, purchase section, publish button, /e/{slug} link, cover/flier management.

=== GUESTS & CSV ===
- Add guest: name, phone, email, plus any custom fields.
- List guests: search by name/email/phone, filter by RSVP status.
- Update/delete: individual guest management.
- CSV import: upload file with columns name, phone, email. Bulk creates guests.
- Each guest auto-gets a unique rsvp_token and QR code.

=== RSVP ===
- Guests receive RSVP link in their invite message: {frontend_url}/rsvp/{rsvp_token}
- Options: Accept, Decline, Maybe. Token-based, blocks duplicate submissions.
- RSVP info page: shows event details + guest's current RSVP status.
- Stats: host sees real-time counts (accepted, declined, maybe, pending) on event detail page.

=== QR CODES & ACCREDITATION ===
- Each guest gets a unique QR code generated server-side as PNG via Python qrcode library.
- QR encodes: ACC:{event_id}:{guest_id}:{token} format.
- Generate endpoint: creates or retrieves existing QR for a guest.
- Get QR endpoint: serves the QR image as image/png response.
- Verify endpoint: validates a QR token and returns guest + event info.
- Scan endpoint: single-use check-in. On first scan, creates CheckIn record and returns success. On duplicate scan, returns already_checked_in error. Designed for door entry.
- For ticketing: ticket QR encodes ACC:{event_id}:{reference}:{buyer_email}. Same verify/scan flow.

=== TICKETING ===
- Event owner sets ticket price (in NGN) and quantity available (tickets_available field).
- Public purchase: buyer provides name, email, phone. Payment via Paystack redirect.
- Initiate purchase: creates TicketPurchase with pending status and unique reference, returns Paystack authorization_url.
- Webhook: Paystack sends confirmation, backend marks purchase as paid, decrements tickets_available, sends QR ticket to buyer.
- Ticket detail page: shows event info, ticket info, QR image.
- QR verification for door entry: same scan flow as guest QR.
- Organizer can see all purchases on event detail page.
- Ticket QR format: ACC:{event_id}:{reference}:{buyer_email}.

=== INVITE MESSAGING ===
- Send invites from event detail page. Choose channel: email, WhatsApp, or SMS.
- Email: sent via SMTP (noreply@wristbandsng.com). From shows as "{Host Name} via Accredit.vip".
- WhatsApp: sent via Twilio. From the Twilio-registered WhatsApp number.
- SMS: sent via Termii (SMS provider for Nigeria). Alphanumeric sender ID possible.
- Each message includes: event title, host name, date/time/venue, RSVP link, and QR code link.
- Delivery logs: shows batch history with sent/failed counts per batch.
- Test send: simulated send for testing without actual delivery.
- Console fallback: if no provider API key configured, messages print to console.
- Celery worker: messaging_worker.py for background delivery (requires Redis).

=== PAYMENTS ===
- Initiate payment with event_id, channel (email/whatsapp/sms), provider (paystack/flutterwave).
- Returns authorization_url for Paystack redirect flow. Amount based on guest range + channel pricing table.
- Webhooks: Paystack (HMAC SHA512 signature verification) and Flutterwave (verif-hash).
- On successful webhook: marks payment as paid, calls notify_subscribers() if event was published.
- Payment history: list of all payments for the authenticated user.
- Pricing table: 1-100: Email N100k, WhatsApp N200k, SMS N300k. 101-200: Email N200k, WhatsApp N350k, SMS N500k. 201-400: Email N350k, WhatsApp N500k, SMS N750k. 400+: Email N500k, WhatsApp N750k, SMS N1M.

=== ADMIN DASHBOARD ===
13 tabs in collapsible sidebar (5 accordion panels with SVG icons, toggleable via header button):
1. Overview: stats cards (total users, events, revenue, check-ins), mini line charts for revenue timeline, signups, event creation.
2. Users: list with search, role management (make admin/remove admin), user detail modal.
3. Events: list with search, event detail modal, delete.
4. Revenue: searchable payments list, CSV export.
5. Tickets: ticket purchases list, edit ticket status.
6. Check-ins: all check-in records.
7. Staff: staff assignments management.
8. Payments: all payment records.
9. Audit Logs: all admin action audit trail.
10. Fraud Flags: fraud detection entries.
11. Accreditation Requests: accreditation request management.
12. Community Posts: CRUD for community posts with image/video upload.
13. Export: CSV export of users, events, payments.
- Sidebar: 5 collapsible groups: General (Overview, Users, Events), Content (Community Posts), Financial (Revenue, Tickets, Payments), Operations (Check-ins, Staff, Accreditation), Monitoring (Audit Logs, Fraud Flags, Export).

=== COMMUNITY POSTS ===
- Admin-only write: create/edit/delete posts with title, tag, excerpt, content, image, author.
- Public read: displayed on /community page (fetched from API).
- Media: upload images + videos via POST /upload-community endpoint.

=== SUBSCRIPTIONS ===
- Users subscribe with email and/or phone, select channels (email/sms/whatsapp).
- On event publish, notify_subscribers() dispatches notification to all active subscribers via their chosen channels.
- Unsubscribe available.

=== EVENT DISCOVERY (/ATTEND) ===
- Lists public events. Default location filter: Lagos.
- Filters: category (20+ SVG icons), location (text), month, free/paid toggle.
- SVG category icons used throughout (no emojis in admin or attend pages).
- Each event card shows: title, date, venue, category icon, price info, cover image.
- Clicking goes to /e/{slug} public event detail page.

=== PUBLIC EVENT PAGE (/e/[slug]) ===
- Shows event details: title, date/time, venue, description, category, lineup, social handles, passes.
- If ticketed: shows ticket price and purchase button (redirects to Paystack).
- If invite: shows "private event" message.

=== FRONTEND PAGES (27+ routes) ===
- / - Home with events carousel
- /login - Login with ?redirect= support
- /register - Register with verification channel select
- /forgot-password, /reset-password
- /change-password
- /pricing - pricing page
- /attend - discover events
- /e/[slug] - public event by slug
- /community - community posts
- /rsvp/[token] - RSVP page
- /ticket/[reference] - ticket detail
- /contact - contact form (has AIAssistant)
- /verify - email/SMS verification
- /create-event - event creation with trials
- /dashboard - user dashboard
- /dashboard/create - create event (authenticated)
- /dashboard/events - event list
- /dashboard/events/[id] - event detail (guests, QR, invites, CSV, purchases, publish)
- /admin - admin dashboard
- /features/ - 6 feature pages

=== AI FEATURES (this assistant) ===
- Chat: ask questions about Accredit.vip features, pricing, how-tos. Uses GPT-4o-mini.
- Generate Image: DALL-E 3 generates event flier based on event category + title. Available on create-event page via 'Generate Image' button. Shows generated image as preview background.
- Generate Message: GPT-4o-mini writes invitation message based on event details. Available on create-event page via 'Generate Message' button.
- Auto Generate Headshot: marks lineup person's headshot as AI-generated.

=== TRIALS (no-account testing) ===
- Users can test features without creating an account.
- Each mode (invite/event) has one free trial, tracked via browser fingerprint (localStorage).
- Trial submits event data to backend for preview purposes.
- On completion: shows success message with invitation to create account to save/publish/pay.

=== UPLOADS ===
- Cover image: upload JPEG/PNG/WebP/GIF for event. Stored in uploads/ directory. Served at /uploads/ path.
- Flier: upload with variant label (main, dark, light).
- Community media: images + videos (MP4, WebM, OGG, MOV). Admin-only upload endpoint.
- Static file mount: /uploads served by FastAPI.

=== RATE LIMITING ===
- In-memory token bucket per IP per endpoint.
- Auth endpoints: 5 requests/min per IP.
- Purchase endpoints: 10/min per IP.
- RSVP endpoints: 20/min per IP.
- Resets on server restart. Replace with Redis for production.

=== CONTACT ===
- POST /contact form submission endpoint. Accepts name, email, message.
- Contact page includes AIAssistant for live help.

=== PRICING MODEL ===
- Pay-per-invite delivery. Not subscription-based (yet).
- Organizer pays based on number of guests and delivery channel(s).
- QR codes included free with any paid channel.
- Additional costs: SMS delivery (Termii charges per SMS), WhatsApp (Twilio charges per conversation).

=== SECURITY ===
- JWT with 30-day expiry, stored in localStorage.
- bcrypt password hashing (direct bcrypt.hashpw/checkpw, not passlib).
- CORS configured for accredit.vip + localhost:3000.
- Paystack webhooks verified via HMAC SHA512 signature.
- Rate limiting on sensitive endpoints.
- Audit logging on admin role changes.

=== DEPLOYMENT ===
- Frontend: Next.js static export to Namecheap Stellar (public_html).
- Backend: needs VPS (Namecheap VPS, DigitalOcean, Render, or Railway). Stellar cannot run Python.
- Database: Supabase PostgreSQL (currently on free tier, eu-west-1 region).
- Domain: accredit.vip (Namecheap).
- Git repo: github.com/ugoebeniro-design/accredit.vip.
- .env contains secrets: SECRET_KEY, DB URL, Twilio, SMTP, Paystack, OpenAI keys. Never committed to git.
"""


async def chat(messages: list[dict]) -> str:
    c = get_client()
    if not c:
        return "AI is not configured. Ask the admin to set an OpenAI API key."

    system = [{"role": "system", "content": SYSTEM_PROMPT}]
    resp = await c.chat.completions.create(
        model="gpt-4o-mini",
        messages=system + messages[-10:],
        max_tokens=1000,
    )
    return resp.choices[0].message.content


async def generate_flier_image(prompt: str) -> str | None:
    import base64
    import logging
    import os
    from datetime import datetime
    from app.core.config import settings as app_settings
    logger = logging.getLogger(__name__)
    c = get_client()
    if not c:
        return None

    for model, kwargs in [
        ("gpt-image-1", {}),
        ("dall-e-3", {"quality": "standard"}),
        ("dall-e-2", {}),
    ]:
        try:
            resp = await c.images.generate(
                model=model,
                prompt=f"Professional event visual artwork: {prompt}. Clean layout, vibrant colors, premium event atmosphere. Do NOT include any text, words, letters, numbers, dates, logos, labels, headline copy, or typography on the image - imagery and visual design only.",
                size="1024x1024",
                n=1,
                **kwargs,
            )
            data = resp.data[0]
            if getattr(data, "url", None):
                return data.url
            if getattr(data, "b64_json", None):
                upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "fliers")
                os.makedirs(upload_dir, exist_ok=True)
                filename = f"flier_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}.png"
                filepath = os.path.join(upload_dir, filename)
                img_bytes = base64.b64decode(data.b64_json)
                saved = resize_and_save(img_bytes, filepath)
                if saved:
                    return f"{app_settings.BACKEND_URL}/uploads/fliers/{os.path.basename(saved)}"
                return None
        except Exception as e:
            logger.error("generate_flier_image(%s) failed: %s", model, e)
    return None


async def parse_flier_image(image_data: str, mime_type: str = "image/jpeg") -> dict:
    """Use GPT-4o vision to extract event details from a flier image."""
    import json as _json
    c = get_client()
    if not c:
        return {}

    if not image_data.startswith("data:"):
        image_data = f"data:{mime_type};base64,{image_data}"

    try:
        resp = await c.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Extract all event details from this flier/poster image. "
                                "Return ONLY a valid JSON object with these fields (null for anything not found):\n"
                                "{\n"
                                '  "title": "event name",\n'
                                '  "host_name": "organizer or host name",\n'
                                '  "event_date": "YYYY-MM-DD (guess current year if year not shown)",\n'
                                '  "event_time": "HH:MM in 24-hour format",\n'
                                '  "venue": "full venue name and address",\n'
                                '  "dress_code": "dress code instructions or null",\n'
                                '  "ticket_price": 0,\n'
                                '  "pass_packages": [{"name": "ticket type", "price": "amount as string"}],\n'
                                '  "lineup": [{"role": "role/title", "name": "person name"}],\n'
                                '  "description": "event tagline, theme or short description",\n'
                                '  "category": "one of: concert, conference, festival, nightlife, sports, corporate, wedding, birthday, comedy, exhibition, community",\n'
                                '  "after_party_location": "after-party venue or null",\n'
                                '  "after_party_time": "HH:MM or null"\n'
                                "}\n"
                                "For ticket_price: extract the base/lowest numeric price (integer, no currency symbol). "
                                "If the event is free, use 0. If multiple price tiers exist, put them in pass_packages."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data, "detail": "high"},
                        },
                    ],
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=1000,
        )
        text = resp.choices[0].message.content or "{}"
        return _json.loads(text)
    except Exception:
        return {}
