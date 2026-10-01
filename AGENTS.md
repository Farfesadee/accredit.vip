# Accredit.vip — AI Agent Guide

## Project Overview

Accredit.vip is an event management platform (RSVP, ticketing, payments, wallet, invitations, QR accreditation) using:
- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind CSS) at `frontend/`
- **Backend:** FastAPI (Python 3.11+, SQLAlchemy async) at `backend/`
- **Database:** PostgreSQL
- **Server:** Namecheap VPS, Ubuntu 24.04, nginx reverse proxy

---

## Server Infrastructure (CRITICAL)

### VPS Access
| Detail | Value |
|---|---|
| Host/IP | 203.161.60.171 |
| Username | root |
| OS | Ubuntu 24.04 Blank 64 Bit |
| Control Panel | None |
| SSH | `ssh root@203.161.60.171` |

### Services Running on Server
| Service | Port | Purpose | Start Command |
|---|---|---|---|
| Next.js (frontend) | 3000 | Serves web app | systemd `accredit-web.service` |
| FastAPI (backend) | 8001 | Serves API | systemd `accredit-api.service` (uvicorn, 127.0.0.1:8001) |
| PostgreSQL | 5432 | Database (VPS-local, migrated off DO) | system service (cluster 18) |
| nginx | 80/443 | Reverse proxy | system service |
| sendmail | 25 | Email sending | system service |

NOTE: Port 8000 is `vodi-api.service` (a different app) — do NOT touch it.
Restart with: `systemctl restart accredit-api.service` / `accredit-web.service`

### Nginx Config
**File:** `/etc/nginx/sites-enabled/accredit.conf`
- `/api/v1/` → proxies to `127.0.0.1:8001` (FastAPI)
- `/webhook` → proxies to `127.0.0.1:8001` (FastAPI webhooks)
- `/uploads/` → serves static files from `/var/www/accredit.vip/backend/uploads/`
- `/` → proxies to `127.0.0.1:3000` (Next.js)

After any nginx change: `nginx -t && systemctl reload nginx`

### Project Paths on Server
| Component | Path |
|---|---|
| Frontend | `/var/www/accredit.vip/frontend/` |
| Backend | `/var/www/accredit.vip/backend/` |
| Uploads | `/var/www/accredit.vip/backend/uploads/` |
| Python venv | `/var/www/accredit.vip/backend/venv/` |

### Environment Variables
**File:** `/var/www/accredit.vip/backend/.env`
Contains all secrets: DATABASE_URL, SECRET_KEY, Twilio credentials, Meta/WhatsApp Cloud credentials, SMTP settings, Paystack keys, etc.
**NEVER expose or commit .env files.**

---

## Deployment Guide (STRICT)

### Deploying Frontend Changes
```bash
# 1. Build locally first
cd frontend && npm run build

# 2. Copy changed files to server (or the whole build)
scp -r .next/* root@203.161.60.171:/var/www/accredit.vip/frontend/.next/
# OR simply rebuild on server:
ssh root@203.161.60.171
cd /var/www/accredit.vip/frontend && npm run build

# 3. Restart Next.js
pkill -f "next-server"
sleep 2
nohup npx next start -p 3000 > /tmp/frontend.log 2>&1 &

# 4. Verify
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/dashboard/events/55

# 5. Tell user to hard refresh (Ctrl+Shift+R)
```

### Deploying Backend Changes
```bash
# 1. Copy .py files to server
scp backend/app/api/*.py root@203.161.60.171:/var/www/accredit.vip/backend/app/api/

# 2. Restart FastAPI
systemctl restart accredit-api.service

# 3. Verify
curl -s http://127.0.0.1:8001/api/v1/health
```

### Full Deploy (both frontend + backend)
1. Build frontend (`cd frontend && npm run build`)
2. Copy changed frontend files to server
3. Copy changed backend files to server
4. Kill both servers: `pkill -f "next-server"; pkill -f uvicorn`
5. Restart backend first, then frontend
6. Verify both health endpoints
7. Tell user to hard refresh (Ctrl+Shift+R)

### Checking Logs
- Backend: `tail -100 /tmp/backend.log`
- Frontend: `tail -100 /tmp/frontend.log`
- Nginx: `tail -100 /var/log/nginx/error.log`

---

## Database Management

### Connection
- **PostgreSQL 18 runs VPS-local on localhost:5432** (migrated OFF DigitalOcean Managed PostgreSQL on 2026-08-11)
- Database: `accredit`, User: `accredit`
- App DB password stored in `/root/.accredit_db_pw` on the VPS (chmod 600) and in `DATABASE_URL` in server `.env`
- Connect via: `sudo -u postgres psql -d accredit` (as postgres superuser), or:
  ```bash
  PGPASSWORD="$(cat /root/.accredit_db_pw)" psql -h 127.0.0.1 -U accredit -d accredit
  ```
- The old DigitalOcean clusters were **deleted 2026-08-12** — the app uses VPS-local only.

### Backups (nightly, on VPS)
| What | Script | Cron | Destination | Retention |
|---|---|---|---|---|
| Database | `/usr/local/bin/backup_db.sh` | `15 3 * * *` | `/backups/db/accredit-db-<stamp>.sql.gz` | 14 days |
| Uploads dir | `/usr/local/bin/backup_uploads.sh` | `0 3 * * *` | `/backups/uploads/uploads-<stamp>.tar.gz` | 14 days |

Both log to `/var/log/` and prune old copies automatically. Test restore procedure: create scratch db, `gunzip -c <dump> | psql ... accredit_test_restore`, verify table counts, drop scratch db.

### Running Database Scripts
Use the backend's ORM and venv:
```bash
cd /var/www/accredit.vip/backend
source venv/bin/activate
# Run a quick script:
echo 'import asyncio; from app.core.database import async_session; from app.models.event import Event; from sqlalchemy import select; import datetime; async def main(): async with async_session() as s: e = (await s.execute(select(Event).where(Event.id == 55))).scalar_one(); e.event_time = datetime.time(15,0); await s.commit(); print("done"); asyncio.run(main())' | SECRET_KEY=<key> python3 -
```

### Migrations
- Uses SQLAlchemy ORM (no Alembic). Models define the schema.
- `Base.metadata.create_all()` in `init_db()` creates tables.
- To add a column: add field to model, run script to `ALTER TABLE`.

---

## Dashboard Architecture & Isolation Rule (CRITICAL)

### The Golden Rule
**Every dashboard page file and its component tree is 100% independent.**
Modifying one dashboard must NEVER break another dashboard.

### How Isolation is Achieved
1. **Dashboard pages do NOT share a layout.** Each page under `frontend/src/app/dashboard/` is standalone — it renders its own sidebar, topbar, and content inline.
2. **Components in `components/dashboard/`, `components/wallet/`, and `components/shared/` are SHARED.** If you modify ANY of these files, you MUST verify ALL pages that import them still work.

### Shared Components Registry (DO NOT MODIFY Lightly)
| File | Used By |
|---|---|
| `components/dashboard/sidebar.tsx` | `dashboard/page.tsx`, `dashboard/events/page.tsx`, `dashboard/events/[id]/page.tsx`, `dashboard/events/[id]/edit/page.tsx`, `dashboard/events/[id]/report/page.tsx` |
| `components/dashboard/topbar.tsx` | Same 5 pages as above |
| `components/dashboard/event-card.tsx` | `dashboard/page.tsx`, `dashboard/events/page.tsx` |
| `components/wallet/*` (6 files) | `dashboard/wallet/page.tsx` only |
| `components/shared/toast.tsx` | `dashboard/wallet/page.tsx`, `dashboard/events/[id]/page.tsx` |

**Before editing any shared component:** Search all imports to find every consumer, then test all of them.

### Sidebar Navigation (shared `DashboardSidebar`)
The `NAV_ITEMS` array in `sidebar.tsx` defines:
1. `/dashboard` — Dashboard
2. `/dashboard/events` — Events
3. `/dashboard/create` — Create Event
4. `/dashboard/wallet` — Wallet

**NEVER add custom feature links to this array.**

---

## Burial Event System — Standalone & LOCKED (CRITICAL)

Event 55 is a burial event that is currently live with active RSVPs. **DO NOT modify any burial file unless explicitly told to do so in plain language ("modify burial system" or "modify event 55").**

### Burial Files — ABSOLUTELY DO NOT TOUCH
| File | Purpose | Status |
|---|---|---|
| `backend/app/api/burial_rsvp.py` | All burial endpoints (RSVP, send-message, hosts, guests) | ✅ Working — DO NOT TOUCH |
| `frontend/src/components/burial/BurialHostDashboard.tsx` | Burial host dashboard (confirm/QR icons, guest list, actions) | ✅ Working — DO NOT TOUCH |
| `frontend/src/app/rsvp/burial/[slug]/page.tsx` | Public burial RSVP page (splash screen, RSVP form) | ✅ Working — DO NOT TOUCH |

### What Is Currently Working (Do Not Disrupt)
- **Twilio WhatsApp messaging** for confirmatory and QR messages
- **Email messaging** for confirmatory and QR messages (via sendmail)
- **Time display** shows 12-hour format like "3:00 PM (WAT)"
- **WhatsApp confirmatory message** includes the invite flyer image
- **Confirm column** shows single MessageSquare icon with status color
- **QR column** shows single QrCode icon with status color
- **RSVP host links** for event 55 — each host has unique link with splash screen
- **Event time** for event 55 is 15:00 (3:00 PM WAT)
- **Guest RSVPs** coming in through host links
- **Meta Cloud API** configured but templates blocked — Twilio is the active channel

### Messages Feature — Isolation Rules
- Burial messages use `_send_whatsapp` defined in `burial_rsvp.py` (NOT the one in `messaging.py`)
- The burial `_send_whatsapp` tries Meta Cloud API first, falls back to Twilio
- The `_send_burial_qr` background task handles confirmatory and QR messages
- Changes to regular messaging (`messaging.py`, `rsvp.py`) must NOT affect burial messaging
- The invite flier is included in WhatsApp confirmation messages via `media_url`

---

## File Tree Reference

