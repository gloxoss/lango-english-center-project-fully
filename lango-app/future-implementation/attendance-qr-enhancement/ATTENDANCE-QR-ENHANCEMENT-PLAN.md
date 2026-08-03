# Attendance QR Enhancement — Future Implementation Plan

Status: planned; product choices below are provisional until the owner answers the open questions.

## Outcome

Add fast QR-assisted attendance without weakening the current register workflow. A scan supplies evidence and stages a status; the teacher still reviews, submits, and locks the register. Employee clock-in/out uses the same badge-verification foundation but remains a separate Workforce/Payroll add-on and ledger.

## Current app compared with the reference

The app already has stronger academic attendance foundations than the reference screenshot: class rosters, statuses, summaries, excuses, flags, register submission, locking, and reopening. It also has a camera modal with `BarcodeDetector`, rear-camera selection, torch support, and manual fallback.

The important gap is trust. The current QR handler accepts a student ID or even a partial name and changes local state directly. It has no revocable credential, server verification, scanner session, immutable scan evidence, tenant/class validation, or replay protection. The reference adds visible employee/student lists and in/out controls, but it does not demonstrate those security controls.

## Provisional product decisions

1. V1 supports teacher phones/tablets and optional fixed kiosks scanning individual badges.
2. Student scans stage `present` or `late`; they never submit or lock a register.
3. Unscanned students are not automatically marked absent.
4. Student QR belongs to core Attendance, not the add-on registry.
5. Employee QR timekeeping is a distinct Payroll/Workforce add-on because punches, shifts, corrections, and payroll audits are not academic attendance.
6. V1 is online-first. Offline scanning and rotating self-scan codes are later phases.

## Required pages and journeys

### Core Attendance

- Register → **Scan QR**: camera, current class/section/subject/date, live accepted/rejected feed, counters, sound/vibration, undo for the latest staged action, and manual exact-person fallback.
- Register review: distinguish manual changes from QR-staged changes before submit/lock.
- Attendance → **QR sessions**: session owner, device, register, duration, accepted/rejected/duplicate counts, and close state.
- People → **Attendance badge**: issue, preview/print, revoke, replace, expiry, and credential history.
- Attendance → Reports → **QR audit**: filters for date, class, person, device, operator, outcome, and rejection reason; CSV/PDF export.
- Settings → **Scanner devices**: pair, name, scope to branch, disable, and last-seen status.

### Workforce/Payroll add-on

- Time clock kiosk with explicit **In** and **Out** modes.
- Live employee punch list and current on-site state.
- Work-session review, missing-punch exceptions, correction request/approval, location/device reports, and payroll-period export.

## Security and data model

Never encode a database ID, name, email, matricule, employee number, role, or tenant in the QR. Generate at least 128 bits of cryptographically secure randomness. Store only a keyed digest/HMAC of the token and compare safely on the server.

Add these shared entities:

- `identityBadgeCredentials`: tenant, user, subject type, token digest, display prefix, state (`active`, `revoked`, `expired`, `replaced`), issue/expiry/revocation dates, issuer, replacement link.
- `identityBadgeEvents`: issue, print, revoke, replace, failed-use, actor, time, reason.
- `scannerDevices`: tenant/branch scope, pairing state, label, capabilities, disabled date, last seen.
- `scannerSessions`: device, operator, register, start/end time, state, configuration snapshot.
- `attendanceScanEvents`: immutable accepted/rejected evidence, credential, session, register, device, reason, timestamps, idempotency key.
- `attendanceScanApplications`: link from evidence to the staged and finally submitted attendance record.

Use separate workforce entities: `workforceClockLocations`, `workforcePunchEvents`, `workforceWorkSessions`, `workforceExceptions`, and `workforceCorrections`. Never reuse academic attendance rows for payroll.

## Verification pipeline

1. Authenticate the operator and active scanner session.
2. Decode locally, then send only the opaque token over HTTPS.
3. Resolve the token digest inside the authenticated tenant.
4. Validate credential state, expiry, user role, active enrollment/employment, and branch.
5. Validate operator permission, device scope, scanner session, class roster, register state, and date/time policy.
6. Apply idempotency and duplicate-window rules server-side.
7. Write an immutable accepted or rejected scan event.
8. Return the exact person, photo, display name, staged status, and a safe reason code.
9. Stage the roster change. Existing submit/lock/reopen logic remains authoritative.

No endpoint may use partial-name matching. Manual fallback must search and require an exact selected roster member. A repeated scan must not toggle attendance; it returns `already_scanned`. Scanning a locked register records `register_locked` without mutating it.

