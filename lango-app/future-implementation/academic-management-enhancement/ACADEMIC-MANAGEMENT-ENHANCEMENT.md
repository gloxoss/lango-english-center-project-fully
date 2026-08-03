# Academic Management Enhancement Plan

Status: planned core enhancement, not an addon  
Compared against: RamomSchool Academic menu screenshots supplied on 2026-08-01  
Scope: classes and sections, class teachers, subjects and class assignment, class/teacher schedules, and student promotion

## 1. Executive conclusion

Lango already has every top-level capability visible in the reference product. This is not a missing-module build. It is a hardening and workflow-completion project.

The strongest existing areas are the tenant-scoped class/section/subject model, class-subject assignment, teacher assignment, real timetable storage, and conflict reporting. The largest weakness is promotion: the current implementation performs an atomic batch move, but only changes `user.classSectionId`. It does not preserve a student's academic placement history, session-year transition, decision, or rollback record.

The timetable is also operational but immature. It has CRUD, copy, and a conflict report, yet no version/effective-period model, draft/publish lifecycle, teacher-specific page, or server-side prevention/override workflow for conflicts.

This work must stay in the core Academic module. The existing database comments explicitly identify the older `academicYears`/`courses`/`studentGroups`/`timetableSlots` chain as dead LMS boilerplate. New work must extend the active ESchool-aligned tables instead.

## 2. Reference-to-Lango comparison

| Reference feature | Lango today | Assessment | Enhancement needed |
|---|---|---|---|
| Control Classes | Real `classes`, `sections`, and `classSections` tables; full class CRUD; separate sections page; medium, shift, and stream support | Lango is broader than the reference | Consolidated class setup workspace, capacity/status/order, current session context, dependency-safe archive |
| Assign Class Teacher | Real `classTeachers` table, API, and `class-section-teachers` page | Feature parity, but assignment is timeless and allows several equal teachers | Add primary/assistant role, effective session/date range, uniqueness policy, history, teacher workload visibility |
| Subject | Real subject CRUD with code, medium, and theory/practical type | Lango is at least equivalent | Add active/archive state, curriculum metadata, ordering, optional workload defaults |
| Class Assign | Real `classSubjects` table and CRUD with compulsory/elective and semester scope | Stronger than the reference's apparent basic assignment | Make assignments session-aware; add weekly-hours/coefficient/order; bulk copy and validation; protect used assignments |
| Subject teacher assignment | Separate real `subjectTeachers` model and API, although not shown in the reference menu | Lango has an extra useful layer | Expose a clear UI and enforce that timetable teachers come from valid subject-teacher assignments |
| Class Schedule | Real weekly `classScheduleSlots`, CRUD UI, copy endpoint, and conflict report | Functional foundation | Add draft/published versions, effective dates, structured rooms, inline preflight, edit/move UI, printing/export |
| Teacher Schedule | No dedicated teacher schedule page; current API can return all slots or a class section only | Main visible parity gap | Add teacher filter/API and dedicated admin + self-service teacher timetable derived from published class slots |
| Promotion | Real selection UI and atomic API that moves selected students | Superficial parity only; academically lossy | Introduce session-aware placement history, decisions, preview, capacity checks, idempotent batches, rollback and audit |

## 3. Current architecture that must be preserved

The active model is:

`sessionYears -> classes -> classSections -> students`

`subjects -> classSubjects -> subjectTeachers -> classScheduleSlots`

`classSections -> classTeachers`

Important current strengths:

- Every active academic record is tenant scoped.
- Cross-tenant references are checked by the APIs.
- `classSubjects` prevents duplicate class/subject/semester assignments at the application layer.
- `subjectTeachers` validates that the selected subject is actually assigned to the section's class.
- Timetable conflict reporting detects overlapping teacher, room-label, and class-section bookings.
- Promotion updates are transactional and can operate on a selected subset of a roster.
- Existing audit calls record mutations.