```
frontend/src/app/dashboard/
├── page.tsx                        (Overview — uses shared sidebar/topbar)
├── create/page.tsx                 (Create event — standalone)
├── change-password/page.tsx        (Standalone)
├── payment-callback/page.tsx       (Standalone)
├── wallet/page.tsx                 (Wallet — builds own sidebar inline)
├── events/
│   ├── page.tsx                    (Events list — uses shared sidebar/topbar)
│   ├── manage/page.tsx             (Standalone)
│   └── [id]/
│       ├── page.tsx                (Event detail — uses shared sidebar/topbar)
│       ├── edit/page.tsx           (Uses shared sidebar/topbar)
│       ├── report/page.tsx         (Uses shared sidebar/topbar)
│       ├── questions/page.tsx      (Standalone)
│       ├── reminders/page.tsx      (Standalone)
│       ├── coupons/page.tsx        (Standalone)
│       ├── templates/page.tsx      (Standalone)
│       └── waitlist/page.tsx       (Standalone)
└── invites/[eventId]/send/page.tsx (Redirects)
    invites/[eventId]/manage/page.tsx (Redirects)
    invites/[eventId]/edit/page.tsx   (Redirects)

frontend/src/app/events/
└── [id]/page.tsx                   (Public event page — NOT a dashboard)

frontend/src/components/
├── burial/                          (Burial — standalone, DO NOT MODIFY)
│   ├── BurialHostDashboard.tsx
├── dashboard/
│   ├── sidebar.tsx                 (SHARED — 5 consumers)
│   ├── topbar.tsx                  (SHARED — 5 consumers)
│   └── event-card.tsx              (SHARED — 2 consumers)
├── wallet/
│   ├── wallet-dashboard.tsx
│   ├── bank-account-manager.tsx
│   ├── add-bank-account-form.tsx
│   ├── withdrawal-form.tsx
│   ├── currency-selector.tsx
│   └── transaction-history.tsx
├── events/                         (Tab content — InvitesTabContent, GuestsTabContent, etc.)
└── shared/                         (Generic reusable UI)
    ├── toast.tsx
    ├── error-boundary.tsx
    ├── confirm-dialog.tsx
    └── loading-skeleton.tsx
```

---

## AI Agent Confinement Rules — STRICT (READ BEFORE ANY ACTION)

### Core Rules
1. **NEVER modify burial system files** (burial_rsvp.py, BurialHostDashboard.tsx, burial RSVP page) unless told "modify burial system" or "modify event 55" in plain language
2. **Never modify two dashboard areas at once** — one task, test, deploy, then next
3. **Never modify shared components** without checking ALL consumers in the registry
4. **Never remove or delete files** unless the user explicitly tells you to
5. **Never expose or commit secrets** (.env, API keys, passwords, tokens)
6. **Never make assumptions** about what is safe — verify by reading the code
7. **PER-EVENT ISOLATION (user directive 2026-09-23): all events are independent of each other. Every extra modification or integration for one event is peculiar to THAT event only — scope all data changes, template branches, and feature flags to the target event (by event id/slug/title match) and leave every other event's data, templates, and behavior exactly as they are. Never apply one event's custom flow, branding, or limits platform-wide.**

### Build & Test Rules
7. **Always run `npm run build`** in `frontend/` before deploying any frontend change
8. **Always restart the backend** after deploying any backend change (pkill + restart)
9. **Always verify with `curl`** that both frontend (port 3000) and backend (port 8000) return 200
10. **Always do a hard refresh** (Ctrl+Shift+R) after deployment to clear cached chunks

### Documentation Rules
11. **Document every change** in the Change Log section at the bottom of AGENTS.md
12. **State clearly what was changed, why, and what files** were modified
13. **If you revert a change, document the revert too**

### Safety Rules
14. **Check `git status` and `git diff` before making changes** to understand what is uncommitted
15. **Do not leave temporary/test files** in the repo — clean them up
16. **Commit meaningful messages** that describe exactly what was done
17. **Push to `origin main`** after committing (`git push origin main`)

---

## Working Features Summary (Do Not Break)

### Emergency/Audit Features
- **Scan page** (`/accreditation/scan`) — QR scanning, manual entry with autocomplete search, guest accreditation with status tracking
- **Fraud detection** (`/admin/fraud`) — duplicate scan tracking
- **Session guard** — `/rsvp` and public pages bypass auth

### Regular Features
- Event creation, editing, management
- Guest list management (import, export, manual add)
- Invite sending (email, WhatsApp, SMS) with delivery tracking
- QR code generation and sending per guest
- Wallet, payments, withdrawals
- RSVP management with host allocation
- Coupons, reminders, questions, templates, waitlist
- Save the Date (STD) messages with image overlay

### What is NOT Working (Known Issues)
- **Meta Cloud API templates** — all templates rejected by Meta automated compliance; Twilio is the active WhatsApp channel

---

## Change Log

