# Section 01: Fix Live Online-Exam Security Bugs

## Overview
Fixes the two real, live-reachable security bugs in the online-exam system students actually use today: answer-ownership is never verified (score forgery), and no per-attempt deadline is ever enforced. Also wraps scoring in a transaction and adds role/audience scoping to the GET route.

## Risk: red - a live system real students use for real exam scores

## Dependencies
- Depends on: none
- Blocks: section-06
- Parallel batch: 1

## TDD Test Stubs
- Test: Submitting a correct `selectedOptionId` that belongs to a different question than the one being answered is rejected as incorrect, not scored as correct.
- Test: A submission made after the exam's real per-attempt deadline is rejected.
- Test: Scoring and answer insertion happen atomically - a mid-write failure leaves no partial answers.
- Test: A student cannot see another student's/class's online exam via the GET route.

## Tasks

<task type="auto" id="01-01">
  <name>Fix answer-ownership validation and wrap submission in a transaction</name>
  <files>src/app/api/academics/online-exams/submit/route.ts</files>
  <action>
    Read the file in full. Fix the scoring logic so a submitted `selectedOptionId`'s `isCorrect` is only trusted after confirming that option actually belongs to the submitted `questionId` (join/filter on both, not `isCorrect` alone). Wrap the score-computation and answer-insertion sequence in a single `db.transaction()`, matching the transaction pattern already used correctly elsewhere in this codebase (e.g. alumni-portal or advanced-reporting work earlier this session).
  </action>
  <verify>Submit a request pairing a real question ID with a correct-option ID borrowed from a different question and confirm it is NOT scored as correct.</verify>
  <done>Answer scoring is verified against the actual submitted question, and the whole submission is atomic.</done>
</task>

<task type="auto" id="01-02">
  <name>Enforce a real per-attempt deadline</name>
  <files>src/app/api/academics/online-exams/submit/route.ts, src/app/api/academics/online-exams/route.ts</files>
  <action>
    Read `onlineExams`/`onlineExamAttempts`'s real columns in `src/models/Schema.ts` to find what timing data already exists (`startsAt`/`endsAt`/`durationMinutes` or similar on `onlineExams`, and any per-attempt `startedAt` on `onlineExamAttempts`). Compute a real deadline as `min(exam.endsAt, attemptStartedAt + exam.durationMinutes)` and reject a submission past that deadline with a clear error, instead of only checking `endsAt`. If no per-attempt `startedAt` is recorded anywhere today, add setting it when an attempt truly begins (check whether a "start attempt" action already exists to hook this into, or add the minimum needed to record it - keep this as small as the existing system allows, do not build a new state machine).
  </action>
  <verify>Simulate a submission after the real per-attempt deadline (not just after `endsAt`) and confirm it is rejected.</verify>
  <done>A real, per-attempt deadline is computed and enforced, not just the exam's overall end time.</done>
</task>

<task type="auto" id="01-03">
  <name>Add role/audience scoping to the online-exams GET route</name>
  <files>src/app/api/academics/online-exams/route.ts</files>
  <action>
    Read the file in full. The GET handler currently scopes by tenant only. Add role-based filtering matching the pattern established for homework in section-02: a student only sees exams actually assigned to them (via whatever real audience/class linkage `onlineExams` has - check its schema columns), while teacher/admin see the full tenant list as before.
  </action>
  <verify>As a student, confirm the exam list excludes exams not assigned to their class/section.</verify>
  <done>The online-exams list route is properly audience-scoped, not just tenant-scoped.</done>
</task>