Do not build new features on the deprecated `academicYears`, `academicTerms`, `programs`, `courses`, `studentGroups`, `enrollments`, `timetableSlots`, or old `rooms` chain without a separate migration decision. Those tables describe a disconnected LMS model and are not the source of truth for this app.

## 4. Confirmed gaps and risks

### 4.1 Academic structure is not session-aware enough

`sessionYears` exists, but `classes`, `classSections`, `classSubjects`, `classTeachers`, `subjectTeachers`, and `classScheduleSlots` do not identify the school session they belong to. This makes it impossible to configure next year safely while preserving the current year's structure.

Required direction:

- Introduce an explicit session-scoped offering/container, preferably `academicClassOfferings`, that links `sessionYearId`, class, section, branch, shift, stream, capacity, and status.
- Migrate current `classSections` usages gradually or add `sessionYearId` directly only if the migration analysis proves that less disruptive.
- Ensure exactly one default/open session per tenant at the database and transactional API level.
- Give all assignments and timetables an effective session through the offering.

### 4.2 Class teacher assignment has no semantics or history

The current join record only stores section and teacher. It cannot distinguish a homeroom/primary teacher from an assistant, preserve a past assignment, or prevent multiple primary teachers.

Add:

- `role`: `primary`, `assistant`, or `support`.
- `startsOn`, `endsOn`, `status`, `assignedBy`, and optional note.
- A partial uniqueness rule for one active primary teacher per class offering.
- A reassignment command that closes the old record and creates the new one atomically instead of delete-and-recreate.
- Workload indicators before assignment.

### 4.3 Subject curriculum assignment lacks planning fields

Current `classSubjects` covers required/elective and semester, but not curriculum planning.

Add optional fields:

- weekly minutes or periods;
- display/report-card order;
- coefficient/credit weighting;
- pass threshold where applicable;
- active status and session/offering scope;
- curriculum label/version.

Deleting an assignment already referenced by assessments, teacher assignments, electives, or timetable slots must return a clean `409 IN_USE`. Prefer archive/end-date over destructive deletion.

### 4.4 Timetable integrity is reactive

The conflict endpoint reports conflicts, but timetable POST/PUT does not reject or require an override for them. It also verifies tenant ownership without proving that:

- the selected `classSubjectId` belongs to the selected section's class;
- the selected teacher is assigned to that exact section and subject;
- the slot is inside the class shift;
- the room label is a canonical room;
- the updated start/end pair remains valid when only one value changes.

The copy endpoint also copies raw `classSubjectId` values to another section without validating that the target section belongs to the same class/curriculum, and it can create duplicates or conflicts.

Required changes:

- Centralize timetable validation in a domain service used by create, update, copy, preview, and publish.
- Validate section/class-subject consistency and subject-teacher eligibility.
- Detect collisions before write; default to block, with an explicit permissioned override reason if the school policy allows it.
- Validate merged PUT values, including `startTime < endTime`.
- Make copy a previewable mapping operation; reject unmappable subjects and show conflicts before commit.

### 4.5 Timetable has no lifecycle

Add `timetableVersions` (or equivalent) with:

- session/class-offering scope;
- version number and status: `draft`, `published`, `archived`;
- effective date range;
- created/published by and timestamps;
- optional copied-from version.

Slots belong to a version. Students, parents, and teachers see only the currently effective published version. Administrators can prepare a future timetable without altering the live one.

### 4.6 Teacher timetable is missing as a product surface

Do not maintain a second editable teacher schedule. It must be a projection of published class timetable slots, preventing two sources of truth.

Add:

- `GET /api/academics/timetable-slots?teacherId=...&sessionYearId=...` with school-admin access and teacher self-scope enforcement;
- `/dashboard/academics/teacher-schedule` for administrators;
- `/dashboard/teachers/schedule` or a teacher dashboard card for the authenticated teacher;
- day/week views, room, class-section, subject, print/PDF, and conflict badges;
- workload totals and unassigned-subject warnings for admins.

