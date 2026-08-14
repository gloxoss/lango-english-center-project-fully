# Section 03: Classes — cycle, enrollment cap, homeroom teacher, home room

## Overview
Implements the PRD's "Class setup upgrades" Must Have. Reuses the already-real `classTeachers` join table (role `primary`) for homeroom teacher instead of adding a duplicate FK — the research pass confirmed this table already models exactly this concept, just needs a real enforcement path and a real UI. Adds `cycle` and `maxStudents` to classes/class-sections, and a new `homeRoomId` FK reusing the already-real `rooms` table.

## Risk: yellow - homeroom-teacher uniqueness needs an application-level guard
The DB-level partial unique index on `classTeachers` only protects uniqueness when `offeringId` is set, which isn't the common case yet. This section adds an explicit check-then-write inside a transaction (same TOCTOU pattern already used in the admission-approval flow) so two active primary teachers on one class-section can't coexist in practice, even though the DB constraint alone wouldn't catch every case.

## Dependencies
- **Depends on:** section-01 (schema foundation)
- **Blocks:** none
- **Parallel batch:** 2

## TDD Test Stubs
- Test: Creating a class with `cycle: 'college'` persists and is returned correctly by GET.
- Test: Setting `maxStudents: 30` on a section currently enrolling 32 real students surfaces an over-capacity indicator instead of crashing or hiding the data.
- Test: Assigning a homeroom teacher to a section that already has one replaces the old assignment (old `classTeachers` row gets `endsOn` set, new one inserted) rather than creating two simultaneous primaries.
- Test: Assigning a `homeRoomId` that belongs to another tenant's `rooms` table is rejected with a clear reference error.
- Test: Removing a homeroom teacher assignment leaves the section teacher-less without error, and a subsequent assignment works normally.

## Tasks

<task type="auto" id="03-01">
  <name>Add cycle field to classes route</name>
  <files>src/app/api/academics/classes/route.ts</files>
  <action>
    Read the existing file. Extend the POST/PUT Zod `.strict()` schemas to accept an optional `cycle` enum matching the new `class_cycle` type (`maternelle|primaire|college|lycee`). Include `cycle` in the GET response mapping and in the insert/update calls.
  </action>
  <verify>POST a class with `cycle: 'lycee'` returns 201 with the field set; GET returns it on the list.</verify>
  <done>Classes can be created/edited/read with a real cycle field.</done>
</task>

<task type="auto" id="03-02">
  <name>Add maxStudents and homeRoomId to class-sections route</name>
  <files>src/app/api/academics/class-sections/route.ts</files>
  <action>
    Read the existing file. Extend POST/PUT Zod schemas to accept optional `maxStudents` (positive integer) and `homeRoomId` (uuid), validating `homeRoomId` belongs to the same tenant's `rooms` table when provided (reuse the existing `assertSameTenantReferences()` helper pattern already used for `mediumId`/`shiftId`/`streamId`). Extend GET to return both fields plus a real `enrolledCount` computed via a `count(*)` on `user` where `classSectionId` matches and `role = 'student'`.
  </action>
  <verify>POST a section with `maxStudents: 30` and a real `homeRoomId` succeeds; POST with a `homeRoomId` from another tenant returns a 422 reference error. GET shows `enrolledCount` matching a manual count of real students in that section.</verify>
  <done>Class sections support a real enrollment cap and a real home-base room, both tenant-validated, with a real live enrolled-count on read.</done>
</task>

<task type="auto" id="03-03">
  <name>Build homeroom-teacher assignment endpoint</name>
  <files>src/app/api/academics/class-sections/[id]/homeroom-teacher/route.ts</files>
  <action>
    New file. PUT handler, role `school_admin`, cap `academics.manage`, body `{teacherId}` via Zod `.strict()`. Inside a `db.transaction`: validate the section and teacher belong to the tenant; query for an existing `classTeachers` row with this `classSectionId`, `role='primary'`, `endsOn IS NULL`; if found, set its `endsOn` to now; insert a new `classTeachers` row with `role='primary'`, `startsOn: now`, the new `teacherId`. Add a DELETE handler that just sets `endsOn` on the current active primary row, if any, without inserting a replacement. Call `recordAudit()` on both paths.
  </action>
  <verify>PUT twice with two different teacherIds leaves exactly one active (`endsOn IS NULL`, `role='primary'`) row for that section, queried directly via psql. DELETE with no active primary is a no-op, not an error.</verify>
  <done>A class section's homeroom teacher can be set/replaced/cleared for real via classTeachers, with a transactional guard against two simultaneous active primaries.</done>
</task>

<task type="auto" id="03-04">
  <name>Wire cycle, capacity, homeroom teacher, and home room into Classes UI</name>
  <files>src/features/academics/ui/classes-client.tsx</files>
  <action>
    Read the existing file in full. Add a real cycle select (Maternelle/Primaire/Collège/Lycée) to the create/edit form, wired to task 03-01. On each section row/card, add a real enrolled/max display (e.g. "24/30") sourced from task 03-02's `enrolledCount`/`maxStudents`, a homeroom-teacher dropdown (list of real teachers from the existing teachers endpoint) wired to task 03-03, and a home-room dropdown (list of real rooms from `/api/academics/rooms`) wired to task 03-02's `homeRoomId` field. Do not reintroduce "Cycles & Niveaux" or "Modèles d'enseignement" as separate tabs — cycle is a field on the existing class form, not a new navigation concept, per the discovery decision to drop "teaching models" as a Mediums duplicate.
  </action>
  <verify>In the browser: create a class with a real cycle, add a section with a real capacity and home room, assign a real homeroom teacher, reload the page, confirm every value persisted correctly and the enrolled/max count matches the section's real roster.</verify>
  <done>The Classes page shows and edits real cycle, capacity, homeroom teacher, and home-base room for every class/section, with no fabricated tabs or bars.</done>
</task>
