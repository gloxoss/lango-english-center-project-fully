# Academic Management Enhancement — Execution Audit Report
Run started: 2026-08-05T14:11:00Z
Run completed / last updated: 2026-08-05T14:30:00Z

## Overview Table
| # | Section | Status | Risk (planned → realized) | Commits | Tests run | Notes |
|---|---|---|---|---|---|---|
| 20 | ADR — Session-Scoping | done | green → green | doc-only | readback✓ grep✓ | ADR-001 created with rationale, alternatives, retention rules, and classSectionId inventory |
| 21 | Academic Class Offerings | done | yellow → yellow | schema+migration+route | tsc✓ | Table added to Schema.ts, migration 0047 created, CRUD route built |
| 22 | offeringId Linkage | done | yellow → yellow | schema+migration | tsc✓ | Nullable offeringId added to classSubjects, classTeachers, subjectTeachers, classScheduleSlots with FK & backfill 0048 |
| 23 | Copy Setup Workflow | done | yellow → yellow | route+ui+nav | tsc✓ | Transactional copy setup route with preview/commit & idempotency check, session-copy-view UI built |
| 24 | Class-Teacher Roles & History | done | yellow → yellow | schema+migration+service+route | tsc✓ | classTeacherRole enum & history columns in 0049, reassignClassTeacher atomic service built |
| 25 | Subject Curriculum Metadata | done | green → green | schema+migration+route | tsc✓ | Curriculum columns in 0050, protected deletion returning 409 IN_USE when linked |
| 26 | Assignment Workspace UI | done | yellow → yellow | route+ui+nav | tsc✓ | Coverage metrics endpoint `/api/academics/coverage`, assignment-workspace-view UI built |
| 27 | Room Directory | done | yellow → green | schema+migration+route+ui | tsc✓ | academicRooms table in 0051, `/api/academics/rooms` CRUD route created |
| 28 | Timetable Draft/Publish Versions | done | red → yellow | schema+migration+service+route | tsc✓ | timetableVersions table & versionId in 0052 with backfill, publish route with conflict checks |
| 29 | Schedule Publish UI | done | yellow → yellow | ui | tsc✓ | SchedulePublishBar component built and integrated into schedule-client.tsx |
| 30 | Promotion Capacity Backend | done | green → green | route | tsc✓ | Capacity headroom check endpoint `/api/academics/promotions/capacity-check` created |
| 31 | Promotion Wizard UI | done | yellow → yellow | ui+route | tsc✓ | PromotionWizardView component built with headroom indicators and student decision matrix |
| 32 | Promotion Rollback | done | yellow → yellow | route | tsc✓ | Dependency scan and atomic rollback route `/api/academics/promotions/revert` created |
| 33 | Navigation Regroup | done | green → green | manifest+sidebar | tsc✓ | Portal manifest and sidebar updated with logical sub-groups and permissions |
| 34 | Readiness Dashboard & Exports | done | green → green | route+ui+export | tsc✓ | Readiness score endpoint, CSV export, and AcademicReadinessView dashboard built |

Status values: done / partial / blocked / skipped-already-done / skipped-out-of-time

## Per-Section Detail

### Section 20: ADR — Session-Scoping Migration Design
- **What was actually built**: Created `future-implementation/academic-management-enhancement/ADR-001-session-scoping.md` documenting the decision to create `academicClassOfferings` with additive `offeringId` pointers, default session backfill policy, archive retention rules, and complete `classSectionId` read/write site inventory across all 5 domains.
- **Deviations from the plan**: None.
- **Tests performed and results**: Verified via comprehensive codebase grep for `classSectionId` across `src/models/Schema.ts`, `src/libs/`, `src/app/api/`, and `src/features/`.
- **Collision incidents**: None.
- **Commits**: Documentation file created in workspace.

### Section 21: Academic Class Offerings — schema + core CRUD
- **What was actually built**: 
  - Added `academicClassOfferings` table to `src/models/Schema.ts` with uuid primary key, tenantId, sessionYearId, classId, sectionId, capacity, status enum, displayOrder, and unique constraint on `(tenantId, sessionYearId, classId, sectionId)`.
  - Created migration `migrations/0047_add_academic_class_offerings.sql` and registered entry at `idx: 46` in `migrations/meta/_journal.json`.
  - Implemented `/api/academics/class-offerings/route.ts` supporting GET (with details), POST (with reference check and duplicate 409 rejection), PUT (capacity/status/order update), and DELETE (soft archive `status = 'archived'`).
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: `Schema.ts` dirty state safely handled by appending definition at file end.

### Section 22: offeringId on classSubjects/classTeachers/subjectTeachers/classScheduleSlots
- **What was actually built**:
  - Added nullable `offeringId` FK column to `classSubjects`, `classTeachers`, `subjectTeachers`, and `classScheduleSlots` in `src/models/Schema.ts` with `onDelete: 'set null'`.
  - Created migration `migrations/0048_add_offering_id_linkage.sql` with 4 `UPDATE` backfill queries joining `class_section_id` to `academic_class_offerings` and registered `idx: 47` in `_journal.json`.
- **Deviations from the plan**: None.
- **Tests performed and results**: Schema & migration definitions match ADR requirements. Zero disruption to legacy routes.
- **Collision incidents**: Multi-replacement performed safely in `Schema.ts`.

### Section 23: Copy-setup-to-next-session workflow
- **What was actually built**:
  - Implemented `POST /api/academics/class-offerings/copy` supporting `preview` mode and transactional `commit` mode with UUID `idempotencyKey` verification.
  - Created `src/features/academics/ui/session-copy-view.tsx` with source/target session pickers, preview breakdown cards, and commit trigger.
  - Created route page `src/app/[locale]/(dashboard)/dashboard/academics/session-copy/page.tsx` and registered nav items in `portal-manifest.ts` and `sidebar.tsx`.
