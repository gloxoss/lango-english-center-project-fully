# Section 24: Class-teacher roles + history

## Overview
`classTeachers` today is timeless and allows several equal teachers with no distinction. Adds a role (primary/assistant/support), effective date range, status, and a reassignment command that closes the old record and opens the new one atomically instead of delete-and-recreate - matching the exact pattern `recordStudentPlacement` already established this session.

## Risk: [yellow] - schema change + a new atomic-reassignment service, moderate complexity

## Dependencies
- Depends on: section-22
- Blocks: section-26
- Parallel batch: 2

## TDD Test Stubs
- Test: only one active ('primary', endsOn null) teacher per offering is allowed - a second primary assignment is rejected unless it's an explicit reassignment
- Test: reassignment closes the old record (sets endsOn) and creates the new one in the same transaction - no window where both or neither exist
- Test: assistant/support roles have no uniqueness constraint, multiple allowed per offering
- Test: workload indicator (existing teacher.workloadHours-style aggregate) is visible before confirming a new assignment

## Tasks

<task type="auto" id="24-01">
  <name>Add role/history columns to classTeachers</name>
  <files>src/models/Schema.ts, migrations/00XX_add_class_teacher_roles.sql (new), migrations/meta/_journal.json</files>
  <action>
    Add a new pgEnum `classTeacherRole` ('primary', 'assistant', 'support'). Add columns to classTeachers: role (default 'primary', matching today's implicit behavior), startsOn (date, default current_date), endsOn (date, nullable), status (reuse existing `status` enum), assignedBy (text, fk user, nullable), notes (text, nullable). Add a partial unique index: one (tenantId, offeringId) with role='primary' AND endsOn IS NULL. Backfill: every existing row gets role='primary', startsOn=createdAt's date, status='active'. Isolated-git-blob technique for Schema.ts if dirty at execution time.
  </action>
  <verify>docker compose build migrate; run it; confirm the partial unique index rejects a second concurrent primary via a manual duplicate-insert attempt</verify>
  <done>Schema + migration applied, partial uniqueness enforced at the DB level (not just app-level)</done>
</task>

<task type="auto" id="24-02">
  <name>Build the reassignment service + extend the class-teachers route</name>
  <files>src/libs/services/class-teacher-assignment.ts (new), src/app/api/academics/class-teachers/route.ts</files>
  <action>
    `reassignClassTeacher({tenantId, offeringId, teacherId, role, assignedBy, notes})`: in one transaction, close any existing active row of the same role for that offering (endsOn = today, status = 'inactive'), then insert the new row. Same advisory-lock-per-(tenantId, offeringId, role) pattern as recordStudentPlacement, for the same reason (concurrent reassignment safety). Extend the existing class-teachers route: POST now accepts role (default 'primary'), calls this service instead of a raw insert; add a GET ?offeringId= filter; keep the existing classSectionId-based behavior fully working for any caller that hasn't moved to offeringId yet.
  </action>
  <verify>manual round-trip: assign a primary, reassign, confirm exactly one active primary at any time; assign two assistants, confirm both stay active simultaneously</verify>
  <done>Reassignment is atomic and race-safe; existing classSectionId-based callers unaffected</done>
</task>
