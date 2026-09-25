# Security & data-integrity findings — DISC-ATTENDANCE-01

No code was changed. Priorities: P0 data/security, P1 business correctness, P2 UX/product, P3 polish.

| # | Pri | Finding | Evidence |
|---|---|---|---|
| 1 | P0 | Expired badges are accepted by the QR scan (expiresAt never checked); 220 of 221 badges carry an expiry date | verify-and-stage/route.ts (0 refs to expiresAt); db-truth |
| 2 | P0 | QR reports are not branch- or teacher-scoped: a teacher or a campus-limited admin sees every scan event of the school | libs/attendance/qr-events.ts (no branchId / teacher filter) |
| 3 | P0 | POST /api/workforce/punches has no capability check (admin, teacher, receptionist sessions can punch any staff badge); expiry not checked | workforce/punches/route.ts:48-60 |
| 4 | P1 | Scanner device secret stored in plain text and never used; devices do not authenticate; "last seen" never updated — device trust is cosmetic | scanner-devices/pair/route.ts:36-53 |
| 5 | P1 | Attendance has no link to timetable sessions; QR scans always record period 1; lateness is judged against one school-wide start time | timetable-attendance-analysis.md |
| 6 | P1 | "Registres manquants" counts future/ongoing sessions and treats a section as done once any period is marked; ignores timetable version; uses UTC date | audit-summary/route.ts:24-103 |
| 7 | P1 | attendance_summary contents are fabricated seed data (32 > 100 %, 51 negative absences, 200/200 inconsistent) and feed the audit KPIs | evidence/db-truth.txt |
| 8 | P1 | Teacher portal reads legacy timetable_slots while admins edit class_schedule_slots | teacher/me/timetable, teacher/me/home |
| 9 | P1 | Punches: no in/out state machine; not used by payroll | employee-pointeuse-analysis.md |
| 10 | P1 | Manual matricule fallback in the scanner bypasses the credential entirely (searches students, then posts a mark) | scanner playground ~463-500 |
| 11 | P2 | Menu shows 4 pages the role cannot open (badges, excuses, flags need attendance.manage; time clock needs payroll.review) | sidebar.tsx:461-468 vs page guards |
| 12 | P2 | Camera decoding relies only on native BarcodeDetector — likely non-functional on Windows desktop Chrome, Firefox, desktop Safari (not physically tested) | scanner playground ~419-439 |
| 13 | P2 | Parent is not notified when a justification is decided | excuses/route.ts |
| 14 | P2 | Alert thresholds hardcoded; lifecycle only OPEN/RESOLVED | attendance-flags.ts |
| 15 | P3 | "HMAC-SHA256 Chiffrement Actif" is wrong (HMAC is not encryption) and too technical for school staff | badges page |
| 16 | P3 | Badge revoke + insert not in one transaction (two actives possible under a race) | badge-service.ts |
| 17 | P3 | QR report times shown in the browser's timezone, not Africa/Casablanca | qr-reports-view.tsx:395 |

## Verified safe
Tenant isolation of badge lookup (hash + tenantId), revoked badges refused, wrong class/branch refused and logged, locked registers refused, duplicate scans de-duplicated, teacher write-scope on /api/attendance, guardian ↔ child check on justifications, every mark change audit-logged with before/after. Existing tests: 15 files / 114 tests pass on schoolos_audit (evidence/tests.txt).

## Not verified in this campaign
Physical camera/USB behaviour, mobile layout, Arabic RTL on these screens, medical-document retention, duplicate justification submissions, CSV/PDF export row parity against a live filtered query.
