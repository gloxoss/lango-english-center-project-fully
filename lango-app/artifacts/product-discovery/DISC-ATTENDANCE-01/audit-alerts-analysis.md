# Audit & Alertes page — DISC-ATTENDANCE-01

Source: src/app/api/attendance/audit-summary/route.ts (read in full).

| KPI | Computation | Verdict |
|---|---|---|
| Taux global | average of `attendance_summary.attendanceRate` (unweighted average of per-student rates) | **Wrong data**: the seeded summary rows are fabricated (32 rows > 100 %, max 104.38 %; 51 rows with negative absences; all 200 disagree with real marks). Also an unweighted mean of rates. |
| Élèves à risque | count of summary rows with rate < 80 | same fabricated source |
| Alertes ouvertes par type | attendance_flags OPEN grouped by type, branch-scoped | real query, seeded rows |
| Registres manquants aujourd'hui | all class_schedule_slots for today's weekday whose section has **no mark at all today** | **Wrong rule** — see tests below |
| Envoyer un rappel | real SMS through sendSmsMessage to the slot teacher's phone; message says "mode simulation" when no provider | honest |

## Missing-register rule vs the required tests
| Test | Current result |
|---|---|
| future session today | **counted missing** (no end-time check) |
| ongoing session | **counted missing** |
| finished session, no marks | missing ✓ |
| section has one period marked | **all its slots count as done** (check is per section, not per slot) |
| cancelled session | no cancellation data → counted |
| holiday inside the session year | counted (only the session-year range is checked) |
| substitute teacher | slot teacher only |
| branch filter | classes.branchId ✓ |
| timetable version | **not filtered** — draft/old versions' slots would count |
| date | `new Date().toISOString()` = UTC date, not Casablanca |

## >100 % root cause
Not the app formula (libs/api/attendance-aggregate.ts: (present+late+excused)/recorded, bounded, NULL when 0). It is `seed-full.ts` ~1745: total fixed at 80, present 70–78 + late 0–5 + excused 0–3 can exceed 80; rate formula there also differs (late × 0.5). The cache is only rewritten when a student gets a new mark, so seeded rows persist.
Remediation: recompute all summaries from marks (existing `recalculateStudentAttendanceSummary`) and stop the seed writing summaries directly.

## Distinct purpose?
Partly duplicates the dashboard (rate) and Signalements (open alerts). Its unique value is "registres manquants" + reminders. Recommend: keep as "Suivi des registres" (missing registers + reminders), drop the duplicated KPIs.

## Answer: Audit & Alerts: PARTIAL.
