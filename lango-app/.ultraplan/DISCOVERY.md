# UltraPlan Discovery — Attendance QR Enhancement

## Project Scope & Objectives
Enhance the existing academic attendance register system with cryptographically secure, trusted QR-assisted scanning for student attendance staging and employee timekeeping.

## Key Principles & Invariants
1. **No Raw PII in QR Tokens**: QR payloads contain zero database IDs, names, emails, or matricules. Tokens are 128-bit cryptographically secure random strings hashed with HMAC SHA-256 on the server.
2. **Staged Attendance Evidence**: Student QR scans stage `present` or `late` status on a draft register; they never automatically submit or lock an academic register.
3. **Teacher Verification & Audit Trail**: Teachers review staged scan entries with student photo verification before submitting and locking the register.
4. **Workforce/Payroll Isolation**: Employee QR timekeeping (In/Out punches) is isolated in a separate workforce ledger and never pollutes student academic registers.

## Target Modules & Subsystems
- **Core Attendance QR Staging**: Camera scanner modal with `BarcodeDetector` + `qr-scanner` fallback, device selection, torch control, live accepted/rejected feed, sound effects, and exact manual selection fallback.
- **Identity Badge Credentials (`identityBadgeCredentials`)**: Token issuance, printable badge templates, revocation, expiration, and replacement links.
- **Trusted Scanner Devices & Sessions (`scannerDevices`, `scannerSessions`)**: Device pairing, branch scoping, session heartbeat, and operator authentication.
- **Immutable Audit Logs (`attendanceScanEvents`)**: Replay-protected scan evidence capturing timestamp, device ID, session ID, result status, and rejection reason code.
- **Workforce Time Clock Kiosk**: Dedicated In/Out punch interface for staff timekeeping linked to payroll.
