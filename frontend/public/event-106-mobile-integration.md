# Event 106 (OBI's HOUSE) - mobile app integration handoff

## What the app needs to do

Event 106 is a **headcount** event. There is no per-guest QR. One shared QR is printed on every wristband:

**QR payload:** `https://accredit.vip/h/obi`

A scan at the gate counts **one person entering** and the dashboard at `/dashboard/events/106` updates live. The same wristband can be scanned again for the next guest. There are eight nights (event days 26-33, 30 Nov 2026 to 18 Jan 2027).

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
  "token": "https://accredit.vip/h/obi",
  "location": "Main gate",
  "event_day_id": 26
}
```

- `token` is required. It may be the full URL, `/h/obi`, or the bare slug `obi`.
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
```

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

{ "token": "https://accredit.vip/h/obi", "event_day_id": 26 }
```

Deletes the latest scan for that night and returns the updated stats. `{"status":"noop"}` means there was nothing to undo.

### 5. Public wristband info (no auth)

```
GET /api/v1/headcount/event/obi
```

Returns event details and `next_dates`. This endpoint records nothing; scanning a wristband with a guest's own phone opens this informational page and does **not** count.

## Critical: repeat-scan behaviour

The web scanner uses `repeatMode="exit"`: the same code must physically **leave the camera frame** before it can count again. The mobile app must replicate this, otherwise one wristband held still will count dozens of people.

- When a code is decoded, remember it.
- Do not count it again until the scanner has seen no code (or a different code) for at least one frame.
- Show a short "Lift the wristband away between guests" prompt to staff.

## Night handling

Use `event_day_id` from the night picker when one is selected. Otherwise let the server resolve the night. Be aware of the 00:00-06:00 WAT spillover: a scan at 1 AM belongs to the previous night.

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
4. Scan the shared QR once, confirm `status: "counted"` and `night_total` increments by 1.
5. Hold the same QR still: confirm the app does not count it again.
6. Lift it away and scan again: confirm the count increments.
7. Check the web dashboard `/dashboard/events/106/headcount` shows the same number.
8. Undo one scan, confirm both the app and web dashboard decrease by 1.
9. Test a closed night and confirm the app does not increment.
