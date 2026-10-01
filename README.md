# ACCREDIT INTERACTIVE (accredit.vip)

Nigeria's event ticketing platform and event marketplace: create events, sell tickets online, send invitations, and manage gate entry with QR accreditation — all in one place.

**Live:** [https://accredit.vip](https://accredit.vip)

---

## What it does

### For organizers (dashboards)
- **Create events** — private invitations or public ticketed events with flyers, lineups, pass packages, pricing and fees
- **Guest management** — manual adds, CSV bulk import, categories (General Access, Premium VIP, VVIP, Media, Vendor's Assistant), organizations, notes, tags
- **Invitations** — send via Email, WhatsApp and SMS with delivery tracking, resend flows, scheduled reminders, coupons and waitlists
- **QR accreditation** — unique QR per guest, live scanner page, manual entry with instant check-in, gate quick-add (single + Excel bulk), duplicate-scan fraud detection
- **RSVP flows** — per-guest links plus public registration pages (including two-step flows with custom fields)
- **Wallet & payouts** — ticket revenue credits, Paystack deposits, bank accounts, withdrawals
- **Reports** — live accreditation analytics, ticket sales (orders, quantities, revenue, references), printable event reports

### For attendees (public site)
- **Discover events** (`/attend`) — search, filters, past/ended events archive
- **Buy tickets** — Paystack checkout with per-package fees, order confirmation, QR tickets by email + PDF
- **Ticket page** (`/ticket/{reference}`) — QR display, print, copy-reference, spam-folder guidance
- **RSVP pages** — per-guest and public registration links

### For admins (`/admin`)
- Event moderation (approve/reject/delete) plus full **remote control**: guest caps, registration/RSVP kill switches (manual + scheduled auto-close), visibility/status, ticket price/availability, spotlight picker, offline-payment publish, invite message editing, event-basics editing, guest add/edit/remove, organizer impersonation (audited), platform announcements, one-click Excel post-event reports
- Users (suspend/unsuspend), payments, withdrawals (approve/fail), fraud flags, sessions + full audit-trail viewer, platform pricing editor

### Integrations
- **Paystack** (ticket checkout, deposits, webhooks), **Twilio + Meta WhatsApp Cloud** (messaging with fallbacks), **SendGrid/Resend/SMTP** (email failover chain)
- **Partner sync** — event-77 registrations and edits auto-forward to a co-developer accreditation portal (`PARTNER_TICKET_API_URL`)

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript, Tailwind CSS), served on `:3000` |
| Backend | FastAPI (Python 3.11+, SQLAlchemy 2 async), served on `127.0.0.1:8001` |
| Database | PostgreSQL (SQLAlchemy models are the schema; tables auto-create on startup) |
| Reverse proxy | nginx (`/api/v1/` + `/webhook` → backend, `/uploads/` → static files, `/` → frontend) |
| SEO | `robots.txt`, `sitemap.xml` (static + public events), JSON-LD (Organization, WebSite, Event) |

---

## Repository layout

```
frontend/                  # Next.js app
  src/app/                 # Routes: landing, attend, events/[id], ticket/[ref],
                           #   dashboard/*, admin/*, accreditation/*, rsvp/*, ...
  src/components/          # dashboard/, wallet/, events/, shared/, home/, ...
  src/lib/                 # api-client, currencies, auth storage, ...
  public/                  # Logos, static assets
backend/                   # FastAPI app
  app/main.py              # App entrypoint + router registration
  app/api/                 # Route modules (events, guests, tickets, messaging,
                           #   rsvp, checkin_scanner, wallet_api, admin_*, ...)
  app/models/              # SQLAlchemy models (schema source of truth)
  app/services/            # ticket_fulfillment, ticket_delivery, email_service,
                           #   partner_sync, whatsapp/sms, ...
  app/core/                # config (env-driven), security, database
  requirements.txt
AGENTS.md                  # Operating guide: infra, deployment, conventions
```

> **Isolation rule:** every dashboard page renders its own sidebar/topbar/content and must never break another dashboard. Shared components (`components/dashboard/*`, `components/wallet/*`, `components/shared/*`) have multiple consumers — check all of them before editing. Event-specific behavior must stay scoped to that event (by id/slug), never applied platform-wide.

---

## Local development

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+ and PostgreSQL 14+

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in DATABASE_URL, SECRET_KEY, keys
uvicorn app.main:app --reload --port 8001
```
Tables are created automatically on startup (`init_db`). API docs at `http://localhost:8001/docs`.

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```
Point the frontend at the backend during local dev:
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
```

### Environment
All secrets come from environment (never commit `.env` files):
- `backend/.env.example` documents every variable (database, auth, Paystack, Twilio/Meta, SMTP, SendGrid/Resend)
- Key settings: `DATABASE_URL`, `SECRET_KEY`, `ENCRYPTION_KEY`, `FRONTEND_URL`, `PAYSTACK_*`, `TWILIO_*`, `SMTP_*` (+ `SMTP2/3/4_*` fallbacks), `PARTNER_TICKET_API_URL`

---

## Key routes

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/attend` | Public event discovery (+ previous/ended events) |
| `/events/[id]` | Public event page + ticket checkout |
| `/ticket/[reference]` | Buyer ticket + QR |
| `/dashboard`, `/dashboard/events/[id]`, `/dashboard/wallet` | Organizer dashboards |
| `/dashboard/create`, `/create-event` | Event creation flows |
| `/accreditation/scan` | Gate scanner + manual entry + quick-add |
| `/admin/*` | Admin console (moderation → full remote control) |
| `/api/v1/*` | Backend API (see `/docs` when running) |

---

## Deployment

Production runs on Ubuntu + nginx with systemd services (`accredit-api.service`, `accredit-web.service`). Full procedures — frontend/backend deploys, database, backups, migrations (model change → `ALTER TABLE`, new models auto-create) — live in **[AGENTS.md](./AGENTS.md)**, which also holds the confinement rules every contributor (human or AI) must follow.

---

## Status

Actively developed. If something looks off, the changelog at the bottom of `AGENTS.md` records what changed, when, and why.