## Status rules

- Before the configured grace threshold: propose `present`.
- After the threshold: propose `late`, with teacher override and reason.
- Excused, remote, or custom statuses require existing permissions/policies.
- A reopened register retains previous scan evidence and records new applications as a new revision.
- Static badges are copyable, so accepted feedback must show the person’s photo/name for human verification. Facial recognition is explicitly out of scope.

## Camera and resilience strategy

Keep native `BarcodeDetector` as the fast path. Lazy-load a proven decoder fallback for unsupported browsers. Recommended candidates are ZXing Browser or `qr-scanner`; verify the exact package version and license before adoption. Use `node-qrcode` for generation/printing if its output and accessibility tests pass.

V1 should fail honestly when offline and offer exact manual selection. A later offline phase may use an encrypted, short-lived, register-specific roster cache plus a signed/hash-chained queue; queued scans must preserve device time and server receipt time and require conflict review.

## API surface

- `POST /api/attendance/qr/scanner-sessions`
- `POST /api/attendance/qr/verify-and-stage`
- `GET /api/attendance/qr/scanner-sessions/:id/events`
- `POST /api/attendance/qr/scanner-sessions/:id/close`
- `GET|POST|PATCH /api/identity-badges`
- `POST /api/identity-badges/:id/revoke`
- `POST /api/identity-badges/:id/replace`
- `POST /api/identity-badges/bulk-issue`
- `POST /api/scanner-devices/pair`
- `PATCH /api/scanner-devices/:id`
- `GET /api/attendance/qr/reports`

Every mutation requires tenant-scoped authorization, validation, rate limiting, audit metadata, and a stable idempotency key.

## Delivery phases

### Phase A — Harden the existing scanner

- Remove raw-ID/partial-name mutation behavior.
- Add exact roster selection, explicit camera states, permissions guidance, decoder fallback, and accessible feedback.
- Keep all changes staged until normal register submission.

### Phase B — Secure badge lifecycle

- Add credential/event tables, issuing, printable badges, revoke/replace/expiry, bulk issuance, and role permissions.
- Integrate with future ID Card Management without making that add-on mandatory.

### Phase C — Trusted scanning

- Add devices, sessions, server verification, immutable events, idempotency, duplicate protection, class/register checks, and live scan feed.

### Phase D — Operations and reporting

- Add session/device/audit pages, anomaly flags, exports, retention controls, and dashboards for scan success, rejection reasons, late arrival, and manual override rate.

### Phase E — Workforce/Payroll add-on

- Add in/out punches, location/device policies, work-session calculation, missed-punch handling, correction approval, overtime policy hooks, and payroll export.

### Phase F — Optional advanced modes

- Offline queue, rotating register QR for supervised self-scan, geofencing where legally appropriate, notifications, and risk scoring. Each remains feature-flagged and tenant configurable.

## Validation and acceptance

- Cross-tenant, cross-branch, wrong-class, inactive-user, revoked/replaced/expired badge, locked-register, duplicate, replay, and concurrent-scan tests.
- Verify the QR payload and logs disclose no personal or internal identifiers.
- Test Chrome/Edge/Firefox/Safari, Android/iOS cameras, denied permissions, no rear camera, low light, damaged print, fallback decoder, and keyboard-only manual flow.
- Ensure scan → stage → submit → lock → reopen preserves a complete evidence chain.
- Confirm employee badges cannot enter student registers and student badges cannot create payroll punches.
- Load-test arrival bursts and define latency/error SLOs before rollout.

## Open decisions for the owner

These can be answered later without invalidating the plan:

1. Are badges scanned only by staff/kiosks, or may students self-scan a rotating classroom code?
2. Should accepted student scans apply instantly to a draft register or enter a teacher approval queue?
3. Which campuses need fixed kiosks, and who may pair/disable devices?
4. What lateness grace periods and override rules differ by program?
5. Is offline scanning required for V1?
6. What badge expiry/reissue policy and audit-retention period are required?
7. Should the Workforce/Payroll add-on be included in the first release or planned independently?

## Open-source references

- ZXing Browser: cross-browser camera/image decoding — https://github.com/zxing-js/browser
- qr-scanner: lightweight browser scanner with native fast path and worker fallback — https://github.com/nimiq/qr-scanner
- node-qrcode: QR generation for web/server badge output — https://github.com/soldair/node-qrcode

These are implementation references, not authorization to copy UI or adopt dependencies without license, security, maintenance, and bundle-size review.
