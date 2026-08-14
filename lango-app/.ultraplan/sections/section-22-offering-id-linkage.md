# Section 22: offeringId on classSubjects/classTeachers/subjectTeachers/classScheduleSlots

## Overview
Adds a nullable `offeringId` column to the four tables that currently only know about `classSectionId`, and backfills it from Section 21's offerings. Purely additive: no existing route is touched, no existing query changes. This is what makes Section 24 (teacher roles scoped per-offering) and future session-aware routes possible without a breaking migration.

## Risk: [yellow] - touches 4 tables in one migration, but strictly additive (nullable column, no reads change)

## Dependencies
- Depends on: section-21
- Blocks: section-23, section-24
- Parallel batch: 1

## TDD Test Stubs
- Test: backfill sets offeringId correctly for every existing row (join classSectionId -> the offering created for that tenant's default session)
- Test: existing routes (class-subjects, class-teachers, subject-teachers, timetable-slots) are completely unaffected - full regression pass, not just a diff review
- Test: a row with no matching offering (edge case: classSectionId not covered by Section 21's backfill) leaves offeringId NULL, does not error

## Tasks

<task type="auto" id="22-01">
  <name>Add offeringId columns to Schema.ts</name>
  <files>src/models/Schema.ts</files>
  <action>
    Add a nullable `offeringId: uuid('offering_id')` column with a foreign key to `academicClassOfferings.id` (onDelete 'set null' - an archived/removed offering should never cascade-delete real subject/teacher/schedule data) to: classSubjects, classTeachers, subjectTeachers, classScheduleSlots. Re-check Schema.ts's dirty state at execution time; use the isolated-git-blob technique if the other session has unrelated changes in this file.
  </action>
  <verify>docker compose build migrate; drizzle-kit check passes</verify>
  <done>All 4 tables have the new nullable offeringId column with correct FK behavior</done>
</task>

<task type="auto" id="22-02">
  <name>Write the migration + backfill</name>
  <files>migrations/00XX_add_offering_id_linkage.sql (new, next available number), migrations/meta/_journal.json</files>
  <action>
    ALTER TABLE ADD COLUMN offering_id (nullable) on all 4 tables with the FK. Then 4 UPDATE...FROM statements: for each table, set offering_id by joining its class_section_id to academic_class_offerings.section_id/class_id combination for that tenant (via class_sections -> class_id/section_id -> matching academic_class_offerings row). Rows with no matching offering are left NULL, not errored.
  </action>
  <verify>docker compose build migrate; docker compose run --rm migrate; spot-check a few rows per table to confirm offering_id resolves to the correct session</verify>
  <done>Migration applies cleanly, backfill populates offeringId wherever a matching offering exists</done>
</task>

<task type="auto" id="22-03">
  <name>Regression-verify existing routes are unaffected</name>
  <files>(read-only verification, no files changed)</files>
  <action>
    tsc --noEmit; then exercise class-subjects, class-teachers, subject-teachers, and timetable-slots routes (GET/POST/PUT/DELETE) against a real tenant exactly as before this section - confirm identical behavior and response shape (the new column is additive and not yet selected/returned by these routes, so this should be a pure no-op check).
  </action>
  <verify>All 4 routes behave identically to before this section; no shape change in any response</verify>
  <done>Zero behavior change confirmed in the 4 existing routes touched by this migration</done>
</task>
