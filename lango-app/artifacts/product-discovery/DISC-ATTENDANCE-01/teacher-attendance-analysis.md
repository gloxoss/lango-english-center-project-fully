# Teacher attendance — DISC-ATTENDANCE-01

## Current
- Teachers use the same screen as admins (attendance-client.tsx). The only role difference in the UI is `isAdmin` for reopening registers (line 441).
- The class list comes from /api/academics/class-sections; the API enforces scope on write: /api/attendance refuses sections the teacher does not teach (route.ts:82-83, 201; `getTeacherClassSectionIds`; covered by attendance-teacher-scope tests, passing).
- No "current session" logic, no Casablanca clock lookup, no "Vous n'avez aucun cours en ce moment".
- The teacher's own timetable screen reads the legacy `timetable_slots`, not the canonical schedule.

## Answer: Teacher auto-current-session: NO.

## Situations to decide (recommended rule → trade-off)
| Situation | Recommended rule | Trade-off |
|---|---|---|
| Class starts in ≤ 5 min | Allow opening the register 5 min early | Earlier = marks before students arrive |
| Teacher late | Entry open for the whole slot | Late teacher still marks everyone present-at-that-time |
| Shortly after class | Grace window after end (e.g. 15 min), then admin-only correction | Longer = fewer "missing" registers, weaker proof |
| Substitute teacher | Substitute sees the session only if a substitution is recorded — needs a new table | Without it, admin must mark |
| Cancelled class | Session excluded from "expected" and from missing registers — needs cancellation storage | — |
| Room change | Display only; attendance is per section, not room | — |
| Timetable change mid-year | Use the version effective on the date | Needs version selection by date (effectiveFrom/To exist) |
| Overlapping slots (data error) | Show both, flag to admin | Prevent at source with a DB rule (planned section S04) |
| Joint groups | One session per section; teacher sees both | — |
| Register already submitted | View-only; "Demander une correction" | — |
| Connectivity loss | Keep unsent marks in the page and retry; server is idempotent per (student, date, session) | Offline storage adds complexity |