### 4.7 Promotion currently destroys transition history

The current route changes `user.classSectionId` and records only a batch-level audit count. It does not store each student's source, destination, session, result, exception, or operator decision.

Introduce a first-class active placement history, not the deprecated LMS `enrollments` table:

- `studentAcademicPlacements`: tenant, student, session year, class offering/section, start/end dates, status, source, createdBy.
- `promotionBatches`: source session/offering, target session/offering, status (`draft`, `validated`, `committed`, `reverted`), idempotency key, operator, timestamps.
- `promotionDecisions`: batch, student, decision (`promote`, `repeat`, `graduate`, `transfer`, `withdraw`, `hold`), target placement when relevant, reason/note, validation state.

Keep `user.classSectionId` temporarily as the compatibility pointer to the student's current active placement. Update it in the same transaction as placement history until consumers have migrated.

Promotion workflow:

1. Select source and target session years.
2. Select a source class offering and proposed target.
3. Load the complete roster without the current hard 200-student ceiling.
4. Generate a preview with default decisions and exceptions.
5. Validate target capacity, duplicate active placements, missing target curriculum, unpaid-fee policy only if explicitly configured, and locked academic results.
6. Let the operator change individual decisions and provide required reasons for repeat/hold/withdraw/transfer.
7. Commit once with an idempotency key and per-student outcome records.
8. Produce a receipt/report with successes, skipped students, and failures.
9. Allow a permissioned rollback only while no dependent records exist in the target session; otherwise use a corrective transfer.

Promotion must never move attendance, grades, assessment attempts, or old class assignments into the new session. Those records stay connected to their original academic context.

## 5. Recommended product navigation

Reorganize the current scattered links into one Academic group without removing existing routes during migration:

- Academic Setup
  - Classes & Sections
  - Subjects
  - Curriculum / Class Subjects
  - Class Teachers
  - Subject Teachers
- Timetables
  - Class Schedule
  - Teacher Schedule
  - Conflicts
- Academic Year Operations
  - Session Years
  - Promotion
  - Promotion History

Keep Mediums, Semesters, Streams, Shifts, and Optional Subjects under an Advanced Setup subsection. This matches the reference product's discoverability while preserving Lango's richer features.

## 6. Implementation phases

### Phase 0 - invariants and migration design

- Write an ADR for session scoping and decide between extending `classSections` or introducing class offerings.
- Inventory every foreign key and API that reads `user.classSectionId`.
- Define archive/delete rules for all academic records.
- Add integration-test fixtures for two tenants, two sessions, overlapping teachers, and promotion edge cases.

Exit: approved schema map, migration/backfill plan, and no dependency on dead LMS tables.

### Phase 1 - session-scoped academic structure

- Add class offering/session scope and backfill existing data into the tenant's default session.
- Add capacity, active/archive state, and stable display order.
- Scope class subjects, class teachers, and subject teachers to the offering/session.
- Update APIs and selectors to default to the current session while accepting an explicit session.
- Add a safe "copy setup to next session" preview/commit workflow.

Exit: current and next academic years can be configured concurrently without overwriting each other.

### Phase 2 - assignment workflow enhancement

- Implement primary/assistant class-teacher roles and effective history.
- Add subject planning fields and protected archive behavior.
- Build one assignment workspace with class, section, subject, and teacher context.
- Add bulk assignment/copy with dry-run validation.
- Add coverage metrics: sections without primary teachers, subjects without teachers, overloaded teachers.

Exit: every published class offering has a valid primary teacher policy and complete subject-teacher coverage, or an explicit exception.

### Phase 3 - timetable engine and teacher schedule

