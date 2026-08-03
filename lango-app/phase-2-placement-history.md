# Effective-Dated Student Placement History Plan

## Goal
Implement the `student_placements` model and `/api/students/placements` API to preserve historical student class placements across academic session years without overwriting prior year records.

## Tasks
- [x] Task 1: Add `studentPlacements` table to `src/models/Schema.ts` and create migration `0037_add_student_placements.sql` → Verify: `npx tsc --noEmit` passes.
- [x] Task 2: Create Drizzle migration runner and backfill existing `user.classSectionId` values into `student_placements` for active session years → Verify: DB migration executes cleanly.
- [x] Task 3: Build placement API `src/app/api/students/placements/route.ts` supporting `GET` (by studentId/sessionYearId) and `POST` (create/update placement record) → Verify: Endpoint returns HTTP 200 with student placement history.
- [x] Task 4: Connect student promotion API `src/app/api/students/promotions/route.ts` to automatically record historical placements when advancing students → Verify: Promotion creates new `student_placements` row while preserving past placement.
- [x] Task 5: Create Vitest unit test suite `src/app/api/students/placements/placements.test.ts` → Verify: `npx vitest run src/app/api/students/placements/placements.test.ts` passes 100%.

## Done When
- [x] Table `student_placements` tracks student placements per session year with `startDate`, `endDate`, `status`, and `isCurrent`.
- [x] Promoting or transferring a student preserves prior academic year placement history.
- [x] All unit tests pass 100% and `npx tsc --noEmit` exits with 0 errors.