| Date | Change | Author |
|---|---|---|
| 2026-07-15 | Added strict AI confinement rules, VPS/database details, comprehensive deployment guide | AI Agent |
| 2026-07-15 | Fixed event 55 time from 09:00 to 15:00 | AI Agent |
| 2026-07-15 | Fixed `_send_whatsapp` in burial_rsvp.py to try Meta Cloud first, then Twilio fallback | AI Agent |
| 2026-07-15 | Fixed _format_time in burial_rsvp.py (was using raw event.event_time) | AI Agent |
| 2026-07-15 | Added invite flyer image to WhatsApp confirmatory messages | AI Agent |
| 2026-07-15 | Updated BurialHostDashboard: single MessageSquare icon for Confirm, single QrCode icon for QR | AI Agent |
| 2026-07-15 | Added splash screen and host-from-URL to burial RSVP page | AI Agent |
| 2026-07-15 | Removed 24 temporary/check scripts from repo | AI Agent |
| 2026-07-15 | Fixed WhatsApp fallback in messaging.py and rsvp.py (Meta Cloud → Twilio) | AI Agent |
| 2026-07-31 | Added THE EVELLE EXPERIENCE client event (id 57, slug the-evelle-experience): organizer user evelle@accredit.vip, event record, FlierAsset, flyer at /uploads/evelle_flyer.jpg | AI Agent |
| 2026-07-31 | New public registration flow: backend/app/api/event_registration.py (GET/POST /rsvp/register/{slug}) registered in main.py; frontend /rsvp/register/[slug] with 5s splash, RSVP form (name/email/phone + Yes/No) | AI Agent |
| 2026-07-31 | Event 55 host allocations updated: LAWAL Feyisayo Jimoh 25→30, AROGUNDADE Tolulope Omolara 25→50, LAWAL-OBELAWO Olayiwola 30→36; added 35 accepted guests under ADEDIMEJI Ramota Bolanle Sarah and 13 under LAWAL Samuel Oluwaseun | AI Agent |
| 2026-07-31 | Scan page restructured: removed select mode, default = Live Scanner, bottom nav toggle between Live Scanner/Manual Entry, no Back button | AI Agent |
| 2026-07-31 | Removed STD (Save the Date) per-guest send button from GuestsTabContent and dashboard/events/[id] page (STD exclusive to another dashboard) | AI Agent |
| 2026-07-31 | QR messages now include the event flier: email HTML shows full flier image at top + clean QR code below (flyer_url param in _build_qr_message); WhatsApp sends flier image AND clean QR as two media attachments via Twilio (media_urls support added to messaging.py/rsvp.py/whatsapp_service.py). Removed compose_flier_qr_url (QR stays clean, NOT overlaid on flier) | AI Agent |
| 2026-08-11 | Went live with Paystack as the ONLY payment gateway. Removed ALL Nomba code: deleted nomba_service.py + nomba_api.py, removed nomba_api import/router from main.py, removed NOMBA_* settings from config.py + .env.example + server .env. Removed Pay-with-Nomba button from events/[id]/page.tsx and Nomba option/verify from dashboard/wallet/page.tsx (defaults to Paystack, adds 2s wallet refresh after callback). Removed nomba branch from wallet_api.py /wallet/fund | AI Agent |
| 2026-08-11 | Fixed Paystack ticket fulfillment (was broken): webhooks.py /webhooks/paystack now completes TicketPurchase (mark paid, decrement tickets_available, send QR ticket via email/WhatsApp) instead of just logging; also credits WAL- wallet top-ups. Replaced Nomba-only + sandbox-auto-complete POST /tickets/purchase/verify/{ref} with a real Paystack verify endpoint (confirms with Paystack transaction/verify before fulfilling). New shared service app/services/ticket_fulfillment.py (fulfill_ticket_purchase + credit_wallet_payment) reused by tickets.py purchase-webhook + verify + webhooks.py | AI Agent |
| 2026-08-11 | Set event 53 (Lagos Food and Wine Festival) ticket_price 12000 → 100 NGN (100 tickets available) to let real people test-buy tickets via Paystack on the Discover Event page. Tested end-to-end: POST /tickets/purchase returns live Paystack authorization_url; simulated charge.success webhook completed the purchase (correct HMAC 200, bad signature 401); test purchase cleaned up afterwards | AI Agent |
| 2026-08-11 | Removed dead DigitalOcean/S3 storage code (uploads already live on VPS disk): deleted STORAGE_BUCKET/ENDPOINT/KEY/SECRET from config.py, removed STORAGE & CDN block from .env.example, removed boto3==1.36.0 from requirements.txt + uninstalled boto3/botocore/s3transfer from server venv. Backend restarted, healthy. | AI Agent |
| 2026-08-11 | Added nightly backup of uploads dir: /usr/local/bin/backup_uploads.sh tars+gzips /var/www/accredit.vip/backend/uploads → /backups/uploads/uploads-<stamp>.tar.gz, 14-day retention, logs to /var/log/accredit_uploads_backup.log. Cron: 0 3 * * * in /etc/crontab. First backup (107 MB, 1592 files) created and verified. | AI Agent |
| 2026-08-11 | DISCOVERY: production DB lives on DigitalOcean Managed PostgreSQL (accredit-vip-db-do-user-12996151-0.d.db.ondigitalocean.com:25060, ~$71/mo). VPS has NO local PostgreSQL installed (only psql client). DATABASE_URL in server .env points to DO. File uploads are on VPS disk. Decision on migrating DB to VPS-local Postgres is PENDING user. | AI Agent |
| 2026-08-11 | **MIGRATED production DB from DigitalOcean Managed PostgreSQL to VPS-local PostgreSQL 18.** Installed postgresql (pgdg 18, cluster 18/main) on VPS, created role `accredit` + db `accredit` (password in /root/.accredit_db_pw). Dumped DO DB (`pg_dump --no-owner --no-privileges`, 19 MB SQL, 43 tables) and restored to VPS-local (only non-critical pg_stat_statements extension skipped). Flipped DATABASE_URL in server .env → `postgresql+asyncpg://accredit:***@127.0.0.1:5432/accredit` (old .env saved as .env.bak-<timestamp>). Restarted accredit-api.service. Verified live: health 200, login OK, public events 5, event 53 price=100 avail=99, rsvp/register 200, ticket_purchases intact (incl. real paid #24). **DO cluster still running (not deleted) as fallback — user must cancel it in DO dashboard to stop ~$71/mo.** | AI Agent |
| 2026-08-11 | Added nightly DB backup: /usr/local/bin/backup_db.sh pg_dumps VPS-local accredit DB (--no-owner, gzip) → /backups/db/accredit-db-<stamp>.sql.gz, 14-day retention, validates gzip, logs to /var/log/accredit_db_backup.log. Cron: 15 3 * * * in /etc/crontab. First dump (470 KB) created + test-restored into scratch db (43 tables, 1458 guests) then dropped. | AI Agent |
| 2026-08-12 | **LEFT DigitalOcean COMPLETELY.** Deleted both DO Managed PostgreSQL clusters via DO API (using doctl token on VPS): `accredit-vip-db` (old Accredit DB, nyc3, pg16) and `db-pgsql-sfo3-21946` (empty unused cluster, sfo3, pg18, 0 tables). Deletion verified: 0 DB clusters remain, all DO DB charges stop. Full stack verified AFTER deletion: accredit api 200, accredit web 200, event 53 data intact (price 100, avail 99), login OK, vodi-api 200. KEPT (predate accredit, unrelated): DO droplet 414531561 (209.38.146.53, hosts Lagos Polo Club + lagospoloevents.com + accredit.biz + twconline.co + wticket.africa in TWC project). | AI Agent |
| 2026-08-12 | Verified vodi-api is fully self-contained on the Namecheap VPS (NOT on DO): /var/www/vodi-api/ (FastAPI + SQLite seyivodi.db, port 8000, systemd vodi-api.service, health 200), /var/www/vodi-group/ static site, nginx vhosts vodi-group.accredit.vip + api.vodi-group.accredit.vip. vodi has zero DigitalOcean/Postgres dependencies and is fully separate from accredit.vip. | AI Agent |
| 2026-08-15 | Added per-event `registration_open` flag to close public registration for non-burial events: new `registration_open` Boolean column (default true) on events table + Event model; event_registration.py GET now returns `registration_open` and POST rejects with 403 "Registration for this event is closed."; frontend /rsvp/register/[slug] shows a "Registration Closed" screen when flag is false. Set event 57 (THE EVELLE EXPERIENCE, slug the-evelle-experience) registration_open=false. Verified live: GET shows false, POST 403, event 53 still open. Backend (event.py, event_registration.py) + frontend rebuilt & deployed. | AI Agent |
| 2026-08-15 | Fixed 500 "Internal Server Error" on /accreditation + /accreditation/scan after frontend deploy: the scp of `.next` to the server timed out mid-transfer, leaving a MIXED build (old Aug 11 files + new) plus directories with 700 perms that the `deploy` service user couldn't traverse (MODULE_NOT_FOUND). Fixed by zipping `.next` locally (Compress-Archive), scp'ing the single 8 MB archive, extracting fresh, chown -R deploy:deploy, chmod 755 dirs/644 files, restart accredit-web.service. All routes verified 200 (home, accreditation, scan, dashboard, admin, rsvp/register). | AI Agent |
| 2026-08-15 | Investigated "Internal Server Error" reports on /admin pages (events/users/payments/etc.): verified server fully healthy — all 8 admin pages 200 at SSR, zero backend 500s, zero chunk 404s post-rebuild, static chunks all present, `auth.users` schema is a Supabase leftover (app uses clean `public.users`). Root cause = stale browser-cached JS chunks from the earlier broken build window (18:5x). Resolved on hard refresh; no code changes needed. | AI Agent |
| 2026-08-19 | Fixed account registration failing with generic "Request failed": backend `SecureRegisterRequest` (schemas/security.py) requires ≥12-char passwords with upper/lower/number/special char; FastAPI returns 422 with an ARRAY `detail`, and `api-client.ts` only handled string/`.message` details, so real validation messages never surfaced. Updated `frontend/src/lib/api-client.ts` to parse FastAPI array details and show the actual rule; added a password-requirements hint under the register form (`frontend/src/app/register/page.tsx`). Verified registration success (200) and validation failures (422) on server; deployed via zip+extract method; all routes 200. Test users cleaned up. Committed locally as 6c067d4 (push to origin main BLOCKED by GitHub secret-scanning on OLD commit a13f4df containing passwords in scripts/send46.py + scripts/update46_v2.py — user chose to skip push for now). | AI Agent |
| 2026-08-19 | Replaced static password hint with a live checklist on the register page: new shared component `frontend/src/components/shared/password-checklist.tsx` shows 5 requirements (≥12 chars, uppercase, lowercase, number, special char) with a counter and green checks that update as the user types (matches backend StrongPassword rules exactly). Used on `/register`. Deployed via zip+extract; all routes 200. Committed locally as 5021d96. | AI Agent |
| 2026-08-20 | Lifted the payment requirement for event 67 (ACAMB 30th Anniversary, slug acamb-30th-anniversary, organizer user 20 iyanuoluwa.epicentre@gmail.com, client already paid offline). DB-only change (NO code): marked the 2 pending `publish` payments (ACC-7D5CBD811271AF4E, ACC-10BA73530D42A23F, ₦100k each) as `completed`, and set event `status='published'`, `is_public=true` (mirrors what the Paystack webhook does on charge.success). Verified: event detail API 200/published, public /e/acamb-30th-anniversary 200, appears in /events/public (5 events), guest add works, invite send has no event-status gate, resends already free. Cleaned up test guests. | AI Agent |
| 2026-08-20 | Made event 67 PRIVATE per client request: `is_public=false` (kept `status='published'`). Verified: event detail API still 200/published, guest CSV upload works, send-QRs-to-all works, event is NOT in /events/public list. Cleaned up e2e test guests. | AI Agent |
| 2026-08-20 | **Invites now go out WITH the QR code** for events with `qr_delivery='with_qr'`: changed `_send_to_guest` in backend/app/api/messaging.py — when `event.qr_delivery=='with_qr'`, it generates the guest QR via `get_or_create_guest_qr` + `qr_to_url(qr_url, image_path=flyer_path, size=250)` (flyer embedded in QR) and passes `qr_image_url`+`qr_url` to `_build_invite_message`; email shows flyer at top + "YOUR UNIQUE ENTRY CODE" QR block; WhatsApp sends flyer + QR as two media attachments. Also fixed: custom invite subject/body from the dashboard Invites tab now ALSO render in the email HTML body. (Superseded by the RSVP-first `qr_later` flow for event 67.) | AI Agent |
| 2026-08-20 | **Persistent per-event invite message** for event 67 (ACAMB 30th Anniversary): added `invite_subject` + `invite_body` columns to events table + Event model, `InviteMessageRequest` schema, and a dedicated `PUT /events/{id}/invite-message` endpoint (safe partial update — the generic `PUT /events/{id}` requires all mandatory fields and would overwrite them). `_build_invite_message` in messaging.py now defaults to `event.invite_subject`/`event.invite_body` for ALL send paths (batch, resend, per-guest) when no per-send custom values are given, and supports template variables `{{ guest_name }}`, `{{ event_title }}`, `{{ event_date }}`, `{{ event_time }}`, `{{ venue }}`, `{{ rsvp_link }}`, `{{ host_name }}`, `{{ dress_code }}` + `{guest name}` in both plain-text and HTML bodies. `_format_time` now strips `Africa/Lagos|WAT`-style tz to a clean short label (e.g. `4 PM (WAT)`). Frontend: Invites tab "Customize Invite Message" now loads the saved values and has a **Save message** button (calls the new endpoint); `EventData`/`CreateEventInput` types updated. Set event 67 saved message to the client-approved template (Dear {guest name} / 30th Anniversary prose / RSVP line / closing) with subject "ACAMB 30th Anniversary" and dress_code AFRO GLAM. Verified live: GET 67 shows saved fields, PUT invite-message 200, message render substitutes guest name, em-dash intact, DATE/TIME/VENUE/DRESS table + RSVP NOW button present, QR not included (qr_later flow). Backend + frontend rebuilt & deployed, all routes 200. | AI Agent |
| 2026-08-20 | **Event 67 switched to RSVP-first flow** (`qr_delivery='with_qr'` → `'qr_later'`) per client request: invite is sent WITHOUT a QR (flyer + RSVP button/link only), then guests who RSVP "Yes" **automatically** receive their QR via the existing `_send_qr_after_rsvp` background task in rsvp.py (fires on POST /rsvp/{token} with response=yes — creates/reuses the guest QR, flyer embedded, email + WhatsApp). Guests who RSVP "No" are marked declined and get NO QR. This is DB-only (no code change): the `with_qr`→`qr_later` flip makes `_send_to_guest` skip QR generation on invites. Verified live on event 67: sent invite to guest 1697 → NO QR in email (`HAS_QR_IMG: False`, RSVP button + link present); simulated Yes RSVP → status accepted + QR message auto-delivered (batch 2466, status delivered, QR id 1084 reused); simulated No RSVP on test guest → declined + 0 QR codes + 0 messages. Test guest cleaned up; guest 1697 reset to pending. | AI Agent |
| 2026-08-20 | **WhatsApp invites now send the SAME flyer image + invite text as email (via Twilio).** In `_send_to_guest` (backend/app/api/messaging.py) the `whatsapp` channel previously used the Meta Content-SID template (`TWILIO_WHATSAPP_INVITE_CONTENT_SID`) which sent neither the flyer image nor the custom message. Changed priority: if a flyer image exists (`event.invite` FlierAsset or cover_image), send it as a Twilio media attachment together with the custom invite text (same `body` as email); the Content-SID template is now only a fallback when there is NO flyer. Verified on server by mocking the send layer: WhatsApp path passes `media_url=https://accredit.vip/uploads/flier-4aac340a346f410baa810bcb6c02eb82.jpg` + the custom body. Twilio credentials already configured on server (used by burial). | AI Agent |
| 2026-08-20 | **Dashboard hero image now falls back to the latest uploaded flier** when `event.cover_image` is empty. Client uploaded a new image via the "upload flier" action (created `FlierAsset` id 7), which populated the fliers gallery but left the hero banner blank (it reads `cover_image`). Fixed `frontend/src/app/dashboard/events/[id]/page.tsx` overview tab to derive `heroImage = cover_image \|\| latest flier`. Also made the event **edit** page (`edit/page.tsx`) preserve `invite_subject`/`invite_body` on save (the generic `PUT /events/{id}` was otherwise wiping them to NULL because they weren't in the form payload). Re-saved event 67's invite message to the client-approved template (Dear {guest name} / 30th Anniversary prose / RSVP line / closing, subject "ACAMB 30th Anniversary"). Backend + frontend rebuilt & deployed; all routes 200. | AI Agent |
| 2026-08-21 | **Twilio WhatsApp template for ACAMB invites (FINAL, approved).** Created Twilio Content `twilio/media` template `acamb_invite_v3` (SID `HX5b4d2e73561e13b50d2a863564547fca`): fixed header image = ACAMB flyer (`/uploads/flier-4aac340a346f410baa810bcb6c02eb82.jpg`), body = exact ACAMB invite wording with `{{1}}`=guest name and `{{2}}`=per-guest RSVP link, category MARKETING, trailing static line "Accredit.vip — Premium Event Infrastructure" so no variable sits at the start/end. (Earlier `acamb_invite_v1` HX9253... was REJECTED by Meta: "Variables can't be at the start or end of the template" — caused by `{{2}}` RSVP link being the last line.) Set `TWILIO_WHATSAPP_INVITE_CONTENT_SID=HX5b4d2e73561e13b50d2a863564547fca` in server `.env` (old SID pointed at a different event's template, "alex_birthday"). In `messaging.py` `_send_to_guest`, the `whatsapp` channel uses the template as PRIMARY (passes `ContentSid` + `ContentVariables {"1": guest.name, "2": rsvp_link}`, `media_url=None`), with automatic fallback to free-form flyer+text send if the template send fails. Template is APPROVED and live; backend restarted, healthy. | AI Agent |
| 2026-08-21 | **QR-after-RSVP via WhatsApp — template attempt ABANDONED (Option A chosen).** Tried to add an approved WhatsApp template so the post-"Yes" QR bypasses the 24h free-form window. Created `acamb_qr_v1` (MARKETING, URL variable `{{2}}`=QR link) → rejected ("Unknown", URL-var blocked); `acamb_qr_v2` (MARKETING) → `INCORRECT_CATEGORY`; `acamb_qr_v3` (UTILITY+URL var) → `INCORRECT_CATEGORY`; `acamb_qr_v4` (UTILITY+URL var, clean text) → "Unknown" (URL var); `acamb_qr_v5` (UTILITY, NO URL variable, only `{{1}}`=name, body just confirms RSVP + "QR sent to your email") → **APPROVED** (SID `HX24b358bb472c38bc54b12f7da0147310`). Conclusion: Meta rejects dynamic QR in templates for this account/domain (no dynamic images; URL variables rejected), so a template CANNOT carry the per-guest QR — v5 can only confirm + point to email. Decision: **keep current behavior (Option A)** — on "Yes" RSVP, `_send_qr_after_rsvp` (rsvp.py:60) sends the QR via **free-form WhatsApp (image, works only within 24h of guest's last inbound WhatsApp msg) + always email**. v5 template left UNUSED. NOTE: `.env` never got `TWILIO_WHATSAPP_QR_CONTENT_SID` (the update only replaced an existing line that didn't exist, so the code falls through to free-form — which is the desired state). To get the QR LINK reliably on WhatsApp, `accredit.vip` must be verified as a domain in the WhatsApp Business Manager (enables URL variables). | AI Agent |
| 2026-08-21 | **Generic-link RSVP flow for event 67 (ACAMB).** Client wants a single public link (not per-guest) where guests see event info + "Will you be attending?"; "Yes" → details form (Full name, Email, Phone, **Organization**, **Sub Department**); "No" → ends with NO guest created. "Yes" submitters become Guests in the dashboard for later QR sending. Scoped STRICTLY to event 67 (slug `acamb-30th-anniversary-1`). Backend `event_registration.py`: `RegistrationRequest` gained `organization`+`sub_department`; GET now returns `two_step=True` + `extra_fields=["organization","sub_department"]` for event 67 (else `False`/empty); POST for event 67 — `declined`/`no` with no details returns success WITHOUT a Guest; `accepted` requires name+email+phone+organization+sub_department (400 otherwise) and stores them in `guest.custom_data`. Frontend `/rsvp/register/[slug]/page.tsx` rewritten: two-step for event 67 (attendance question first → details form on Yes; No → end screen, no API call), single-page flow preserved for other events, 5s splash skipped when `two_step`. Verified live via API: GET `two_step=True`+correct fields; POST yes created guest with `custom_data={organization, sub_department}` (test cleaned up); POST no returned success with NO guest. Backend deployed (health 200); frontend built on server + restarted (web 200). | AI Agent |
| 2026-08-21 | **Dashboard now shows Organization + Sub Department for event-67 guests.** In shared `frontend/src/components/events/GuestsTabContent.tsx`, the Guest cell (desktop table) and the mobile card now render `Org:` / `Dept:` from `guest.custom_data` when `eventId === 67` (additive, no effect on other events). Frontend rebuilt + redeployed; `/dashboard/events/67` and `/rsvp/register/acamb-30th-anniversary-1` both 200. | AI Agent |
| 2026-08-21 | **Register page now shows the flyer on BOTH steps + supports phone country codes + caps at 200.** Backend `event_registration.py` GET now returns `flyer_url` (latest `FlierAsset` for the event) so the banner shows even when `cover_image` is empty; `_normalize_phone` now PRESERVES an explicit `+` country code (e.g. `+1...`) instead of forcing `+234`. Frontend `/rsvp/register/[slug]/page.tsx` uses `cover_image \|\| flyer_url` for every banner (attendance, details, single-page, closed, done) and added a flyer banner to the details step; phone field is now a country-code `<select>` (default `+234`, plus +1/+44/+233/+254/+27/+971/+91) combined with the local number on submit; backend POST restricts event 67 to **200 accepted** registrations (counts only NEW guests; returns 409 "Registration ... is now full" when reached). Verified: GET returns `flyer_url=/uploads/flier-4aac340a346f410baa810bcb6c02eb82.jpg`, `two_step=true`; backend + frontend rebuilt & deployed, both routes 200. | AI Agent |
| 2026-08-26 | **Fixed Twilio 63016/63019 on event-67 QR-after-RSVP + register page now shows FULL flyer.** Root cause: the server's deployed `config.py` was stale (missing `TWILIO_WHATSAPP_QR_CONTENT_SID`), so `_send_qr_after_rsvp` (rsvp.py:107) raised `AttributeError`, fell back to free-form WhatsApp with media → Twilio `63016` (outside 24h window) and `63019` (media failed to download). Fix: deployed current `backend/app/core/config.py` (adds `TWILIO_WHATSAPP_QR_CONTENT_SID`) and set it in server `.env` to the approved `acamb_qr_v5` SID `HX24b358bb472c38bc54b12f7da0147310`. Now QR-after-RSVP uses the template (no media, works outside 24h); the QR image itself is still delivered reliably via **email** (which embeds the current flyer). Frontend `/rsvp/register/[slug]/page.tsx`: changed all flyer banners from a cropped `object-cover` box to a full `object-contain`/`h-auto` image so the entire flyer shows. Also: client replaced event 67's flyer (new `FlierAsset` id 9 = `/uploads/flier-bb02bce2a7494cb2bfbcc400dfd7e407.jpg`, served 200, 264 KB); the live flyer is now correctly used everywhere EXCEPT the approved Twilio invite template `acamb_invite_v3`, whose header image is still the old flyer (hosted by Twilio). Backend + frontend rebuilt & redeployed, both 200. | AI Agent |
| 2026-08-26 | **Recreated event-67 WhatsApp invite template with the NEW flyer + verified QR v5 template works.** Created Twilio Content `twilio/media` template `acamb_invite_v4` (SID `HXc0e7484d018ce18fe8c029eb47a14ad0`) — exact copy of `acamb_invite_v3` body ({{1}}=guest name, {{2}}=RSVP link, category MARKETING) but header image = new flyer `/uploads/flier-bb02bce2a7494cb2bfbcc400dfd7e407.jpg` and time updated to `5 PM (WAT)` to match the current event time. Submitted for Meta approval (status `received`/pending; usually 5 min–24h). Set server `.env` `TWILIO_WHATSAPP_INVITE_CONTENT_SID=HXc0e7484d018ce18fe8c029eb47a14ad0` and restarted `accredit-api.service`; until v4 is approved, invites fall back to free-form with the new flyer (within the 24h window). Verified the QR-after-RSVP flow end-to-end with a temp guest: Twilio now sends via the approved `acamb_qr_v5` template (no media) and returns delivered — **no `63016` (24h) and no `63019` (media download) errors**. (The Meta Cloud "recipient not in allowed list" seen in the test is a sandbox artifact of the fake test number and falls back to Twilio cleanly.) | AI Agent |
| 2026-08-26 | **Event-67 public RSVP slug fixed (both `acamb-30th-anniversary` and `-1` now resolve).** The event slug had been toggled back to `acamb-30th-anniversary-1` in the DB, so the preferred URL `acamb-30th-anniversary` 404'd. Added a slug-alias fallback in `backend/app/api/event_registration.py` `_get_event_by_slug`: if the exact slug is not found it also tries the `-1` sibling variant (and vice-versa), so the public registration link keeps working regardless of which form is stored. Also set event 67's canonical `slug='acamb-30th-anniversary'` in the DB. Redeployed backend; verified both `https://accredit.vip/rsvp/register/acamb-30th-anniversary` and `.../acamb-30th-anniversary-1` return 200 at API and web (SSR). Invite RSVP links now generate with the clean `acamb-30th-anniversary` slug. | AI Agent |
| 2026-08-29 | **FIXED: ACAMB (event 67) WhatsApp invites not delivered — root cause = 63019 (deleted flyer image).** The approved invite template `acamb_invite_v4` (HXc0e7484d018ce18fe8c029eb47a14ad0) carries a flyer **header image** at `/uploads/flier-bb02bce2a7494cb2bfbcc400dfd7e407.jpg`. That file had been deleted (the event's flyer was later re-uploaded as `flier-c00f9e2295d24e5bbac9cb71e1332627.jpg`, now the current FlierAsset id 10), so the URL returned **404**. Twilio/Meta then failed every send with **63019 "media failed to download"** — the API returned 201 (accepted) but the message never arrived. (Earlier `63016` errors on the same event were from before `acamb_invite_v4` finished Meta approval, when the code fell back to free-form WhatsApp blocked outside the 24h window; both `acamb_invite_v4` and `acamb_qr_v5` are now APPROVED.) **Fix:** restored the image at the exact URL the template references by copying the current event-67 flyer to that path (`cp flier-c00f9e2295d24e5bbac9cb71e1332627.jpg flier-bb02bce2a7494cb2bfbcc400dfd7e407.jpg`) so the template media is fetchable again — no re-approval needed. Verified: template send to test number +2348101143265 returned HTTP 201 and Message status **`delivered`** with no error. Also added defensive `_normalize_phone()` to `whatsapp_service.py`/`whatsapp_cloud_service.py`/`sms_service.py` (E.164, incl. `+2340…`→`+234…` and missing-country-code cases). Deployed + restarted `accredit-api.service` (health 200). Clients can now resend the failed event-67 WhatsApp invites from the dashboard and they will deliver. | AI Agent |
| 2026-09-11 | **TOTAL BRANDING OVERHAUL: "ACCREDIT.VIP" -> "ACCREDIT INTERACTIVE".** New brand identity: teal/green geometric shield logo, new color scheme (Primary: #1ABC9C teal, Primary Dark: #16A085, Secondary: #0D1B2A navy). Changes: (1) globals.css all CSS variables swapped pink->teal, all hardcoded hex/rgba values, utility classes renamed. (2) Logo system: logo-full.png, logo-mark.png (favicon), logo-text.png. Old logos removed. (3) mix-blend-mode:multiply on dark backgrounds. (4) Brand name updated across 60+ TSX files. (5) layout.tsx favicon + metadata. (6) Deployed via tar+ssh, rebuilt on server, all routes 200. | AI Agent |
| 2026-09-22 | **BLACK MARKET (event 77): unlimited packages + Paystack wiring verified (no live charge).** DB: both `pass_packages` limits set to `None` (General ₦2,000, Premium ₦50,000, unlimited). Backend already ignores package limits (only `tickets_available` is enforced, which is `None`/unlimited). Verified on server (booleans only, no secrets): live+test Paystack keys set, owner email resolves to test key while others resolve to live key, webhook HMAC-SHA512 signatures validate for both keys. Purchase flow re-confirmed: missing package → 400, General/Premium → live Paystack `authorization_url`; `verify` only fulfills after Paystack confirms success. No live payment was completed (would spend real money). | AI Agent |
| 2026-09-22 | **Landing-page BLACK MARKET slider → /attend + attend price badge fix + wallet wordmark fix.** New `frontend/src/components/home/black-market-slider.tsx` (auto-sliding flyer/passes/info spotlight, whole card links to `/attend`), rendered in `HomePageClient` right after the hero for mobile + desktop. Fixed `/attend` price badge: events with `ticket_price=0` but paid `pass_packages` now show `From ₦2,000` instead of `FREE`. Fixed wallet page inline sidebar (the cause of the missing wordmark in the screenshot): it rendered only `logo-mark.png` with wrong dimensions — now renders mark + `logo-text.png` when expanded, matching the shared sidebar. Local `tsc` + `npm run build` clean (47 pages); server rebuild clean; web/API/attend/wallet/events-77 all 200. | AI Agent |
| 2026-09-22 | **FIXED: ticket emails never sent (wrong import) + live mail+QR proof.** `send_ticket_email` in `backend/app/services/ticket_delivery.py` imported `from app.services.email import send_email`, but the module is `app.services.email_service` — every ticket email died with `ModuleNotFoundError` (caught + logged inside fulfillment). Fixed the import, redeployed `ticket_delivery.py`, restarted API. Proof on server: created pending General-Access purchase for event 77 → `fulfill_ticket_purchase` → status `completed`, `email_failed=False` (SMTP). A real QR ticket email was delivered to `sodushileomodolapoodunayo@gmail.com`; test purchase row deleted afterwards so the dashboard sales list stays clean. | AI Agent |
| 2026-09-22 | **Sessions now persist (removed forced logouts).** Two frontend mechanisms were kicking users out: (1) `dashboard/layout.tsx` auto-logged-out 30s after the tab was hidden (tab switch/minimize/close on mobile fires this constantly); (2) `SessionGuard` called `logout()` whenever a logged-in user visited any public page not on its allow-list (`/attend`, `/pricing`, `/community`, `/contact`, `/features/*`, `/ticket/*`, etc.). Removed both. `SessionGuard` now only redirects *unauthenticated* visitors away from protected routes (`/dashboard`, `/admin`, `/create-event`) to `/login`. Backend JWT already lasts 7 days (`ACCESS_TOKEN_EXPIRE_MINUTES=10080`) + idle timeout 4h (7d remember-me), so logins now survive tab switches, browser restarts. | AI Agent |
| 2026-09-22 | **BLACK MARKET slider → right-to-left marquee under navbar + failed-messages wordmark + ticket form UX.** Rewrote `black-market-slider.tsx` as a slim in-flow marquee (CSS `translateX(0 → -33.333%)` loop, pauses on hover) rendered as the first element inside the hero, directly under the navbar — normal document flow, so it can never cover the "From invitation to entry..." headline. Every card links to `/attend`. Fixed the same missing-wordmark bug on the failed-messages inline sidebar (mark + `logo-text.png` when expanded). On `/events/77`: quantity dropdown → `−`/`+` stepper (1–10); phone field labeled "(optional)" with country-code select defaulting to `+234` (also +1/+44/+233/+254/+27/+971/+91), combined into E.164 on submit (`0810...` → `+234810...`). Local + server builds clean (47 pages); all routes 200. | AI Agent |
| 2026-09-22 | **Ticket emails: sender → "ACCREDIT INTERACTIVE", QR now hosted (Gmail fix), all-teal branding.** Root cause of missing QR: Gmail blocks `data:`-URI images, and every ticket email embedded the QR that way. New `save_ticket_qr_image()` in `ticket_delivery.py` persists each QR as `/uploads/ticket-qr-{reference}.png` and the templates reference that URL (data URI kept as fallback); also applied to wallet-purchase + free-ticket paths in `tickets.py`. Replaced all remaining pink `#E91E8C` in ticket emails with teal `#1ABC9C`/navy (headers, borders, timeline, "BE PART OF HISTORY"), generic template footer → "Powered by Accredit Interactive". Server `.env` `EMAIL_FROM` → `ACCREDIT INTERACTIVE <noreply@wristbandsng.com>` (+ same default in `config.py`/`.env.example`). Proof: re-ran fulfillment test → purchase `completed`, email sent, QR PNG (51 KB) saved and publicly serving 200 at `/uploads/...`. Test row cleaned up. | AI Agent |
| 2026-09-22 | **Marquee v2: slim absolute strip, hero headline untouched.** Per feedback the in-flow marquee pushed the "Premium Event Infrastructure · Africa / From invitation to entry..." hero down. The slider is now a ~52px `absolute top-0` strip inside the hero (fits inside the existing top padding on mobile/desktop, overlays background only), sliding right-to-left with exactly 3 cards — the event, General Access, Premium — each linking to `/attend`. Hero content itself was not moved. Rebuilt local + server (47 pages), all routes 200. | AI Agent |
| 2026-09-22 | **Ticket QR now opens guest details + accreditation validates event-77 tickets.** Previously every ticket QR encoded raw text (`TICKET\|...`, and the ticket page showed yet another `ACC:...` code) — a phone-camera scan opened nothing and `/scanner/verify` rejected them all. Now: (1) `generate_ticket_qr` encodes the canonical ticket URL `https://accredit.vip/ticket/{reference}` everywhere (emailed QR, hosted QR PNG, `/purchases/{ref}/qr-image`); scanning opens the ticket page with buyer/event/package details. (2) `fulfill_ticket_purchase` registers the buyer as an accepted Guest (`invited_by="Ticket Purchase"`, purchase details in `custom_data`, deduped by email) plus a `QRCode` row keyed by purchase reference — so `/accreditation` (global event list already includes event 77) verifies, checks in, searches, and counts ticket buyers like normal guests. (3) `GET /purchases/{ref}/ticket` + ticket page now include/display `package_name`. Proof on server: fulfill → Guest+QRCode rows created → `POST /scanner/verify` with full ticket URL returned valid + guest/event → `checkin` approved → re-scan correctly `used`. All test rows cleaned up. | AI Agent |
| 2026-09-22 | **Marquee v3: big cards, hero untouched, left fade-out before headline.** Per feedback v2 was too tiny and the original complaint stands: the hero must not move. The slider is now a large-card (`h-32/36`, 340px) `absolute` strip — bottom-anchored full-width on mobile, vertically centered across the right 64% on desktop — so hero layout is byte-identical. The track carries a left gradient mask (`transparent → black` over the first ~24%) so cards dissolve before reaching the "Premium Event Infrastructure · Africa / From invitation to entry..." headline, plus a slight right-edge fade where they enter. Still exactly 3 cards (event, General, Premium), each linking to `/attend`. Rebuilt local + server (47 pages); web/scan/API all 200. | AI Agent |
| 2026-09-22 | **Marquee v4: in-flow strip directly under navbar, exactly 3 visible cards.** Per feedback v3 sat mid-screen over the headline and the loop showed more than 3 cards at once. The slider is now rendered in `app/page.tsx` between `Navbar` and the hero (normal flow, hero internals 100% untouched): dark strip with "Now selling" + "View event →" (`/attend`), stepped carousel showing exactly 3 cards on desktop / 1 on mobile, auto-advancing every 3.8s with seamless wrap (cloned head card + snap reset), pause on hover, every card links to `/attend`. **Navbar logo investigated: NO bug found** — `logo-mark.png`/`logo-text.png` exist on server, serve HTTP 200 as `image/png`, and landing HTML contains the correct `<img>` tags; the empty box in the screenshot was the images not yet painted (note: nginx sends `no-store` + user on VPN). No code change; hard refresh advised. Rebuilt local + server (47 pages), web 200. | AI Agent |
| 2026-09-22 | **Marquee v5: back to overlay top strip, hero not moved.** Per feedback v4 (in-flow under navbar) pushed the hero down. Reverted `app/page.tsx` to Navbar + hero only; the slider is again the first child inside the hero (`absolute top-0`, overlays background only, nothing below it moves). Big cards (320px, h-24 thumbs/prices) sliding right-to-left with a wide left gradient mask (`transparent → black` over the first 50%) so cards dissolve long before the headline, plus a slight right-edge fade. Exactly 3 cards (event, General, Premium), each linking to `/attend`. Rebuilt local + server (47 pages); web 200, slider + hero + logo all present in live HTML. | AI Agent |
| 2026-09-22 | **Marquee v6: "Buy Tickets" + clickable cards (z-index fix).** Two defects in v5: (1) event card said "Get tickets" → now "Buy Tickets"; (2) cards were NOT clickable — the hero content wrapper (`relative`, `z-index: 10`) sat above the strip (`z-index: 5`) and swallowed all clicks/hover. Fixed by confining the strip to the right half on desktop (`sm:left-1/2`, zero overlap with the text column) and raising it to `z-index: 20` (mobile top band has no hero interactives, so clicks land on cards there too); left fade tightened to 30% of the strip. Rebuilt local + server (47 pages); live HTML contains "Buy Tickets" + slider + hero + logo. | AI Agent || 2026-09-22 | **Event 77 dashboard: unlimited manual guest adds + QR sending verified.** Root cause of the cap: `ensure_guest_capacity` in `guests.py` derives the max from `event.guest_count_range` — event 77 was `'500-2000'` (cap 2000). Set it to `'Unlimited'` (non-numeric → no cap) for single adds AND CSV uploads; no code change, other events untouched. QR sending has no gates (only needs guest contact info) via `POST /events/77/guests/{id}/send-qr` (single) and `POST /events/77/send-qrs` (all). Proof on server as the organizer: added guest with the owner gmail → 200, sent QR via email channel → `sent: true`, message `sent`; a real QR email was delivered. Test guest + messages + QR rows fully cleaned (event back to 0 guests). Client can now add unlimited guests and send QRs from `https://accredit.vip/dashboard/events/77`. | AI Agent |
| 2026-09-22 | **Event 77: guest categories end-to-end (dashboard > QR email > accreditation > analytics) + QR footer rebrand.** (1) `GuestCreate`/`GuestUpdate`/CSV-upload now accept `category`; dashboard Add Guest form + Edit modal have a Category select (General Access / Premium VIP/VVIP). (2) `_build_qr_message` renders per-category content: Premium gets VIP badge + ZONE D/gate/Odeya+East Pavilion parking; General gets category badge + ZONE A&B + regular car parks; footers (invite + QR templates) now read `ACCREDIT INTERACTIVE - Premium Event Infrastructure`, pink accents changed to teal. (3) Accreditation shows category: verify response + guests-search + activity feed include it; ScanClient shows a teal Category badge on scan results + manual rows. (4) New `GET /scanner/events/{event_id}/category-stats` (per-category + overall checked-in totals); report page has a live Accreditation section polling it every 15s. Proof on server: added General + Premium guests (category persisted) > Premium QR email sent > stats endpoint correct > scanner verify returned the category > templates contain zone content + new footer, zero pink > all test rows cleaned. | AI Agent |
| 2026-09-22 | **Hero tightened + pricing header centered/teal + 3 guest categories (General/Premium/VVIP).** (1) Hero content moved up per feedback: mobile CTA `pt-56`>`pt-44`, desktop `pt-10/sm:pt-14/lg:pt-20`>`pt-44/sm:pt-44/lg:pt-8`, so pill/headline/buttons sit closer under the navbar; marquee strip now right-half only on `lg+` (full-width below, cleared by the new padding) so it can never overlap single-column text. (2) CHANNEL PRICING header centered with teal eyebrow (was pink, left-aligned). (3) Categories now exactly **General Access / Premium VIP / VVIP** in dashboard Add/Edit selects + CSV docs; QR email badge is dynamic (VVIP > PREMIUM VIP > category name), Zone D content for both VIP tiers (render-verified for all three on server). Local + server builds clean (47 pages); web/report/ev77/scan/API all 200. | AI Agent |
| 2026-09-22 | **Category on public guest QR page + Black Market emails in client burnt-orange.** (1) `GET /qr/{token}` (`verification.py`) now returns `category`; `/qr/[token]` page shows a category badge under the guest name (verified: VVIP returned + displayed). (2) BM email rebrand to client colours: `format_black_market_email` teal `#1ABC9C`>`#C2410C` (17 spots), headers to orange>dark `#7C2D12`; `_build_qr_message` for event 77 uses burnt-orange accents (`#C2410C`/`#FDBA74`) while other events keep teal; generic ticket template untouched. Render-verified. NOTE: client banner image files (square + portrait) still needed from user to replace the email header flyer. Backend + frontend rebuilt & deployed; web/qr/API all 200. Test rows cleaned; 4 real event-77 guests (with categories) left intact. | AI Agent |
| 2026-09-24 | **All-in ticket pricing: General N2,250 / Premium N52,500 via per-package fees.** Neither total matches a flat percentage, so `pass_packages` entries gained an optional `fee`: General fee=250, Premium fee=2500 (DB, event 77 only). Backend: fee packages compute `total=(price+fee)*qty` with `platform_fee=fee*qty`, `vat=0`; packages WITHOUT `fee` keep legacy 5%+2.5% math (other events untouched). Frontend shows a Charges row + matching totals in the breakdown, hero card, and Pay button when the selected package has a fee. Proof: purchase init returns exactly 2250/52500 with live Paystack URLs; test rows cleaned. | AI Agent |
| 2026-09-24 | **QR sending re-verified with new design + PDF attachments.** Dashboard QR (General) and ticket-fulfill (Premium) both `sent`, both carried a generated PDF (`BLACK-MARKET-QR-*.pdf`, 28KB/48KB) with correct subjects; real emails delivered via SMTP to owner gmail. Also fixed the server capacity question (see next row). Test rows cleaned. | AI Agent |
| 2026-09-24 | **Server capacity for 20k+ sales: assessed + tuned.** VPS: 4 cores, 5.8GB RAM (3.8GB free), VPS-local PG (20MB). Changes: uvicorn workers 4>6, explicit DB pool cap (`pool_size=5,max_overflow=5` => 60 max conns, PG default limit 100), `reportlab` installed (for QR PDFs) + added to requirements. Fulfillment is idempotent (webhook retries safe) with 15-20s mail timeouts. Verdict: 20k sales spread over days is trivial (~0.2 req/s); bursts of hundreds of concurrent checkouts now have headroom; only theoretical limit is SMTP throughput per worker during extreme spikes (Paystack retries cover it). | AI Agent |
| 2026-09-24 | **Missing QR email traced (SMTP accepted every time; Gmail spam-foldering) + phone input with all country codes/flags.** Guest 4452 (event 77) shows FIVE email sends today, all `sent` with zero errors — the dashboard was truthful. Mail relays via Namecheap shared hosting; SPF covers it; Gmail flags image-heavy duplicates (earlier mails already show Gmail's 'not spam' banner). Action: fresh single QR email re-sent (SMTP accepted); user must check Spam + mark not-spam and stop rapid resends. Also normalized two malformed event-67 numbers earlier this week. New shared `components/shared/phone-input.tsx`: full ~230-country list with flag emoji + ISO + dial code, Nigeria first/default; wired into dashboard Add Guest + Edit Guest (also upgrades /register which already used it). Burial forms untouched (locked). Local + server builds clean (47 pages); web/ev77/API 200. | AI Agent |
| 2026-09-24 | **Ticket sales now visible in event dashboard + organizer wallet credited.** `GET /tickets/events/77/purchases` verified live (200, returns buyer name/email/phone, quantity, package, amount). `fulfill_ticket_purchase` now also posts a `completed` credit (`SALE-{ref}`) to the event organizer's wallet (idempotent via early-return + existing-tx check) so every paid sale appears in wallet history; tested (+4500 on 2x General) then fully reversed. Dashboard currently shows 1 completed (old free test) — pending junk rows excluded. | AI Agent |
| 2026-09-24 | **Email deliverability deep-dive (still no inbox arrival).** Facts: SPF covers relay IP, DKIM `default._domainkey` + DMARC `p=none` exist, every send SMTP-accepted with zero errors (incl. 5 QR sends to guest 4452). Conclusion: Gmail is swallowing them post-acceptance (spam-foldering from the 5-duplicate burst + image-heavy HTML; earlier mails already showed Gmail's not-spam banner). Sent a plain-text probe + fresh QR emails to BOTH owner addresses (all SMTP-accepted) — awaiting user confirmation of which arrive (inbox vs spam) to distinguish content-filter vs sender-block before changing sender infrastructure. | AI Agent |
| 2026-09-24 | **ROOT CAUSE FOUND: relay 50-send quota exhausted (now unlimited) + A/B proved content innocent.** Both test variants (Georgia+PDF and Georgia-only) arrived in the owner gmail inbox, plus a dashboard-sent QR — HTML, QR image and PDF all deliver fine. Earlier failures were the Namecheap shared-hosting send quota (50), NOT Gmail filtering; user raised it to unlimited. Quota exhaustion fails at SMTP LOGIN/send (loud error), never silent — so any future silent non-arrival is Gmail-side again. | AI Agent |
| 2026-09-24 | **4-sender SMTP failover wired (user’s 3 local .env trios now live).** Chain is now primary SMTP (business87) > SMTP2 (blackmarketmovie@accredit.vip) > SMTP3 (Resend SMTP relay) > SMTP4 (noreply@accredit.vip) > SendGrid API > Resend API, in send_email, send_email_with_images and send_email_with_pdf (email_service.py). New SMTP2/3/4_* settings in config.py (+ documented in .env.example); credentials appended to server .env only. Also fixed SendGrid rom (now splits Name <email> into email+name; raw display-name string fails their API). Verified live: 4 senders load, test mail sent via primary. | AI Agent |
| 2026-09-24 | **Restored client-approved cream/burnt-orange email design for event 77 (was briefly reverted to Georgia/teal during the quota investigation).** ormat_black_market_email rebuilt with shared helpers (_bm_section/_bm_timeline_rows/_bm_important_box/_bm_qr_block/_bm_footer/_bm_shell): cream #FFF8F0, dark-brown #2B1A12, burnt-orange #C2410C, Georgia serif, zero teal; General (YOU’RE IN, barcode-count warning, zones A&B, 5 parks, timelines, BE PART OF HISTORY) vs Premium (Zone D, Odeya/East Pavilion, record-attempt box) variants with hosted-QR blocks + PDF path intact. Dashboard side restored: event-77 gate > _build_bm_qr_message, category zone boxes (teal elsewhere, orange on 77), _send_qr_to_guest flyer-suppress + PDF attach. Render-verified both variants; live test (General+PDF) SMTP-accepted. | AI Agent |
| 2026-09-24 | **Event 77 Media category: 132 guests imported + accreditation invite (no QR).** New Media category in dashboard Add/Edit selects + CSV docs (orange badge, Org shown on guest rows); CSV upload accepts optional organization > custom_data (guests.py). Imported 132 unique media guests (130 with orgs; exact-dupe Adetutu + same-email Maryam Shittu/Tobiloba Rotipin merged; Arise Tv/Bidemi Diaro have no email and can’t receive mail; gmial/gmai typos kept verbatim). New _build_media_invite_message (messaging.py, event-77 + category Media only): exact client template in cream/burnt-orange BM design with bold MEDIA badge, Zone A parks, accreditation contacts — zero QR, badge is the pass. Sample sent to owner gmail for approval; bulk send to 130 emailable guests PENDING approval. Backend+frontend rebuilt & deployed (web/API 200). | AI Agent |
| 2026-09-24 | **Media accreditation invites BULK-SENT (approved): 130/130 delivered.** Sent via POST /events/77/send-invites-batch (email, 5/call x26 chunks, no custom text so the media template fired), all through primary SMTP with zero failures; all 130 media guests now invite_sent=true. 2 contactless guests (Arise Tv, Bidemi Diaro) excluded — no email address. | AI Agent |
| 2026-09-25 | **Wallet history mobile layout fixed (user screenshot).** Root cause of the clipped row: the lex-1 wrapper around the transaction text lacked min-w-0, so 	runcate never engaged and the amount was pushed off-screen (reproduced exactly in a static replica: old clips at card edge, new truncates with ellipsis + amount visible at 393px). Fix in 	ransaction-history.tsx: min-w-0 on the wrapper + shrink-0 amount block + tighter mobile gaps; date filters now grid-cols-2 on mobile (sm:4) with whitespace-nowrap text-xs; wallet main px-4 sm:px-6. Tabs were already scrollable (overflow-x-auto + working .no-scrollbar) — no change. tsc + server build clean, web 200. | AI Agent |
| 2026-09-25 | **Transaction receipt modal rebuilt (labeled rows, no scroll).** Modal now shows Amount / Name / Email / Phone (if provided) / Transaction Type / Status / Date (Friday 25th September, 2026 ordinal) / Time (10:19:31 AM) / Reference in compact rows; backend GET /wallet returns explicit dicts + enriches SALE-* credits with buyer_name/email/phone from TicketPurchase (verified live on a real sale). Frontend mapping passes them through. Applies to all wallet transactions platform-wide. Backend+frontend rebuilt & deployed (API/web 200). | AI Agent |
| 2026-09-25 | **Vendors & Assistants: 1,205 guests imported + 1,181 General Access QRs sent.** Parsed Consolidated_Names_Emails (1,352 rows): dropped 16 label rows, reconstructed 11 Parka staff from Name:/Email: row triples (leading-dash emails stripped), stripped Name:/: artifacts, exact-dupe merge only — shared boss inboxes preserved per person, IGWE/Blessing/Favour double-email rows kept as separate records per user directive; org (business name) shown under each guest row. Excluded 6 live ticket-buyer guests via snapshot+CSV matching. QR loop (6 parallel slices, per-guest send-qr): 1,181 delivered, each person own QR+PDF even on shared inboxes. 6 bad sheet addresses cleared to contactless with originals in notes (gmal/gmil/gmail.come typos, 3x literal NO EMAIL); 18 more never had email — 24 total need correct addresses. Backend+frontend rebuilt & deployed. | AI Agent |
| 2026-09-25 | **Co-developer accreditation portal sync (event 77 auto-forward).** New `app/services/partner_sync.py`: POSTs every event-77 ticket fulfillment + single manual dashboard add to the partner ticket-sale API (exact-label ticket_type, `GUEST-{id}` numbers for manual adds, purchase reference for sales); event-gated (other events no-op), best-effort (failures / already-exists logged, never break our flows; purchases await, manual adds via BackgroundTasks). CSV bulk excluded (snapshots cover bulk). New `PARTNER_TICKET_API_URL` setting (+ .env.example). His endpoint verified reachable from VPS (GET 405 means it exists). Backend deployed, API 200. | AI Agent |
| 2026-09-25 | **Vendor typo emails auto-corrected + sent (3).** gmal/gmil/com-e addresses corrected and QRs delivered to all 3. Vendor delivered total now 1,184 of 1,187 emailable. | AI Agent |
| 2026-09-25 | **171-person reconciliation + snapshot for partner.** `BM_Vendors_Not_Emailed_Breakdown.xlsx` (Downloads): 163 rows - 131 same-name+email dupes (with source row number), 11 label rows, 18 no-email, 3 literal NO EMAIL - plus 5 Parka name-rows delivered via paired email rows (1,352 = 1,184 delivered + 163 + 5). Zero same-name+email doubles on dashboard (no pre-existing overlaps). `BM_Event77_Guest_Snapshot_2026-09-25.xlsx` (Downloads): all 1,555 event-77 guests with ticket_type/ticket_number/qty/rsvp/invite/qr columns for his manual import (1,336 General, 132 Media, 45 Premium, 42 VVIP; 1,535 with QR). | AI Agent |
| 2026-09-25 | **Partner sync fixed to QR tokens + his column too short (action needed on his side).** Audit proved: snapshot ticket_number IS the QR token (QR encodes `/qr/{token}`); media show numbers because event 77 `qr_delivery=with_qr` auto-creates QR rows on every invite (emails carry no QR image — directive intact). Manual-add hook now ensures the QR row first and syncs `qr.token` (was `GUEST-{id}`). BUT pushing the 5 corrections failed: his `ticket_number` column rejects our 43-char tokens (`Data too long`, MySQL 1406) — he must widen it (VARCHAR 255 recommended; fits our 20-char TKT refs too), delete the 5 `GUEST-6046..6050` records, then we re-push correct tokens. Fresh `BM_Event77_Guest_Snapshot_2026-09-25-v2.xlsx` (1,562 guests) saved. Backend deployed, API 200. | AI Agent |
| 2026-09-25 | **Vendor's Assistants: 56 imported + 84 QRs sent (28 resends).** `Vendor assistants that didn't get QR codes.xlsx` held 84 real people (rest blank rows). 28 already had QR codes on the dashboard (re-sent the SAME code, no duplicates); 56 imported as `Vendor's Assistant` (amber badge, phones + orgs incl. inferred Chef Adeyz Cooks/delightchops/Teevora) + QRs sent with new duty mail (`VENDOR TEAM` section, pure-insertion verified). New category in dashboard selects/docs. Partner sync of the 56 attempted but ALL rejected by his short `ticket_number` column (same 1406 blocker — awaiting his widen; IDs kept for retry). Backend+frontend rebuilt & deployed (API/web 200). | AI Agent |
| 2026-09-26 | **Partner format switched to full QR URLs + full backfill done.** Co-dev sample showed `ticket_number` must be the full QR URL (`.../qr/{token}`); `partner_sync` now builds it via `qr_ticket_url()` (purchases + manual adds). Test push proved his column IS widened (no more 1406) and revealed he already holds most records (409s). Full backfill (4 slices): 691 newly pushed, 1,539 already there, 0 failed (2 transient 409-confirmed). Also stripped invisible chars/trailing whitespace from 140 dashboard names. He still must delete the 5 stale `GUEST-6046..6050` records. Backend deployed, API 200. | AI Agent |
| 2026-09-26 | **Partner edit-sync live (PUT base + body ticket_number).** Co-dev confirmed updates go to the base URL with `ticket_number` in the body; added `update_partner_guest()` (404 falls back to create, never raises) and hooked `update_guest` (event 77, BackgroundTasks, QR token ensured). Verified live: renamed guest 4452 twice via dashboard API, both PUTs logged `updated`. Live purchase syncs also flowing. | AI Agent |
| 2026-09-27 | **SEO foundation shipped.** Keyword-rich titles/descriptions site-wide ("Event Ticketing Platform & Marketplace in Nigeria"), keywords + canonical + Open Graph/Twitter cards in root layout, upgraded landing metadata, new `/robots.txt` (blocks dashboard/admin/api/accreditation/scanner) + `/sitemap.xml` (static routes + public events, hourly revalidate), JSON-LD Organization/WebSite on landing and Event schema on public event pages (rich-result eligible). Built on server, verified live (robots, sitemap, title). Still open: H1/design copy decision, Search Console + backlinks (owner-side). | AI Agent |
| 2026-09-27 | **Search Console verification file live.** Served Google file googleaa4c2812fd852235.html via nginx exact-match (same pattern as prior a014r3xz file; Next public/ 404s .html so nginx is the path). NOTE: user added wrong property (sitemap.xml URL) - must verify https://accredit.vip/ instead. PowerShell ate \ in heredoc once (nginx -t caught it, site never affected). Verified 200 with exact content. | AI Agent |
| 2026-09-27 | **Buyer trust pack (ticket flows).** Pre-payment confirm modal on events/[id] (paid only: shows name/email/E.164 phone + tickets/total, Edit vs Confirm & Pay); post-payment QR helper modal on /ticket/[ref] (once per session: mail sent to buyer email, spam + info@accredit.vip note); free-event inline message gained the same spam/info line; dashboard guest rows (desktop + mobile) now show Ref: {custom_data.reference} for ticket buyers (already stored at fulfillment). tsc + server build clean, markers verified in live chunks, web 200. | AI Agent |
| 2026-09-27 | **Back button on create chooser.** dashboard/create mode-select screen had no way back; added Back to Dashboard link. Deployed, web 200. | AI Agent |
| 2026-09-27 | **Create page sidebar + header wordmark + report ticket sales.** dashboard/create (chooser + form) now uses shared DashboardSidebar+DashboardTopbar instead of the back button (removed); shared Header now renders logo-text.png wordmark next to the mark (was mark-only; only create page consumes it). Report page gained a Ticket Sales section (orders/tickets/revenue cards + buyer/package/qty/amount/reference/date table from GET /tickets/events/{id}/purchases); removed emoji from ticket-page success modal per no-emoji rule. tsc + server build clean (47 pages); create/report 200, markers in live chunks. | AI Agent |
| 2026-09-27 | **Failed Messages link restored on wallet sidebar.** Wallet builds its own inline sidebar (not the shared one) and was missing the Failed Messages entry, so the link vanished whenever visiting Wallet. Added it (AlertTriangle icon, matching shared sidebar order); failed-messages page already had full parity. Server rebuild clean, web 200. | AI Agent |
| 2026-09-28 | **Ended events stay on /attend.** New past_only flag on GET /events/public (past events date-desc; default upcoming-only unchanged). Attend page gained a Previous events section (ENDED badge, greyed cover, record-only links, no buy) shown when not filtering; events/[id] disables the purchase form with an event-ended notice + Ended hero badge when past. Verified live (3 past events incl. 77). Backend+frontend rebuilt & deployed. | AI Agent |
| 2026-09-28 | **Gate quick-add on scan page (single + excel bulk).** New scanner quick-add (single walk-in, auto-format name/phone/email, accepted + Gate Quick-Add tag, capacity-enforced) and bulk-add (500 per call, blank-skip, in-batch dupe merge keeping shared inboxes separate) endpoints in checkin_scanner.py. Scan Manual Entry gained Search/Quick-add/Bulk tabs (SheetJS in-browser xlsx/csv parse with header variants + preview + optional instant check-in). Verified live incl. cross-event (NBC 71) + dashboard visibility; test guests permanently deleted. NOTE: server npm install broke native Tailwind bindings (npm optional-deps bug) - fixed via npm ci + explicit linux binding installs; all routes 200. | AI Agent |
| 2026-09-28 | **UI batch: 404, chrome, FAQ, copy-ref, UTM.** Branded `not-found.tsx` (guest-list joke + home/discover CTAs, verified live). New shared `SiteChrome` (mounted in root layout): scroll progress bar, back-to-top, skip-to-content link (+ `#main-content` ids on landing/attend), cookie banner (localStorage), floating contact button (-> /contact), UTM capture to localStorage. Expandable FAQ (5 factual Q&As) on pricing. Copy-reference button on ticket page (ShareButton clipboard already existed). UTM stored on TicketPurchase (`utm_source/medium/campaign` columns + ALTER on server, passed from checkout). Also pinned `lightningcss-linux-x64-gnu` + `@tailwindcss/oxide-linux-x64-gnu` in optionalDependencies so server builds never lose native bindings again. tsc + server build clean, all routes 200. | AI Agent |
| 2026-09-28 | **Event page About Read More.** `AboutSection` on `events/[id]`: collapsed `line-clamp-3` + Read more/Show less toggle when description exceeds 220 chars. | AI Agent |
| 2026-09-28 | **Only Black Market stays public.** Set events 49 (Lagos Jazz Festival) + 51 (Tech Summit Africa) `is_public=false` (data/dashboards intact, reversible). Public listing now effectively BM-only. | AI Agent |
| 2026-09-28 | **Wordmark restored on feature pages.** `feature-layout.tsx` header rendered only the shield mark; now shows `logo-text.png` beside it like navbar/sidebar (navbar already had it; shared Header fixed earlier). | AI Agent |
| 2026-09-28 | **Em-dash sweep (no-emoji-adjacent cleanup).** Replaced all 164 spaced em dashes with colons across frontend (34 files) + backend templates (12 files); burial trio explicitly excluded (zero diff verified). tsc + backend compile clean. | AI Agent |
| 2026-09-28 | **AI surfaces removed from UI.** Deleted `app/features/ai-assistance` route + `AIAssistant` chatbot component + home AI card + sitemap entry; stripped Generate-with-AI buttons/prompts/preview branch (dashboard/create), headshot auto-generate radios (create-event), reworded AI copy (flier reading, QR prompt placeholder, preview text). AI functions left as dead code (invisible, compiles); backend AI endpoints untouched. tsc + server build clean. | AI Agent |
| 2026-09-28 | **Admin event controls (caps, registration, visibility, status).** New `GET /admin/events/search` (by id/title) + `PATCH /admin/events/{id}/controls` (guest_count_range validated, registration_open toggle, is_public, status allowlist; audited via log_action) in admin_events.py; new Event Controls card on admin/events page (find + presets/custom cap + toggles + save). Routes verified in live OpenAPI; backend+frontend rebuilt & deployed. Note: 67-by-3pm example was illustrative - no event state changed. | AI Agent |
| 2026-09-28 | **Admin remote-control upgrade.** Support float is now a menu (WhatsApp +2348101143265, Email info@accredit.vip, Contact page; icon kept); contact page number fixed (was placeholder). DB: new `events.rsvp_open` + `events.registration_close_at` (ALTERed) and `announcements` table (auto-created). Enforcement: RSVP POST gated on `rsvp_open`, registration gated on manual toggle AND scheduled close (logic verified: open True / manual False / past-schedule False / future True). Admin API: event search, extended controls PATCH (cap, registration, RSVP, auto-close datetime, visibility, status, ticket price/availability), guest list/add/edit/delete (with categories + org), impersonate-organizer (audited, admins excluded), announcements CRUD. Admin UI: autocomplete event search, full controls editor, guest manager, impersonate button, announcements manager. SiteChrome shows active announcements on dashboard/admin routes. All 8 routes in live OpenAPI; backend+frontend rebuilt & deployed. | AI Agent |
| 2026-09-29 | **Admin mobile layout fixed.** All 8 admin sidebars used desktop-only `ml-64/ml-20` with no mobile handling (fixed sidebar ate phone screens). Now: icon rail (`w-20`) + `ml-20` below lg, auto-collapse via matchMedia effect, toggle hidden on mobile, tables wrapped in `overflow-x-auto` (payments/sessions/users). tsc + server build clean, all routes 200. | AI Agent |
| 2026-09-29 | **Support float hidden on gate/admin tooling.** SiteChrome now suppresses the contact-support bubble/menu and back-to-top on `/accreditation*`, `/admin*`, `/scan*` (progress bar, cookie banner, announcements unaffected). Verified in live bundle; tsc clean. | AI Agent |
| 2026-09-29 | **Admin mobile round 2 (content squeeze).** Event cards stack + meta grid 2-col on phones, search/filter rows wrap, pagination stacks, main padding `p-4 sm:p-6` everywhere, fraud stats grid responsive. (Round 1: icon rail + tables scroll.) tsc + server build clean, admin 200. | AI Agent |
| 2026-09-29 | **Admin mobile round 3 (from user screenshots).** Filters now wrap (was clipping Flagged), event cards + pagination stack, sessions/payments/users pagination stacks, payments header stats hidden on phones, table headers nowrap + tighter cells, settings profile values wrap instead of clipping. tsc + server build clean. | AI Agent |
| 2026-09-29 | **Admin mobile round 4: working drawer + logout confirm + login spacing.** Sidebar now opens as a full overlay drawer via header hamburger on all 8 admin pages (was stuck as icon rail with no way to expand; backdrop closes it). New shared `AdminLogoutButton` with Are-you-sure modal swapped into all 7 direct-logout pages; SessionGuard now sends logged-out admins to `/admin/login` instead of `/login`. Admin login page tightened (smaller logo/gaps). tsc + server build clean. | AI Agent |
| 2026-09-30 | **Event 67 no-QR audit + Outlook diagnosis.** 301 guests, 290 with QR codes; `BM_Event67_No_QR_Guests.xlsx` (Downloads) lists the 11 without (all accepted-but-never-invited manual adds, zero messages). Only 2 Outlook addresses exist, both got QR emails TWICE (9/22 + 9/24, all SMTP-accepted, zero errors) - non-arrival is Microsoft-side junk-filtering, not our sending. WhatsApp legs correctly failed 63016 (outside 24h window). | AI Agent |
| 2026-09-30 | **Admin validation, accreditation search, friendly errors.** Fixed `isNaN(undefined)` bug that wrongly rejected empty ticket price/availability (root cause of the private-event error; the fix had been written but never deployed). Accreditation event dropdown gained a type-to-filter search box. apiClient now distinguishes timeouts ("may have gone through, check before retrying") from dead connections. Public registration now enforces event guest caps with a friendly message ("reached its total guest limit, kindly contact your host"); cap message itself reworded platform-wide. Backend+frontend rebuilt & deployed, markers live. | AI Agent |
| 2026-09-28 | **All-three-tiers admin build.** T1: `POST /admin/events/{id}/mark-paid-publish` (completes pending non-resend payments + publishes, webhook parity), `events.spotlight` column (ALTER, 77 seeded) driving `/attend` + landing marquee instead of hardcoded 77, `POST /scanner/checkin/undo` (deletes check-ins, frees QRs, keeps scan history) with Undo button on scan rows (proven live: approved True > undone > False). T2: `platform_settings` table + pricing editor (admin settings Platform tab, public pricing page reads it), admin invite-message editor, user suspend (`is_active` enforced at login + API, users page buttons, admins immune), sessions page gained Admin-actions audit view. T3: admin event-basics edit (title/venue/city/date/time/description in controls). All routes live, both services rebuilt & healthy, test guests removed. | AI Agent |
