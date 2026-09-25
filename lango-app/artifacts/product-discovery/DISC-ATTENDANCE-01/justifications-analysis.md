# Absence justifications — DISC-ATTENDANCE-01

## Lifecycle as implemented (/api/attendance/excuses)
| Step | Exists | Where |
|---|---|---|
| Parent/student/teacher/admin submits | yes (POST roles admin, teacher, student, parent) | route.ts:179 |
| Guardian identity + child relationship | yes (getGuardianChildIds) | route.ts:10 |
| Scope: section, period, session year, date | yes (migrations 0150/0153) | table |
| Supporting document | yes (documentUrl + upload route .../excuses/[excuseId]/document) | — |
| Admin reviews approve/reject (school_admin only) | yes, rejection reason stored, reviewer + time stored | route.ts:271+ |
| Attendance mark rewritten to "excused" | yes, audit-logged before/after | route.ts:~371-384 |
| Matching alert resolved | yes (resolveUnjustifiedAbsenceFlagsForDate) | — |
| Student totals recalculated | yes (recalculateStudentAttendanceSummary) | route.ts:390 |
| Parent notified of decision | **no** | — |
| Duplicate submissions | not verified |
| Medical document privacy | document route guarded per role; retention not defined |

## Answer: Absence justifications: REAL (except parent notification).

## UX recommendation (for review)
Admin page: primary action "Enregistrer une justification reçue" (paper/phone), plus the review queue. Parent portal keeps "Soumettre une justification". Add a decision notification to the parent (SMS/in-app via the existing communication service).
