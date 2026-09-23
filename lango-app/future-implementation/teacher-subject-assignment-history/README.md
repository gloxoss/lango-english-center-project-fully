# Backlog — Teacher Subject Assignment History Migration

**Status:** Deferred (deliberately not implemented during the Teacher Directory hardening pass — parallel Student-Directory work was in flight and the change is a schema migration).
**Owner area:** Classes & Niveaux / Academic Assignments convergence.
**Trigger:** `subject_teachers` cannot represent history, so a delete is the only way to remove an assignment and destroys the only record of who taught what.

## Problem

`subject_teachers` (`src/models/Schema.ts`) currently has:

```
id, tenant_id, class_section_id, subject_id, class_subject_id, teacher_id, offering_id, created_at
```

It lacks:

- `session_year_id` (academic-year scoping is implicit through `offering_id` only, which is nullable)
- `status` (active / closed)
- `ends_on` (assignment end date)

Consequences:

1. Reassignment is delete + recreate (`POST`/`DELETE /api/academics/subject-teachers`), so the previous teacher's assignment row disappears.
2. There is no way to "close" an assignment while preserving it.
3. Grade authorization (`src/features/assessment/services/marksheet-access.ts`) and teacher scope (`src/libs/api/teacher-scope.ts`) read a row as *current*; removing the row silently revokes historical context.

## Interim mitigation (shipped)

`src/libs/services/subject-teacher-assignment.ts` guards the destructive case:

- deleting one of several teachers for the same `(class_section, class_subject)` pair is allowed (context survives);
- deleting the **last** teacher for the pair is allowed only when there is no usage evidence (no `class_schedule_slots` row, no authored `assessment_definitions`, no recorded `assessment_outcomes`);
- otherwise the API returns `409 SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED` and nothing is deleted.

Deactivation/archival of a teacher also no longer deletes `subject_teachers` rows.

## Required migration (when convergence starts)

1. Add `session_year_id` (backfilled from `class_subjects.offering_id` → `academic_class_offerings.session_year_id` where available; otherwise the default session year), `status` (`active`/`closed`), `ends_on` to `subject_teachers`.
2. Backfill existing rows as `status='active', ends_on=null`.
3. Replace delete+recreate with: close (set `status='closed', ends_on=today`) + insert new active row.
4. Update read paths (`teacher-scope`, `marksheet-access`, directory current-assignment projection) to require `status='active' AND (ends_on IS NULL OR ends_on >= today)`.
5. Update the removal guard to permit closing instead of blocking, and migrate the API `DELETE` to close-or-delete-clean.
6. Add regression tests: reassignment preserves the closed row and historical grade/attendance context; ended subject assignments stop granting grade access.

## Acceptance for closing this backlog item

- No `DELETE` path can erase the only row for a `(section, class-subject)` pair that has teaching evidence.
- Directory/detail can show current vs historical subject assignments.
- Existing 409 `SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED` guard is removed because the destructive case no longer exists.