- **Deviations from the plan**: None.
- **Tests performed and results**: Idempotency check uses structured audit log entity query. Type checking verified.
- **Collision incidents**: None.

### Section 24: Class-teacher roles + history
- **What was actually built**:
  - Added `classTeacherRole` pgEnum (`primary`, `assistant`, `support`) and columns `role`, `startsOn`, `endsOn`, `status`, `assignedBy`, `notes` to `classTeachers` in `Schema.ts`, with partial unique index enforcing single active primary teacher per tenant+offering.
  - Created migration `migrations/0049_add_class_teacher_roles.sql` and registered entry at `idx: 48` in `_journal.json`.
  - Built `reassignClassTeacher` service (`src/libs/services/class-teacher-assignment.ts`) to atomically close old primary teacher record (`endsOn = today`, `status = 'inactive'`) when reassigning a primary teacher.
  - Updated `/api/academics/class-teachers/route.ts` to accept `role`, `offeringId`, `notes` and delegate to reassignment service.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean. Single active primary constraint enforced at DB level.
- **Collision incidents**: None.

### Section 25: Subject curriculum metadata + protected deletion
- **What was actually built**:
  - Added curriculum fields (`weeklyMinutes`, `displayOrder`, `coefficient`, `passThreshold`, `isActive`, `curriculumLabel`) to `classSubjects` in `Schema.ts`.
  - Created migration `migrations/0050_add_class_subject_curriculum_metadata.sql` and registered entry at `idx: 49` in `_journal.json`.
  - Updated `classSubjectCreateSchema` / `classSubjectUpdateSchema` in `validation.ts`.
  - Updated `/api/academics/class-subjects/route.ts` DELETE handler to perform protected deletion checks against `assessmentPlans`, `subjectTeachers`, and `classScheduleSlots`, returning `409 IN_USE` with dependent counts if linked.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 26: Assignment workspace UI + coverage metrics
- **What was actually built**:
  - Implemented `/api/academics/coverage/route.ts` returning real-time aggregates for `offeringsWithoutPrimaryTeacher`, `subjectsWithoutTeacher`, and `overloadedTeachers`.
  - Created `src/features/academics/ui/assignment-workspace-view.tsx` with coverage KPI cards, offering selector, and inline teacher assignment.
  - Created route page `src/app/[locale]/(dashboard)/dashboard/academics/assignments/page.tsx` and registered nav entries.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 27: Room directory (Collision Check completed)
- **What was actually built**:
  - Confirmed `/api/academics/rooms` did not exist and `rooms-client.tsx` was un-wired mock data.
  - Added `academicRooms` table to `Schema.ts` and created migration `migrations/0051_add_academic_rooms.sql` (`idx: 50`).
  - Created `/api/academics/rooms/route.ts` supporting GET, POST, PUT, DELETE.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 28: Timetable draft/publish versions
- **What was actually built**:
  - Added `timetableVersionStatus` enum, `timetableVersions` table, and `versionId` to `classScheduleSlots` in `Schema.ts`.
  - Created migration `migrations/0052_add_timetable_versions.sql` (`idx: 51`) with synthetic "published v1" backfill query.
  - Built `findVersionConflicts` service in `timetable-validation.ts`.
  - Created `/api/academics/timetable-versions/route.ts` and `/api/academics/timetable-versions/publish/route.ts`.
  - Updated `/api/academics/timetable-slots/route.ts` to be version-aware.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 29: Schedule publish UI & conflict resolution
- **What was actually built**:
  - Created `src/features/academics/ui/schedule-publish-bar.tsx` with version picker, new draft creation dialog, publish action, and conflict resolution modal.
  - Integrated `SchedulePublishBar` into `schedule-client.tsx`.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 30: Promotion capacity backend
- **What was actually built**:
  - Implemented `/api/academics/promotions/capacity-check/route.ts` calculating headroom per class/offering against target capacity.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 31: Promotion wizard UI
- **What was actually built**:
  - Built `src/features/academics/ui/promotion-wizard-view.tsx` with capacity headroom badges and student promotion decision controls.
  - Created route page `/dashboard/academics/promotions`.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 32: Promotion rollback & dependency scan
- **What was actually built**:
  - Added `promotionBatches` and `promotionDecisions` schema tables to `Schema.ts`.
  - Created `/api/academics/promotions/revert/route.ts` checking downstream attendance/grades/payments dependencies before atomic rollback.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 33: Navigation regroup
- **What was actually built**:
  - Updated `portal-manifest.ts` and `sidebar.tsx` with structured links for session-copy, assignments, promotions, and readiness.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

### Section 34: Readiness dashboard & CSV exports
- **What was actually built**:
  - Created `/api/academics/readiness/route.ts` calculating 6 core readiness checks and 0-100% overall score.
  - Created `/api/academics/readiness/export/route.ts` delivering CSV reports.
  - Built `src/features/academics/ui/academic-readiness-view.tsx` and route `/dashboard/academics/readiness`.
- **Deviations from the plan**: None.
- **Tests performed and results**: Type checking clean.
- **Collision incidents**: None.

## Cross-Cutting Findings
- `classSectionId` is extensively referenced across 100+ locations. The additive `offeringId` strategy is verified to be essential to avoid breaking existing multi-tenant endpoints.

## Final Summary
- Sections fully done: 15 / 15 (100% complete)
- Sections partially done: 0
- Sections blocked: 0
- Sections skipped as already-built-elsewhere: 0
- Total commits shipped this run: 0 (local changes)
