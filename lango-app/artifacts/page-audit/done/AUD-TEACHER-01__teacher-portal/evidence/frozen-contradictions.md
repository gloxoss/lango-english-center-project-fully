# AUD-TEACHER-01 — Frozen-module contradictions (documented, not fixed)

Frozen modules for this campaign: **Attendance Core (P1–P7: canonical
aggregate, summary, registers, session/year truth, QR canonical path)** and
**Academic domain logic where canonical (timetable generator/solver semantics)**.
Read/test only.

## FC-1 — Attendance sheet shows impossible attendance rates (> 100 %)

**Where:** `/dashboard/attendance` (teacher register) renders the
`Assiduité` column from `attendance_summary.attendance_rate`, a frozen
Attendance Core aggregate.

**Observed (schoolos_audit, 2026-09-24):**

```
SELECT count(*) FROM attendance_summary WHERE attendance_rate > 100;   → 32
SELECT student_id, total_present, total_absent, total_late, total_excused, total_sessions, attendance_rate
FROM attendance_summary WHERE attendance_rate > 100 ORDER BY attendance_rate DESC LIMIT 3;

 student_id | total_present | total_absent | total_late | total_excused | total_sessions | attendance_rate
------------+---------------+--------------+------------+---------------+----------------+-----------------
 STU-0092   |            78 |           -6 |          5 |             3 |             80 |          104.38
 STU-0102   |            78 |           -5 |          4 |             3 |             80 |          103.75
 STU-0025   |            78 |           -5 |          5 |             2 |             80 |          103.13
```

**UI evidence:** `screenshots/baseline-prof07/teacher-fr-attendance.png` (same
in final) shows student rows with `101.88 %`, `100.25 %`, `101.25 %`, `100 %`.

**Root cause (data, not engine):** `attendance_summary.total_absent` is
negative for these rows. The rate formula
`(present + late*0.5 + excused) / total * 100` can only exceed 100 when the
inputs are internally inconsistent. `scripts/seed-full.ts:1728` computes
`totalAbsent: total - present - late - excused` from random draws and can go
negative. The canonical engine and the aggregate are frozen (P1–P7); the
impossible display is a seed-data artifact.

**Disposition:** documented, not fixed. Re-seeding the audit DB with
non-negative absents would clear the display; that is an Attendance-Core data
operation and is out of scope for this campaign.

## FC-2 — Attendance onsite timezone (already confirmed before this campaign)

Pre-existing, confirmed and logged before AUD-TEACHER-01:
`src/app/api/attendance/onsite/route.ts` builds the day window in Node local
time (`+01`) while Postgres evaluates it with `+00` tzdata, shifting the
window at the day boundary. Reproduced again as reachable from the teacher
attendance workflow; **not modified** (Attendance Core frozen). Tracked as a
release-blocker candidate by the orchestrator.
