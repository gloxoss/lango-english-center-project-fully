# Section 08: Real Test Suite

## Overview
Unit tests for the pure, directly-reused functions this addon introduces — same discipline as every other test suite written this session: no mocking of the `db` module, no `expect(Service).toBeDefined()` stubs. Every tested function is the exact function the real routes call, not a duplicate.

## Risk: [green] - the functions under test are already pure by construction (sections 04 and 05 were deliberately written to extract them)

## Dependencies
- Depends on: section-04, section-05
- Blocks: section-09
- Parallel batch: 4 (parallel with section-06)

## TDD Test Stubs
- (see section-04 and section-05's TDD Test Stubs — this section implements exactly those)

## Tasks

<task type="auto" id="08-01">
  <name>Write attachments.test.ts</name>
  <files>src/features/attachments/__tests__/attachments.test.ts</files>
  <action>
    Import `isAssetVisibleToUser` from `../services/targeting-service` and `nextVersionNumber`'s pure-computation shape (if `nextVersionNumber` is written as a real DB call inside `AssetService`, extract the "given N existing version numbers, the next one is max+1" arithmetic into a tiny pure helper the DB-calling version delegates to, matching how `doTimeRangesOverlap` was extracted from `createExamSchedule` in the prior remediation — do not leave version-numbering untested just because the real function touches the DB).

    Write real tests (not stubs) for:
    - broadcast asset (no targets) visible to any role
    - explicit `'school'` target visible to any role (assert this is a genuinely different code path than the empty-array case, per section-04's task 04-01 note — both should return true from independent test cases)
    - `'role'` target only matches the exact role string
    - `'user'`/`'class_section'`/`'class_subject'`/`'class_offering'` targets match the same way the already-tested `isHomeworkVisibleToStudent` cases do (mirror those 4 existing test cases from `src/features/assessment/__tests__/assessment.test.ts` structurally, adapted to this function's shape)
    - `studentVisible: false` blocks a student regardless of any matching target (the answer-key/staff-only gate) — this is the one behavior with no homework-service precedent, so give it at least 2 cases (blocked-for-student, still-visible-for-teacher-with-same-targets)
    - version-numbering: empty existing list → 1; `[1,2,3]` existing → 4; a gap like `[1,3]` (shouldn't normally happen given the transaction, but the pure function should still just do max+1 → 4, not try to fill the gap — document this as the deliberate simple behavior)
  </action>
  <verify>Run `vitest run` for this file — all tests pass. Deliberately break `isAssetVisibleToUser`'s `studentVisible` short-circuit (e.g. comment it out), confirm the 2 staff-only-gate tests fail, then revert and confirm all tests pass again — the same real regression-proof exercise performed twice already this session for `isPayrollGroupMasked` and `doTimeRangesOverlap`.</verify>
  <done>attachments.test.ts exists with real tests for every pure function this addon introduces, regression-proof demonstrated and reverted cleanly.</done>
</task>
