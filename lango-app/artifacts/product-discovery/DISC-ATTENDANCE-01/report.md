# DISC-ATTENDANCE-01 — PRODUCT DISCOVERY COMPLETE

Method: code traced end to end, read-only queries on the dev database (`evidence/db-truth.txt`), existing automated tests run on the test database (`evidence/tests.txt`: 15 files, 113–114/114 pass; the one intermittent failure is a test flaw). **Not done:** clicking through a browser, a physical camera or USB scanner, mobile and Arabic RTL checks — no browser/camera was available. Those are marked "not verified".

## CURRENT STATE SUMMARY

| Area | Verdict |
|---|---|
| Attendance entry | **REAL** (manual class / subject / "Période 1–8") |
| Timetable-driven | **NO** — marks store a period number; no link to timetable sessions |
| Teacher auto-current-session | **NO** — teachers get the admin form |
| Badge QR | **real credential** (random token, hash stored), shown on a separate page from Cards |
| QR reports | **REAL** data, but not branch/teacher-scoped |
| Camera QR scanning | **PARTIAL** — real camera; decoding only through the browser's built-in detector (likely none on Windows desktop Chrome); not physically tested |
| USB scanner | **WORKS** as a keyboard-type scanner (same caveats as QR: period 1, fixed start time) |
| Device pairing | **MOCK in effect** — devices are listed but never authenticate or report in |
| Employee pointeuse | **PARTIAL** — real API; seeded data with one identical timestamp; no rules; not used by payroll |
| Absence justifications | **REAL** (no parent notification) |
| Signalements | **PARTIAL** — real detector; the alerts on screen are random seed rows |
| Audit & Alerts | **PARTIAL** — real reminder SMS; rate from fabricated data; wrong "missing register" rule |

## TOP BUSINESS PROBLEMS
1. Attendance is not tied to the timetable: staff pick class, subject and "Période N" by hand.
2. Every QR scan is recorded as "Période 1" and judged late against one 08:00 start for the whole day.
3. Expired badges are still accepted by the scanner (and by the staff time clock).
4. The attendance rate on the audit page reads made-up seed numbers (up to 104.38 %, negative absences).
5. "Registres manquants" lists lessons that have not happened yet and hides missing periods once any period is marked.
6. QR scan reports show every class and campus to any teacher or campus-limited admin.
7. Scanner "terminals" are decorative: no device security behind them.
8. Teachers' own timetable screen reads an old table, so it can differ from the school's real timetable.
9. The staff time clock accepts any sequence of in/out, has no permission check, and does not feed payroll.
10. Four menu entries open a "no access" page for roles that see them.

## RECOMMENDED PRODUCT MODEL
- **Admin:** "Appel du jour" lists today's real lessons (time, subject, class, teacher, room, status). Past = read-only with an explicit "Corriger le registre" (reason kept); future = preview.
- **Teacher:** opens straight onto the lesson they are teaching now and only marks students; if none, "Vous n'avez aucun cours en ce moment."
- **Student credential:** the student (matricule) is the identity; the QR is a credential printed on the student card — issue, replace, revoke, expire in one place.
- **Kiosk:** a paired device tied to a campus and room/gate; it knows the current lesson from the timetable. Gate arrival and classroom attendance stay separate.
- **Employee:** staff clock-in/out lives in HR; the system decides in or out; HR corrects with a reason; payroll uses it later.
- **Parent:** sees marks, submits a justification, is notified of the decision.

## KEEP / MERGE / REMOVE / REDESIGN
| Page | Decision |
|---|---|
| Saisie des Présences | REDESIGN (timetable-driven, role-specific) |
| Badges QR | MERGE into Cards & Convocations ("Cartes & badges") |
| Audit & Rapports QR | KEEP (scope by campus/teacher, hide technical columns) |
| Scanner Kiosque QR | REDESIGN (context from device + timetable) |
| Pointeuse Employés | MOVE to HR/Workforce + REDESIGN rules |
| Justificatifs | KEEP (admin "enregistrer une justification reçue"; parent submits) |
| Signalements | KEEP + REDESIGN lifecycle |
| Audit & Alertes | MERGE with Signalements into "Suivi & alertes" (missing registers + reminders + alerts) |
| Settings › Dispositifs de scan | REDESIGN only if fixed kiosks are adopted, else REMOVE |

## FINDINGS
See `security-findings.md` (17 items). P0: expired badges accepted; QR reports unscoped; punches without permission check. P1: devices unauthenticated; no timetable link / period 1 / single start time; wrong missing-register rule; fabricated summary; teacher portal on legacy timetable; punches without rules; manual matricule bypasses the credential. P2: menu/permission mismatches; camera decoding limited; no parent notification; hardcoded alert thresholds. P3: "Chiffrement" wording; badge reissue not atomic; report timezone.

## PROPOSED IMPLEMENTATION CAMPAIGNS
See `implementation-options.md`: IMPL-ATT-0 safety fixes (no product change) → 1 timetable "Appel du jour" → 2 teacher current session → 6/7 alerts + justifications → 4 cards merge → 3 session exceptions → 5 kiosk context → 8 pointeuse to HR. None started.

## LOCAL LINKS
See `manual-review-links.md` (8 links with what to inspect).

READY FOR HUMAN PRODUCT REVIEW: YES
IMPLEMENTATION STARTED: NO
