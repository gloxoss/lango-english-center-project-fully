# UltraPlan Master Implementation Plan — Attendance QR Enhancement

Status: COMPLETED & READY FOR EXECUTION  
Scope: Academic Attendance QR Staging, Identity Badges, Scanner Sessions, Audit Reports & Workforce Timekeeping Kiosk  

---

## 📌 Section Specifications

### Section 01: Database Schema & Badges Credentials (`Section 01`)
- **Scope**: Drizzle schema and PostgreSQL migration adding `identityBadgeCredentials`, `scannerDevices`, `scannerSessions`, `attendanceScanEvents`, and `workforcePunchEvents`.
- **Key Files**: `src/models/Schema.ts`, `drizzle/0061_attendance_qr_enhancements.sql`
- **Tasks**:
  - `<task id="01-01">`: Define Drizzle tables for badge credentials, HMAC hashes, scanner devices, and scan events in `Schema.ts`.
  - `<task id="01-02">`: Generate and execute PostgreSQL migration `0061_attendance_qr_enhancements.sql`.

### Section 02: Badge Management & Printable Issuance (`Section 02`)
- **Scope**: Admin console & APIs to issue, preview, print, revoke, and replace QR student & staff badges.
- **Key Files**: `src/app/api/identity-badges/route.ts`, `src/features/attendance/ui/badge-management-view.tsx`
- **Tasks**:
  - `<task id="02-01">`: Create `POST /api/identity-badges` API supporting 128-bit random token generation and HMAC-SHA256 hashing.
  - `<task id="02-02">`: Create printable badge renderer component with `node-qrcode` output and student photo card.

### Section 03: Trusted Scanner Camera & Staging UI (`Section 03`)
- **Scope**: Camera scanner modal refactoring with native `BarcodeDetector`, fallback decoder, sound/vibration feedback, live scan feed, and exact manual selection fallback.
- **Key Files**: `src/features/attendance/ui/qr-scanner-modal.tsx`, `src/components/shared/barcode-camera.tsx`
- **Tasks**:
  - `<task id="03-01">`: Refactor `QrScannerModal` to display live accepted/rejected scan feed, student photo verification, and manual roster fallback.
  - `<task id="03-02">`: Implement audio/vibration feedback triggers on scan success/failure.

### Section 04: QR Verification & Idempotent Pipeline (`Section 04`)
- **Scope**: Production API route `POST /api/attendance/qr/verify-and-stage` verifying HMAC tokens, checking session validity, roster membership, and staging `present`/`late` status on draft registers.
- **Key Files**: `src/app/api/attendance/qr/verify-and-stage/route.ts`, `src/features/attendance/services/qr-verification-service.ts`
- **Tasks**:
  - `<task id="04-01">`: Build `QrVerificationService` with HMAC hash lookup, role validation, and idempotency locks.
  - `<task id="04-02">`: Implement API route handler with audit event recording in `attendanceScanEvents`.

### Section 05: QR Audit Reports & Scanner Device Pairing (`Section 05`)
- **Scope**: Admin dashboard for pairing scanner devices, tracking active scan sessions, viewing scan rejection reasons, and exporting CSV/PDF audit reports.
- **Key Files**: `src/app/[locale]/(dashboard)/dashboard/attendance/qr-reports/page.tsx`, `src/features/attendance/ui/qr-reports-view.tsx`
- **Tasks**:
  - `<task id="05-01">`: Build QR audit report table with filters for date, class, device, operator, and rejection reason.
  - `<task id="05-02">`: Add Scanner Device Pairing management interface.

### Section 06: Workforce Time Clock Kiosk (`Section 06`)
- **Scope**: Dedicated time clock kiosk for staff and employee In/Out punches linked to payroll work sessions.
- **Key Files**: `src/app/[locale]/(dashboard)/dashboard/workforce/timeclock/page.tsx`, `src/features/workforce/ui/time-clock-kiosk.tsx`
- **Tasks**:
  - `<task id="06-01">`: Build Time Clock Kiosk UI with mode toggle (Check In / Check Out) and live employee punch log.
  - `<task id="06-02">`: Implement `POST /api/workforce/punches` API enforcing employee badge verification.
