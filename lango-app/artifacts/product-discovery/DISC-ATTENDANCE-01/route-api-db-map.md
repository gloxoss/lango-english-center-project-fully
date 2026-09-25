# Route / API / DB map — DISC-ATTENDANCE-01

Traced from code on 2026-09-25 (branch student-directory-hardening, working tree). Paths relative to `lango-app/`.

## Screens

| Menu label | Route | Page guard (server) | Menu permission (sidebar.tsx:461-468) | Component | APIs called |
|---|---|---|---|---|---|
| Saisie des Présences | /dashboard/attendance | attendance.read | attendance.read | features/attendance/ui/attendance-client.tsx (1 312 lines) | GET /api/academics/class-sections, /api/academics/class-subjects, /api/students?classSectionId=, GET+POST /api/attendance, GET /api/attendance/registers, POST /api/attendance/registers/reopen, GET /api/attendance/summary, GET /api/auth/me |
| Badges QR | /dashboard/attendance/badges | **attendance.manage** | **attendance.read** (mismatch) | badge-management-view.tsx | /api/identity-badges (GET/POST), /bulk-issue, /[id], /[id]/replace, /api/students, /api/users |
| Audit & Rapports QR | /dashboard/attendance/qr-reports | attendance.read | attendance.read | qr-reports-view.tsx | GET /api/attendance/qr/events (filters + CSV/PDF export), /api/academics/class-sections |
| Scanner Kiosque QR | /dashboard/attendance/scanner | attendance.manage | attendance.manage | attendance-scanner-playground.tsx (1 097 lines) | POST /api/attendance/qr/scanner-sessions, /[id]/close, POST /api/attendance/qr/verify-and-stage, GET /api/attendance/onsite, GET /api/students?search=, POST /api/attendance (manual fallback) |
| Pointeuse Employés | /dashboard/workforce/timeclock | **payroll.review** (+ addon payroll-workforce) | **attendance.read** (mismatch) | features/workforce/ui/time-clock-kiosk.tsx | GET+POST /api/workforce/punches |
| Justificatif d'absence | /dashboard/attendance/excuses | **attendance.manage** | **attendance.read** (mismatch) | attendance-excuses-view.tsx | GET/POST/PATCH /api/attendance/excuses, /api/students |
| Signalements | /dashboard/attendance/flags (+ /[id]) | **attendance.manage** | **attendance.read** (mismatch) | attendance-flags-view.tsx, attendance-flag-detail-view.tsx | /api/attendance/flags, /flags/detail, /flags/notes, POST /api/communication/messages, /api/users?role=teacher |
| Audit & Alertes | /dashboard/attendance/audit | attendance.read | attendance.read | attendance-audit-view.tsx | GET+POST /api/attendance/audit-summary |
| (Settings) Dispositifs de Scan | /dashboard/settings/scanner-devices | settings.attendance.manage | settings.attendance.manage | scanner-devices-view.tsx | /api/scanner-devices, /pair, /[id] |
| (Guard) Scanner | /dashboard/portals/guard/scanner | role guard + guard.portal.use | guard.portal.use | features/guard/ui/guard-kiosk-shell.tsx | /api/guard/* (gate, not classroom) |
| (Parent) Présence | /dashboard/parent/attendance | role parent | — | features/parent/ui/AttendanceView.tsx | /api/guardian/me/children/[relationshipId]/attendance, excuses |
| (Settings) Présences | /dashboard/settings/attendance | settings.attendance.manage | — | ComingSoonView (placeholder) | none |

## Tables (actual columns)

| Table | Key columns | Notes |
|---|---|---|
| attendance | studentId, classSectionId, subjectId, **period (int)**, academicYearId, date, status, lateMinutes, markedById, isVoided, voidReason, registerId, scanEventId | **No timetable/session id** |
| attendance_registers | classSectionId, sessionYearId, subjectId, date, period, reference, status (OPEN/LOCKED/REOPENED), submittedAt/By, reopenedAt/By, reopenReason, correctionNote | Keyed on section+date+period(+subject) |
| attendance_excuses | studentId, classSectionId, period, sessionYearId, date, reason, documentUrl, documentFileExt, status, reviewedById/At, rejectionReason | |
| attendance_flags | studentId, type, status (OPEN/RESOLVED), severity, assignedToId, detectedAt, resolvedAt | + attendance_flag_notes |
| attendance_summary | studentId, academicYearId, totalPresent/Absent/Late/Excused, totalSessions, attendanceRate | Cache; seeded rows are fabricated |
| attendance_scan_events | sessionId, credentialId, studentId, resultStatus, rejectionReason, idempotencyKey, scannedAt, classSectionId, registerId, stagedStatus, attendanceRecordId | |
| identity_badge_credentials | userId, subjectType (student/staff/visitor), **tokenHash** (HMAC-SHA256), displayPrefix, status, issuedAt, **expiresAt**, revokedAt, issuerId, replacementId | Raw token never stored |
| scanner_devices | deviceLabel, branchId, pairedAt, lastSeenAt, isDisabled, **secretKey (plain text)** | Not used by any scan path |
| scanner_sessions | deviceId, operatorId, classSectionId, startedAt, endedAt, status | |
| workforce_punch_events | employeeId, credentialId, punchType (in/out), scannedAt, deviceId, notes | |
| class_schedule_slots (**canonical timetable**) | classSectionId, classSubjectId, teacherId, dayOfWeek, startTime/endTime (varchar HH:MM), roomLabel (free text), offeringId, versionId | Weekly recurrence only; no date, cancellation or substitution |
| timetable_versions | sessionYearId, status, versionNumber, effectiveFrom/To, published* | |
| timetable_slots (**legacy**) | studentGroupId, dayOfWeek, startTime, endTime, teacherId, roomId | No subject, no section, no version. Still read by /api/teacher/me/timetable and /api/teacher/me/home |

## Dependencies observed
Class sections, class subjects, users (student/teacher/staff), guardians + guardian_students (excuses, flag contacts), session_years (calendar guard), settings registry keys `attendance.lateGraceMinutes`, `attendance.periodStartTime`, `attendance.smsAlerts`, `localization.timezone`, SMS service `features/broadcast/services/sms-delivery` (audit reminder, absence alerts), branch via classes.branchId / user.branchId.
