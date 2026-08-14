# Section 25: Subject curriculum metadata + protected deletion

## Overview
`classSubjects` today has type (compulsory/elective) and semester scope but nothing else. Adds planning fields (weekly minutes, display order, coefficient, pass threshold, active status, curriculum label) and replaces destructive deletion with a real 409 IN_USE check against assessments/teacher assignments/electives/timetable slots.

## Risk: [green] - additive columns + a read-before-delete guard, no new tables, independent of the offerings work

## Dependencies
- Depends on: none
- Blocks: section-26
- Parallel batch: 2

## TDD Test Stubs
- Test: DELETE on a classSubject referenced by assessmentPlans/subjectTeachers/classScheduleSlots/electiveGroups returns 409 IN_USE, not a hard delete
- Test: DELETE on an unreferenced classSubject still works (archive is preferred but not forced when nothing depends on it)
- Test: new fields default sensibly for existing rows (weeklyMinutes null, displayOrder 0, coefficient 1, isActive true)

## Tasks

<task type="auto" id="25-01">
  <name>Add curriculum metadata columns to classSubjects</name>
  <files>src/models/Schema.ts, migrations/00XX_add_class_subject_curriculum_metadata.sql (new), migrations/meta/_journal.json</files>
  <action>
    Add nullable columns to classSubjects: weeklyMinutes (integer), displayOrder (integer, default 0), coefficient (numeric(4,2), default 1), passThreshold (numeric(5,2), nullable), isActive (boolean, default true), curriculumLabel (varchar(100), nullable). All nullable-or-defaulted so no backfill logic is needed beyond the column defaults themselves.
  </action>
  <verify>docker compose build migrate; run it; confirm existing rows get the defaults</verify>
  <done>Columns added, existing data intact with sensible defaults</done>
</task>

<task type="auto" id="25-02">
  <name>Extend the class-subjects route: new fields + protected delete</name>
  <files>src/app/api/academics/class-subjects/route.ts</files>
  <action>
    PUT/POST accept the new optional fields. DELETE: before deleting, check for references in assessmentPlans (via classSubjectId), subjectTeachers (classSubjectId), classScheduleSlots (classSubjectId), electiveGroups/electiveChoices if they reference classSubjectId - if any exist, return 409 IN_USE with a count breakdown instead of deleting; if genuinely unreferenced, proceed with delete as today (or set isActive=false if the caller prefers archive - keep both paths, archive is the recommended one per the ADR).
  </action>
  <verify>manual test: try deleting a classSubject with a real assessment plan attached (expect 409), then one with nothing attached (expect success)</verify>
  <done>No classSubject with real dependents can ever be silently deleted</done>
</task>