- Add timetable versions and effective publication.
- Build the shared validation/conflict service and enforce it on POST/PUT/copy/publish.
- Replace free-text rooms with a small active room directory only after confirming the old `rooms` table remains unsuitable; do not revive the dead chain.
- Add drag/move or edit support, copy preview, print/PDF, and accessibility/mobile handling.
- Add teacher filter and self-scoped teacher timetable pages.
- Make publication fail while blocking conflicts or invalid assignments remain.

Exit: one published source of truth produces both class and teacher schedules with no unapproved collision.

### Phase 4 - promotion ledger and workflow

- Add placement, batch, and decision tables plus indexes and constraints.
- Backfill a current placement for active students from `user.classSectionId` and the default session.
- Implement draft, preview, validate, commit, history, and controlled reversal APIs.
- Rebuild the promotion UI as a wizard with per-student decisions and capacity indicators.
- Add promotion batch detail/export and student academic placement history.
- Preserve the compatibility pointer transactionally.

Exit: every student move has an immutable source/target/session/decision trail and retrying a request cannot duplicate a promotion.

### Phase 5 - navigation, reporting, and operational readiness

- Apply the proposed Academic navigation and redirects.
- Add admin dashboard readiness cards and exception queues.
- Add CSV/PDF exports where operationally useful.
- Add audit views and permission matrix.
- Run performance tests for large rosters and timetable conflict checks.
- Provide migration rollback and operational runbooks.

## 7. API and authorization requirements

- `school_admin`: manage setup, assignments, timetable drafts/publication, promotions, and corrections.
- `teacher`: read only their assigned classes/subjects and their own published schedule; no tenant-wide enumeration.
- `student` and `parent`: read only the student's currently published timetable when that surface is added.
- All mutations require tenant scoping, strict input validation, structured errors, and audit metadata.
- Bulk operations use preview tokens or idempotency keys, return per-row outcomes, and run transactionally where correctness requires all-or-nothing behavior.
- Conflict overrides, promotion rollback, and history corrections require explicit permission and a reason.

## 8. Minimum test matrix

### Academic setup

- Cross-tenant class, section, subject, and teacher IDs are rejected.
- Duplicate offering/section and duplicate subject assignment rules hold under concurrent requests.
- Referenced curriculum records cannot be deleted silently.
- Current and next sessions remain isolated.

### Timetables

- Teacher, class, and room overlap at boundary and partial-overlap times.
- Non-overlapping adjacent slots are accepted.
- Invalid class-subject-section and teacher-subject combinations are rejected.
- PUT validates the final merged time pair.
- Copy preview reports unmapped subjects, duplicates, and conflicts.
- Only one effective published version is visible for a scope/date.
- Teacher accounts cannot request another teacher's schedule.

### Promotions

- Promote selected, repeat, graduate, transfer, withdraw, and hold decisions.
- Target capacity and duplicate placement checks.
- Zero-row/stale-roster handling.
- Transaction rollback on a mid-batch failure.
- Idempotent retry produces no duplicate placements.
- Compatibility pointer and placement ledger never diverge.
- Reversal allowed before dependent target-session activity and blocked afterward.
- Historical grades and attendance remain attached to the source session.

## 9. Definition of done

The enhancement is complete only when:

- all academic setup and assignments are explicitly session-scoped;
- the app can configure a future session while the current session remains live;
- class and teacher schedules are projections of the same published timetable;
- blocking timetable conflicts cannot be published accidentally;
- every promotion has per-student, session-aware history and is idempotent;
- no implementation uses the deprecated LMS academic chain;
- tenant isolation, role scoping, migrations, rollback, and bulk-operation tests pass;
- navigation exposes the reference product's workflows without duplicating sources of truth.

## 10. Priority recommendation

1. Promotion ledger and session-scoping ADR: highest data-integrity risk.
2. Session-scoped class offerings: prerequisite for real next-year planning and promotion.
3. Timetable write-time validation and teacher schedule: highest daily operational value.
4. Teacher/subject assignment lifecycle and curriculum metadata.
5. Navigation consolidation, exports, and dashboard polish.

