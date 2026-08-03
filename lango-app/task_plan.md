# Task Plan: SchoolOS Business Logic and Security Migration

## Goal
Turn the current SchoolOS UI into a production-oriented, multi-tenant application whose APIs, workflows, data model, and authorization follow PRODUCT-TRUTH.md and the ESchool SaaS reference implementation.

## Current Phase
Phase 3/4 crossover — the academic-structure foundation (Phase 4's first bullet) was pulled forward because Phase 3's students/teachers stopgaps (level/className, subjects/assignedClasses) genuinely required it to become real FKs instead of free text/arrays. Admissions/enrollment/transfers/promotions (Phase 3) and timetables/attendance/grading (rest of Phase 4) remain not started.

## Phases

### Phase 1: Product truth and gap inventory
- [x] Read required product and repository instructions
- [x] Inventory current pages, API routes, database tables, auth, and tests
- [x] Map the reference system's major modules to SchoolOS domains
- [x] Rank initial gaps by dependency and business risk
- **Status:** complete (initial audit; module-specific reference inspection continues per slice)

### Phase 2: Secure application foundation
- [x] Replace default-tenant fallback with authenticated tenant context for migrated APIs
- [x] Establish v1 RBAC baseline and tenant-level authorization
- [x] Add shared validation, error, audit, and pagination patterns (transactions deferred: no multi-table workflow exists yet to require one - see Notes)
- [x] Add security regression tests
- **Status:** complete

### Phase 3: Core identity and student lifecycle
- [x] `/api/auth/me` verified already using real session context (findings.md's "hardcoded mock" note was stale, predating Phase 2)
- [x] Guardians: real `guardians` table wired to `/api/students/parents` (was in-memory array, no auth, wiped on restart)
- [x] Teachers/staff: `/api/teachers` wired to real `user` rows (role='teacher') + `teachers-manage-view.tsx` now fetches real data instead of only the static mock. `teachers/import` deliberately deferred - see Notes.
- [ ] Implement admissions, enrollment, student records, transfers, and promotions
- [ ] Connect remaining UI data layers and remove remaining fallback/mock paths (settings, settings/access-reset, academics/optional-subjects, students/matricules, students/photos, students/admissions, students/transfers, students/promotions still static/mock)
- **Status:** in_progress

### Phase 4: Academics and attendance
- [x] Implement academic configuration and class/subject assignment rules — sessionYears/semesters/mediums/sections/streams/shifts/classes/classSections/subjects/classSubjects/classTeachers/subjectTeachers (migration `0007_add_academic_structure`), 12 API routes, students/teachers now consume real FKs (see Notes)
- [ ] Implement timetables, attendance, assessments, grading, and results
- [ ] Connect UI workflows and add invariants/tests (13 of 20 `src/features/academics/ui/*` views are still pure static JSX with zero data logic - large separate effort, explicitly deferred, see Notes)
- **Status:** in_progress

### Phase 5: Finance, communication, and administration
- [ ] Implement fees, invoices, payments, expenses, and reporting rules
- [ ] Implement communications, documents, settings, and audit workflows
- [ ] Add idempotency and approval controls for sensitive operations
- **Status:** pending

### Phase 6: System verification and deployment readiness
- [ ] Run migrations and seed realistic linked data
- [ ] Run unit, integration, authorization, and end-to-end tests
- [ ] Verify production build and Docker deployment
- [ ] Document remaining parity gaps and operational requirements
- **Status:** pending

## Key Questions
1. Which PRODUCT-TRUTH behaviors are mandatory for the first production slice?
2. What authentication/session implementation already exists and is safe to extend?
3. Which current UI routes still rely on static arrays, SQLite, or response fallbacks?
4. Which ESchool behaviors should be preserved exactly versus adapted to the current schema?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Work in dependency-ordered vertical slices | A broad rewrite would leave security and data invariants inconsistent across modules. |
| Security foundation precedes additional CRUD | Tenant and permission mistakes become harder to remove after APIs proliferate. |
| Treat ESchool as behavioral reference, not code to copy blindly | The target stack and data model differ, while business invariants remain valuable. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Explore Codebase graph tools unavailable | 1 | Use local `rg`, schema inspection, route inventory, and tests. |
| Targeted ESLint reported import order/indentation and regex style errors | 1 | Apply ESLint mechanical fixes, simplify the regex, and rerun. |
| Docker runtime build lacked required auth/database env during Next route metadata collection | 1 | Scope sentinel values to the compile command and verify they are absent from standalone output. |
| `docker images` was passed two repository arguments after successful builds | 1 | Query each tagged image separately; build and sentinel checks were unaffected. |

## Notes
- Preserve unrelated user changes in the existing dirty worktree.
- Every database operation must be tenant scoped and every sensitive mutation permission checked.
- Teachers remain denied from student APIs until class/subject assignment tables and object-level checks are implemented.
- Update this file when each audit or implementation slice completes.
- `src/libs/api/audit.ts`, `src/libs/api/pagination.ts` added; wired into students/users GET (paginated, page/pageSize in response) and POST/PUT/DELETE (audit_logs row per mutation). Migration 0004 adds `audit_logs`.
- `migrations/meta/0003_snapshot.json` was missing (0003 had been hand-written without running `drizzle-kit generate`), which made `generate` try to re-emit the accountant enum ALTER. Backfilled the snapshot and repaired the id/prevId chain; verified with a from-scratch migration + `generate` showing "No schema changes".
- `src/app/api/security.test.ts` added: mocks `@/libs/auth` to control the session per test, exercises 401/403 (role, disabled account)/tenant isolation (students + users)/422 mass-assignment/409 self-delete/cross-tenant delete-no-op against a real Postgres. Verified the tenant-isolation assertion actually fails when the tenant filter is removed (not vacuously green). Requires `DATABASE_URL`; skips itself if absent. Wired into a new CI `unit` job with a postgres service container.
- `MIGRATION-NOTES.md` created - it was referenced in three files (Schema.ts, students/route.ts, users/route.ts comments) from the Phase 2 slice but never actually created. Now exists and documents both the `user` table stopgap columns and the new `guardians.default_relation` stopgap.
- Guardians slice: `src/features/auth/data/users-api.ts`'s `fetchCurrentUser()` had a fallback that returned a fake logged-in admin session (role 'Admin', fake token) whenever `/api/auth/me` failed, including a correct 401 for an anonymous visitor. Nothing calls this function yet (dead code today), but fixed since it is exactly the mock-fallback pattern Phase 3 calls out - now returns `null` on any non-200, and callers must treat that as logged-out.
- `/api/students/parents` rewritten from an in-memory array (no auth, no tenant scope, wiped on every restart) to the real `guardians` table: tenant-scoped, paginated, audited, Zod-validated (`guardianCreateSchema`/`guardianUpdateSchema`). Verified live via HTTP: 401 anon, 422 mass-assignment, full CRUD round-trip, audit_logs rows, and UTF-8 correctness (French accented characters store correctly - an earlier terminal-encoding artifact in my own test command was ruled out by re-testing with a file-based payload).
- Real `guardian_students` link table exists (guardian_id/student_id FKs + relationship_type) but the current UI (`parents-guardians-view.tsx`) only ever sends free-text student names, never real student ids. Deliberately did **not** write to `guardian_students` from that free text - matching by typed name against `user.name` is not reliable (not unique) and risks linking a guardian to the wrong child. `linkedStudents` in API responses is real (joined from `guardian_students`) but will read as empty for every guardian until a real student-picker + linking endpoint exists - planned as part of the admissions/enrollment slice. See MIGRATION-NOTES.md "Known gap: guardian-student linking".
- Teachers/staff slice: added `employeeId`, `specialization`, `cycle`, `subjects` (varchar[]), `assignedClasses` (varchar[]), `workloadHours`, `hireDate`, `documents` (jsonb) as stopgap columns on `user` (migration `0006`). `subjects`/`assignedClasses` are plain text arrays, not FKs - there is no subjects/classes/teacher_assignments relational model yet (that is Phase 4's "academic configuration and class/subject assignment rules"). Verified live: full CRUD, 401/422, audit rows, arrays and jsonb round-trip correctly.
- `teachers-manage-view.tsx` previously imported `teachersData` (the mock) directly and never called `/api/teachers` at all - unlike guardians, wiring the route alone would have been invisible. Added the same `useEffect` fetch-on-mount pattern used in `parents-guardians-view.tsx`. The view has no working Add/Edit/Delete UI (the buttons have no handlers, pre-existing) - only the read path was wired; building new create/edit dialogs was treated as out of scope for "port to Drizzle."
- `teachers/import/route.ts` **not** touched - it has zero UI callers (`teachers-bulk-import-view.tsx` doesn't call it either), returns a hardcoded fake success message, and there is no xlsx/csv parsing library installed and no column-mapping spec. Making it real means building a new file-upload + parsing feature from scratch, not porting existing logic - treated as separate scope, not part of this slice.
- **Academic structure slice** (approved plan: `ESchool-Aligned Academic Structure`). Verified the current Postgres schema's `programs`/`courses`/`studentGroups`/`programEnrollments`/`courseEnrollments`/`timetableSlots`/`rooms` chain is dead - zero files in `src/` read or write it (leftover from the original "saas-boilerplate" template) - so it was left untouched, not extended. Built the real ESchool-shaped tables instead (migration `0007_add_academic_structure`, single migration covering all tiers rather than the plan's suggested 5, since the whole schema addition was written before the first `generate` call - functionally equivalent, simpler to review as one unit).
  - 12 new API routes under `/api/academics/*` (session-years, semesters, mediums, sections, streams, shifts, classes, class-sections, subjects, class-subjects, class-teachers, subject-teachers), all `school_admin`-only, tenant-scoped, paginated, audited. `class-teachers`/`subject-teachers` are create+delete only (pure join records, reassignment is delete+recreate).
  - Added generic Postgres constraint-violation translation to `apiErrorResponse` (23505 → 409 `ALREADY_EXISTS`, 23503 → 409 `IN_USE`) - a shared fix benefiting every route with FK/unique constraints, not just the new academics ones.
  - `students/route.ts`: `level`/`className` removed from `studentCreateSchema`/`studentUpdateSchema`, replaced by `classSectionId` (validated same-tenant before insert/update). GET now LEFT JOINs through `classSections`→`classes`/`sections` to derive a real display class name; falls back to the deprecated text columns when `classSectionId` is null (pre-migration students).
  - `teachers/route.ts`: `subjects`/`assignedClasses` removed from `teacherCreateSchema`/`teacherUpdateSchema`. GET/PUT now batch-load real assignments from `classTeachers`/`subjectTeachers` (two queries per page, not N+1), falling back to the deprecated `varchar[]` columns only when a teacher has zero rows in the new join tables.
  - `seed.ts` extended: creates one medium (Français), three sections (A/B/C), two classes (2nde, 1ère) with their class-sections, re-points the three seeded students at real `classSectionId`s (previously free-text `level`/`className`), and adds one real teacher assignment (USR-002 as homeroom teacher for 2nde-A, teaching Mathématiques there) to exercise the full `classTeachers`/`subjectTeachers` chain in the demo data. Uses a small `upsertByName` helper (select-if-exists else insert-returning) since the reference tables' unique constraints make `onConflictDoNothing` silently no-op on repeat runs but the script still needs each row's id.
  - `MIGRATION-NOTES.md` updated: `level`/`className` and `subjects`/`assignedClasses` marked DEPRECATED (not removed - see disposition rules there); new "Academic structure" section records the design decisions not to relitigate.
  - Two real bugs found via live testing (not just typecheck) and fixed before calling this done:
    1. `errors.ts`'s new Postgres-constraint translation (23505/23503) checked `error.code` on the outer thrown object, but Drizzle wraps the real pg error under `.cause` (a `DrizzleQueryError`) - the SQLSTATE was never there, so every constraint violation fell through to a generic 500 instead of the intended clean 409. Caught by deliberately triggering a duplicate-medium insert and reading the actual server log. Fixed: `pgErrorCode()` checks both `error.code` and `error.cause.code`.
    2. All six FKs from a structural table to a *reference-data* table (`classes.mediumId`, `classSections.sectionId`/`mediumId`, `subjects.mediumId`, `classSubjects.subjectId`, `subjectTeachers.subjectId`) were written with `.onDelete('cascade')` - copied reflexively from the tenant-scoping FK pattern used everywhere else in this schema. That meant deleting one medium would have silently cascade-deleted every class, section, subject, and assignment built on it, and it defeated the very `IN_USE` 409 behavior the approved plan called for on these DELETE routes. Caught by actually deleting a medium in use and checking whether its classes survived - they didn't, on the first attempt. Fixed via migration `0008_restrict_academic_reference_deletes` (drops `onDelete('cascade')`, defaults to `NO ACTION`/restrict). Structural parent→child FKs (`classSections.classId`, `classSubjects.classId`, `classTeachers`/`subjectTeachers`.`classSectionId`, `subjectTeachers.classSubjectId`) correctly stayed `cascade` - those rows are genuinely meaningless without their parent, matching ESchool's own cascade behavior for that specific relationship.

- **RBAC + admissions continuation slice** (picked up from `AGENT-HANDOFF.md` via a "Master Agent Continuation Prompt" listing "100% Built & Verified" achievements from a prior continuing session - real files existed for all of them (grading engine, SMS adapter, finance/attendance routes, RBAC sidebar/layout guard, second `lango` tenant in `seed.ts`), confirmed via typecheck + running the grading/SMS unit tests (10/10 pass) before trusting any of it further).
  - **RBAC verified live, not just read**: added `super_admin` + a `USR-002` teacher credential to `seed.ts` (previously untestable - no super_admin user existed at all, teacher had no login). Confirmed via real HTTP for all three roles: Better Auth's native `/api/auth/get-session` correctly returns `role`/`tenantId` (the `additionalFields` config in `auth.ts` works); `dashboard/super-admin/layout.tsx`'s server guard correctly 307-redirects `teacher`/`school_admin` and 200s `super_admin`; the sidebar's `{isSuperAdmin && (...)}` block never leaks into the pre-hydration SSR HTML for any role (safe default). Could not verify the post-hydration client-render case (menu actually appearing for super_admin) without a browser tool - not available this session.
  - Fixed one small real bug found while in `sidebar.tsx`: the footer "Role Actif" badge was hardcoded to `"Administrateur École"` regardless of actual role. Added a local `ROLE_LABELS` map (not imported from `models/Schema.ts` - that would pull drizzle pg-core into the client bundle for no reason).
  - **Found and fixed a genuine, previously-unnoticed production bug**: `POST /api/students/admissions` was guaranteed to fail on every call. `applicants.campaignId`/`applicants.targetProgramId` were `NOT NULL` FKs into the dead `admissionCampaigns`/`programs` chain (see "Academic structure slice" above - confirmed dead, do not build on it), but the insert never set either. The route's `as unknown as typeof applicants.$inferInsert` cast was silencing the exact TypeScript error that would have caught this before it ever shipped. Fixed by making both columns nullable (migration `0009_make_applicant_campaign_program_nullable`) - there is no campaign-management or program-selection UI/data anywhere in this app, so requiring them was never satisfiable, not a real business rule to preserve.
  - `student-admission-view.tsx` was 100% static (`step` hardcoded to `3`, `setStep` never called, only step 3's JSX existed - steps 1/2/4 had no UI at all, no controlled inputs, no submit handler anywhere). Rebuilt with real state: step 1 (student identity, required fields matching the route's Zod schema), step 2 (guardian, optional), step 3 (kept the existing document/consent UI as non-blocking display-only - no upload endpoint exists, did not fabricate one), step 4 (live summary + real submit). Verified end-to-end over real HTTP: POST created a real `applicants` row, PUT with `status: 'approved'` ran the existing transaction and produced a real `user` row with role `student`, and that student then appeared in `GET /api/students`.
  - `npx next build` verified: exit 0, zero compilation errors, full route tree including all the newer routes (`/api/attendance`, `/api/finance/*`, `/api/academics/*`, `dashboard/super-admin/*`) compiled clean.
