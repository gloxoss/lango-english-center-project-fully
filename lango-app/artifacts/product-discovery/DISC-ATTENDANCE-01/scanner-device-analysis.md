# Scanner, kiosk and devices — DISC-ATTENDANCE-01

## Camera
- Real: `navigator.mediaDevices.getUserMedia` with front/rear `facingMode` (attendance-scanner-playground.tsx ~393-408); permission-denied and no-camera states handled.
- Decoding: **only the browser's native `BarcodeDetector`** (~419-439). No JS decoder library in package.json. BarcodeDetector is available in Chrome on Android/ChromeOS/macOS; to my knowledge not in Chrome on Windows, Firefox or desktop Safari — there the video shows but no QR is ever read. **Not tested with a physical camera in this campaign** (no browser/camera available to the agent).
- HTTPS: required by browsers for camera outside localhost; not documented in the UI.

## USB ("Douchette USB")
Keyboard-wedge: a focused text input + Enter (lines ~795-822). Works with any HID scanner that types the code and Enter. No WebUSB/WebHID/serial.

## Scan chain (verify-and-stage, 499 lines)
QR text → HMAC hash → badge lookup **within the caller's tenant** (foreign-tenant QR = not found) → status must be active (revoked rejected) → **expiry not checked** → user → class context from scanner session or selected section (required) → branch check → student must belong to that section (WRONG_CLASS) → school-day/session-year check → register LOCKED check → duplicate within session → status present/late computed against **one school-wide start time** (`attendance.periodStartTime`, default 08:00 + grace) → attendance row written for **period 1 unless the caller sends one (the UI never does)** → audit log with before/after → flags detection.

## Devices
Pairing creates a random secret shown once but stored **in plain text** and **never used**: no scan route authenticates a device, and `lastSeenAt` is never updated. The "4 terminaux appairés actifs" are 4 seed rows. The scanner runs as the logged-in admin/teacher.

## Answer to "valid SchoolOS QR to this camera today"
**PARTIALLY.** On Android Chrome with a class selected: yes, a mark is written — but for period 1 and "late" after 08:00+grace regardless of the real lesson. On Windows desktop Chrome: very likely NO (no decoder). With a USB keyboard scanner: yes, same caveats.

## Gate vs classroom
Two different uses exist in code: the guard kiosk (`portals/guard/scanner`, gate access, pickups) and the attendance scanner (classroom marks). They should stay separate; the attendance scanner should derive its class from the current timetable session instead of a manual class pick.

## Test matrix (from code + existing tests; not live-clicked)
| Case | Behaviour |
|---|---|
| valid | accepted, staged present/late |
| revoked | rejected BADGE_REVOKED, logged |
| expired | **accepted** (gap) |
| foreign tenant | not found |
| wrong branch | 403, logged |
| wrong class / not enrolled | 422 WRONG_CLASS, logged |
| duplicate in session | returns earlier result, no second mark |
| repeat after delay (new session) | updates the same mark (idempotent per student/date/period/section) |
| malformed | not found |
| manual matricule | searches /api/students then posts /api/attendance — bypasses the credential entirely |
| concurrent | idempotencyKey supported; not load-tested |
