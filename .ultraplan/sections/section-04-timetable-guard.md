# Section 04: Timetable double-booking guard

## Overview
The canonical timetable is `class_schedule_slots` (tenantId, classSectionId, classSubjectId, teacherId, dayOfWeek, startTime/endTime as 'HH:MM' text, roomLabel free text, versionId) — written by `/api/academics/timetable-slots` despite its name. `timetable_slots` is a legacy table (still read by the teacher portal, see DISC-ATTENDANCE-01) and is NOT the target here. There is no rule against a teacher (or the same class section) being booked twice at overlapping times in the same version. Fix it with a database exclusion constraint (holds under concurrency, zero app logic) and map its error to a readable 409. No separate app-level check: the constraint is the check.

## Risk: [red] The constraint will not apply if live data already overlaps. 04-01 first; stop if it finds overlaps.

## Dependencies
- Depends on: 01 · Blocks: 13 · Batch 2 · Hub item: `task:up-04-timetable-guard`

## Tasks

<task type="auto" id="04-01">
  <name>Check live data for overlaps (read-only SQL, no new file)</name>
  <files>none</files>
  <action>
    Slots are versioned (version_id): overlaps only count within the same version.
    Run one self-join query on schoolos and schoolos_audit: same tenant, same dayOfWeek, overlapping [startTime,endTime), and same version_id and same teacher_id or same class_section_id. Post counts via hub say. If any overlaps exist: STOP, report them, ask the owner how to resolve.
  </action>
  <verify>Query and counts pasted in the hub.</verify>
  <done>Live data known to be clean.</done>
</task>

<task type="auto" id="04-02">
  <name>Exclusion constraints + readable error</name>
  <files>lango-app/migrations/0161_timetable_no_overlap.sql, lango-app/migrations/meta/_journal.json, lango-app/src/libs/api/errors.ts</files>
  <action>
    Migration: CREATE EXTENSION IF NOT EXISTS btree_gist; two EXCLUDE USING gist constraints on class_schedule_slots:
    (tenant_id, version_id, day_of_week, teacher_id WITH =, time range WITH &&) and the same with class_section_id instead of teacher_id. start/end are 'HH:MM' varchar: range = int4range(split_part(start_time,':',1)::int*60 + split_part(start_time,':',2)::int, <same for end_time>, '[)'). Room is free text (roomLabel): no room constraint — flag it to the owner instead.
    Register in _journal.json (PLAN.md rule 9).
    errors.ts: next to the existing 23514 branch, map 23P01 to 409 { code: 'SCHEDULE_CONFLICT', message: 'Créneau déjà occupé : ce professeur ou cette classe a déjà un cours à cette heure.' }.
  </action>
  <verify>db:migrate on schoolos_audit succeeds. One new test on schoolos_audit: two overlapping POSTs for the same teacher (run concurrently with Promise.all) → exactly one 200/201 and one 409 SCHEDULE_CONFLICT; back-to-back 08:00–09:00 / 09:00–10:00 both succeed. tsc 0.</verify>
  <done>Double-booking impossible, even concurrently, with a clear message.</done>
</task>
