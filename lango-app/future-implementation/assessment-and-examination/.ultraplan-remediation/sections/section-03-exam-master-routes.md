# Section 03: Exam Master Routes

## Overview
Builds the real API routes wiring `ExamMasterService` (already well-built, per the audit, just never called from any route) to the app - exam terms, halls, seat allocation, schedules with conflict detection, marksheet entry, and rankings.

## Risk: yellow - moderate new-route surface area, but the underlying service logic is already correct

## Dependencies
- Depends on: none
- Blocks: section-04, section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: Creating an exam term, hall, and generating seat allocations for a set of students produces real, persisted rows.
- Test: Scheduling two exams in the same hall with overlapping times is rejected with a clear conflict error.
- Test: Scheduling two exams in the same hall with non-overlapping times both succeed.
- Test: Saving a marksheet grid produces real rows in the shared `assessmentOutcomes` ledger, visible via the existing `OutcomeService`.
- Test: Rankings reflect real entered marks, ordered correctly, with ties handled by the existing rank logic.

## Tasks

<task type="auto" id="03-01">
  <name>Exam terms and halls routes</name>
  <files>src/app/api/academics/exam-terms/route.ts, src/app/api/academics/exam-halls/route.ts</files>
  <action>
    Build `GET`/`POST` for both, following this codebase's full convention (`requireRequestContext(req, ['school_admin','teacher'])` → `requireTenant` → `requireCapability(context, 'grading.manage')` → Zod `.strict()` via `parseJson` → call `ExamMasterService.createExamTerm`/`createExamHall` for POST, a real tenant-scoped `db.select` for GET → `recordAudit` on create → `apiErrorResponse` catch-all).
  </action>
  <verify>Create a real exam term and hall via POST, confirm both appear via GET, confirm real rows exist via psql.</verify>
  <done>Exam terms and halls can be created and listed for real.</done>
</task>

<task type="auto" id="03-02">
  <name>Seat allocation route</name>
  <files>src/app/api/academics/exam-terms/[id]/seat-allocation/route.ts</files>
  <action>
    Build `POST` calling `ExamMasterService.generateSeatAllocations`, same auth/validation/audit convention. Validate the exam term ID in the URL belongs to the caller's tenant before calling the service (the service itself doesn't re-verify tenant ownership of `examTermId` - add that check in the route).
  </action>
  <verify>Generate real seat allocations for a real set of students and halls, confirm real `exam_seats` rows via psql, confirm no seat exceeds a hall's real capacity.</verify>
  <done>Seat allocation genuinely persists and respects hall capacity.</done>
</task>

<task type="auto" id="03-03">
  <name>Exam schedules route with conflict detection</name>
  <files>src/app/api/academics/exam-schedules/route.ts</files>
  <action>
    Build `GET`/`POST` calling `ExamMasterService.createExamSchedule` for POST (its conflict-detection logic is already correct - reuse as-is, just surface its thrown conflict error as a proper `ApiError(409, ...)` via `apiErrorResponse` rather than a generic 500).
  </action>
  <verify>Create two real overlapping-time schedules in the same hall and confirm the second is rejected with 409, not 500. Create two non-overlapping ones and confirm both succeed.</verify>
  <done>Exam scheduling is real and genuinely prevents hall double-booking.</done>
</task>

<task type="auto" id="03-04">
  <name>Marksheet and rankings routes</name>
  <files>src/app/api/academics/exam-terms/[id]/marksheet/route.ts, src/app/api/academics/exam-terms/[id]/rankings/route.ts</files>
  <action>
    Build `POST /marksheet` calling `ExamMasterService.saveMarksheetGrid` (real auth/validation/audit convention) and `GET /rankings` calling `ExamMasterService.generateTermRankings`. Validate the `assessmentDefinitionId` parameter belongs to the caller's tenant before calling either service method.
  </action>
  <verify>Enter real marks via the marksheet route, confirm they appear in the real `assessmentOutcomes` table, then confirm the rankings route reflects them correctly ordered.</verify>
  <done>Marks entered through Exam Master genuinely post to the shared gradebook ledger and rankings reflect real data.</done>
</task>
