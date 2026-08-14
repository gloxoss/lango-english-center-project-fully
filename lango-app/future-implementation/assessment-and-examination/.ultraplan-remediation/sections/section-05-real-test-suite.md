# Section 05: Rebuild Real Test Suite

## Overview
Replaces the fully-mocked `expect(Service).toBeDefined()` stub test file with real tests for the invariants that were fabricated or unverified, following the same "pure logic, no invented DB-fixture infrastructure" discipline established for the advanced-reporting remediation earlier this session (this codebase has no existing DB-backed vitest pattern to build on).

## Risk: yellow - must genuinely prove regressions are caught, not just exercise code paths

## Dependencies
- Depends on: section-01, section-02
- Blocks: section-06
- Parallel batch: 2

## TDD Test Stubs
- Test: The hall-conflict time-overlap check correctly identifies overlapping and non-overlapping ranges (pure logic, extractable and testable without DB).
- Test: A deterministic seat-numbering rule fills halls in capacity order without exceeding capacity (pure logic check on the allocation algorithm's shape).
- Test: The homework audience-matching logic (section-02) correctly includes/excludes based on student/section/offering targeting, using an in-memory fixture rather than a real DB connection where the matching logic can be isolated.

## Tasks

<task type="auto" id="05-01">
  <name>Locate and rebuild the real test file</name>
  <files>src/features/assessment/__tests__/assessment.test.ts</files>
  <action>
    Find the actual current path of this test file (may differ from the assumed `__tests__/` location, same lesson as the advanced-reporting remediation's `tests/` vs `__tests__/` correction - verify before writing). Replace the `expect(Service).toBeDefined()`-only assertions with real tests: extract the hall-conflict overlap check from `ExamMasterService.createExamSchedule` into a small pure, testable function if not already separable, and test it directly with overlapping/non-overlapping time ranges; test the seat-allocation capacity math directly; and add a focused test proving section-01's answer-ownership fix rejects a mismatched option/question pair (test the validation logic in isolation, not via a live HTTP call). Do not introduce DB-module mocking that produces false confidence (per the advanced-reporting remediation's documented lesson) - stick to genuinely pure, extractable logic.
  </action>
  <verify>Run the test suite and confirm all tests pass. Temporarily break one piece of extracted logic (e.g. flip a comparison operator in the conflict check) and confirm the corresponding test fails, then revert.</verify>
  <done>The test suite genuinely tests real, previously-fabricated-or-unverified logic, with a proven regression-catching capability.</done>
</task>
