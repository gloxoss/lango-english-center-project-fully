# Timetable ↔ attendance — DISC-ATTENDANCE-01

## What the timetable stores
Canonical: `class_schedule_slots` (written by /api/academics/timetable-slots and the generator).
- Has: class section, class subject (→ subject), teacher, weekday, start/end as "HH:MM" text, room as free text (`roomLabel`, not the rooms registry), offering, version (→ timetable_versions with session year, status, effectiveFrom/To).
- Branch: indirect via class_sections → classes.branchId.
- Missing: any concrete date, cancellations, substitutions, room changes, joint groups, holidays per slot.
- 60 slots, 1 version in the dev DB.

Legacy: `timetable_slots` (student group, no subject, no section, no version) — still read by the teacher portal (/api/teacher/me/timetable, /api/teacher/me/home). Admin edits and teacher views can therefore disagree.

## What attendance references
`attendance` and `attendance_registers` store section + subject + **period number** + date. There is **no column linking a mark to a timetable slot**. The entry screen offers a hardcoded "Période 1…8" list. The QR scanner always stages `period = 1` (verify-and-stage defaults it; the scanner UI never sends it).

**Answer: Attendance → manually chosen class/subject/period. Not → scheduled session.**

## Feasibility of timetable-driven attendance (not implemented)
Feasible, because weekday + start/end + section + subject + teacher already exist on the canonical slot. Needed:
1. A "session of the day" = slot × date (computed, or materialised as `class_sessions` rows per date so cancellations/substitutions have somewhere to live).
2. `attendance_registers.sessionRef` (slot id + date) instead of the free period number; keep `period` for legacy rows.
3. Only the published version effective on that date counts.
4. Teacher portal moved from legacy `timetable_slots` to `class_schedule_slots`.
5. Casablanca time source (settings `localization.timezone` already exists).

Date rules proposed for review: past = view-only, today = entry, future = preview. Historical edits through an explicit "Corriger le registre" with reason — partly exists already: registers have REOPENED status, reopenReason, correctionNote, and marks are audit-logged with before/after (verify-and-stage.ts ~421-428, attendance route).
