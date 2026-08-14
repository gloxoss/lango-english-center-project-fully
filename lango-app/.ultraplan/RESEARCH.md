# UltraPlan Technical Research — Attendance QR Enhancement

## 1. Security Architecture & HMAC Token Hashing
- **Token Generation**: 16-byte (128-bit) cryptographically secure random bytes generated via `crypto.getRandomValues()` or Node `crypto.randomBytes()`.
- **Server Storage**: Tokens are stored as HMAC-SHA256 digests in `identityBadgeCredentials.tokenHash`. Raw tokens are never stored in plaintext in the database.
- **Verification Protocol**:
  1. Client sends decoded raw token over HTTPS to `POST /api/attendance/qr/verify-and-stage`.
  2. Server computes `HMAC_SHA256(rawToken, SECRET)` and queries `identityBadgeCredentials`.
  3. Validates badge state (`active`), expiry date, tenant ID, branch, and student enrollment status.

## 2. Browser Camera & Decoding Libraries
- **Primary Decoder**: Web API `BarcodeDetector` (native hardware-accelerated fast path supported in Chromium/Android/iOS Safari).
- **Secondary Decoder Fallback**: `qr-scanner` or `zxing-js/browser` lazy-loaded when native `BarcodeDetector` is unavailable.
- **QR Code Generator**: `node-qrcode` (`qrcode.toDataURL()`) for rendering high-resolution printable student and staff badges.

## 3. Relational Database Schema (`Schema.ts`)
- `identityBadgeCredentials`: `id`, `tenantId`, `userId`, `subjectType` (student/staff), `tokenHash`, `displayPrefix`, `status` (`active`, `revoked`, `expired`, `replaced`), `expiresAt`, `issuedAt`, `revokedAt`.
- `scannerDevices`: `id`, `tenantId`, `branchId`, `deviceLabel`, `pairedAt`, `lastSeenAt`, `isDisabled`.
- `scannerSessions`: `id`, `tenantId`, `deviceId`, `operatorId`, `startedAt`, `endedAt`, `status`.
- `attendanceScanEvents`: `id`, `tenantId`, `sessionId`, `credentialId`, `studentId`, `resultStatus` (`accepted`, `rejected`, `duplicate`), `rejectionReason`, `scannedAt`, `idempotencyKey`.
- `workforcePunchEvents`: `id`, `tenantId`, `employeeId`, `punchType` (`in`, `out`), `scannedAt`, `deviceId`, `locationId`.
