# Event 106 (OBI's HOUSE) - mobile app integration handoff

## What the app needs to do

Event 106 is a **headcount** event. It now issues **5,000 unique wristband QRs**, each with its own random 8-character alphanumeric code (no ambiguous 0/O/1/I):

**QR payload:** `https://accredit.vip/h/obi?c=<CODE>`

A scan at the gate counts **one person entering** and the dashboard at `/dashboard/events/106` updates live. **Each code can be counted once only**; a second presentation is refused with `already_used`. There are eight nights (event days 26-33, 30 Nov 2026 to 18 Jan 2027).

The full code list is available as `https://accredit.vip/uploads/obi/obi-unique-codes.csv` (columns: `code`, `qr_url`, `qr_image`) and as `obi-unique-codes.json`. Each QR image is at `https://accredit.vip/uploads/obi/codes/<CODE>.png`.

## Base URL

```
https://accredit.vip/api/v1
```

All requests and responses are JSON. Send `Authorization: Bearer <token>` on every authenticated call. Use only `Content-Type` and `Authorization` headers (the server's CORS allow-list contains no custom headers).

## Authentication

### Gate staff login

```
POST /api/v1/scanner/accreditation-login
Content-Type: application/json

{ "email": "<gate account email>", "password": "<password supplied separately>" }
```

Response:

```json
{
  "access_token": "<JWT>",
  "user": { "id": 47, "email": "accreditation@accredit.vip", "full_name": "..." }
}
```

The token is valid for **7 days**. Store it securely and refresh by logging in again. The endpoint does not set a cookie; the app must send the Bearer header.

Validate the token with `GET /api/v1/auth/me` (same header). A 401 means log in again.

> The gate credentials are deliberately not written in this document. Ask the organiser for them separately.

## Endpoints

### 1. Confirm the event and get the nights

```
GET /api/v1/scanner/events
GET /api/v1/scanner/events/106/days
```

The event list item has `headcount_mode: true` and `day_count`. The days response contains the eight `event_days` rows with `id`, `date`, `label`, `name`, `start_time`, `accreditation_open`, `is_active` and `is_today`.

### 2. Record a scan (the main call)

```
POST /api/v1/headcount/scan
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "https://accredit.vip/h/obi?c=B3E4XG2Q",
  "location": "Main gate",
  "event_day_id": 26
}
```

- `token` is required. Send the **exact scanned value including the `?c=` code**. The `c` value is parsed by the server; if it is missing, the scan follows the old repeatable shared-wristband behaviour.
- `location` is optional; it defaults to `Main gate`.
- `event_day_id` (26-33) is optional. If omitted, the server uses tonight in WAT; between 00:00 and 06:00 WAT it attributes the scan to the previous night.

Success response (HTTP 200):

```json
{
  "status": "counted",
  "message": "Entry recorded",
  "scan_id": 1234,
  "scanned_at": "2026-11-30T18:05:12.345678+00:00",
  "night_total": 27,
  "total": 27,
  "code": "B3E4XG2Q",
  "day": { "id": 26, "label": "Opening Night", "date": "2026-11-30" },
  "event": { "id": 106, "title": "OBI's HOUSE", "slug": "obi" }
}
```

Only `status == "counted"` means a person was added. Other valid responses that must **not** increment the app's counter:

```json
{ "status": "no_day_today", "message": "...", "day": null, "days": [...] }
{ "status": "day_closed",   "message": "...", "day": {...} }
{ "status": "invalid_day",  "message": "...", "day": null }
{ "status": "event_ended",  "message": "'OBI's HOUSE' has already ended." }
{ "status": "invalid_code", "message": "Wristband code XXXXXXXX is not recognised.", "code": "XXXXXXXX" }
{ "status": "already_used", "message": "Wristband code XXXXXXXX was already used at the gate.", "code": "XXXXXXXX", "used_at": "..." }
```

`invalid_code` and `already_used` are checked **before** the night guard and never write a scan. Show a clear red result to staff and do not increment the app's own counter.

### 3. Live totals (for the app's dashboard screen)

```
GET /api/v1/scanner/events/106/headcount?event_day_id=26
```

Returns the same stats payload the web dashboard uses: `night_total`, `today_total`, `total`, `hourly`, `gates`, `recent` scans with `scanned_at`, `last_scan_at`, and `days` with per-night counts.

### 4. Undo a mistaken scan

```
POST /api/v1/scanner/headcount/undo
Authorization: Bearer <token>
Content-Type: application/json

{ "token": "https://accredit.vip/h/obi?c=B3E4XG2Q", "event_day_id": 26 }
```

Deletes the latest scan for that night, **frees that wristband code so it can be used again**, and returns the updated stats. `{"status":"noop"}` means there was nothing to undo. **Admin-only (role `admin` or `super_admin`).** Non-admins receive HTTP 403; the Undo buttons are hidden from gate staff and organizers. The organizer-equivalent endpoint `POST /headcount/events/106/undo` is also admin-only.

### 5. Public wristband info (no auth)

```
GET /api/v1/headcount/event/obi
```

Returns event details and `next_dates`. This endpoint records nothing; scanning a wristband with a guest's own phone opens this informational page and does **not** count.

## Critical: code handling

Each wristband carries a **unique code** and admits one person. The server enforces this: the second scan returns `already_used` and does not increment the count. **Nothing is counted on a scan alone.** The app must show the scanned code and two buttons, **Check-In** and **Cancel**, and only call `POST /headcount/scan` when staff press Check-In. This applies to all gate scans, not just headcount. The app must also avoid hammering the endpoint with the same still frame:

- Remember the last decoded code; do not send it again until the scanner has seen no code (or a different code) for at least one frame.
- Keep the web scanner's `exit` behaviour in mind: a code must physically leave the frame before the next presentation.
- On `already_used`, show a red "Wristband already used" result and the `used_at` time. Do not count it.
- On `invalid_code`, show a red "Unrecognised wristband" result. Do not count it.
- Only `status: "counted"` increments the app's own counter.

## Night handling

**Only one night is active at a time.** Night 1 opens on its date (30 Nov 2026); each following night opens 24 hours after the previous night's date, and the earlier night closes. A scheduled job keeps the database flags in sync, and the gate only offers the active night. Use `event_day_id` from the night picker when one is selected. Otherwise let the server resolve the night. Be aware of the 00:00-06:00 WAT spillover: a scan at 1 AM belongs to the previous night.

## Organizer-only endpoints (not for gate staff)

These require the organizer login (user `obi@accredit.vip`) or an admin session, not the gate token:

```
GET  /api/v1/headcount/events/106
POST /api/v1/headcount/events/106/undo
GET  /api/v1/headcount/events/106/export.csv
GET  /api/v1/headcount/events/106/qr.png?size=1200
```

## Network notes

- Use `https://accredit.vip/...` as the host. The API is proxied by nginx; the backend port is not public.
- **Native app:** no `Origin` header is sent, so CORS is not a problem.
- **Browser-based/cordova app:** the origin must be added to the server's CORS allow-list before it can call the API. Ask the platform team.
- Only `Content-Type` and `Authorization` headers are allowed; do not add custom headers such as `X-API-Key`.
- Rate limits do not currently apply to headcount or scanner endpoints.

## Testing checklist

1. Log in, call `/auth/me`, confirm 200.
2. Get `/scanner/events`, confirm event 106 has `headcount_mode: true`.
3. Get the days list and confirm 8 nights.
4. Scan a unique wristband QR: confirm the app shows the code with Check-In / Cancel and the count has **not** changed. Press Cancel, confirm still unchanged. Scan again and press Check-In, confirm `status: "counted"`, `code` in the response, and `night_total` increments by 1.
5. Scan the same QR again: confirm `status: "already_used"` and that the count does not change.
6. Scan a QR with an unknown code: confirm `status: "invalid_code"` and no count.
7. Lift it away and scan a different wristband: confirm the count increments.
8. Check the web dashboard `/dashboard/events/106/headcount` shows the same number and the code in the recent scans.
9. Undo one scan, confirm both the app and web dashboard decrease by 1, and that code can be scanned again.
10. Export `GET /headcount/events/106/export.csv` and confirm the "Wristband code" column.
11. Test a closed night and confirm the app does not increment.
