# Section 01: Homework Submissions

## Overview
`homework-submission-view.tsx` currently fails `tsc` (MOCK_SUBMISSIONS objects missing the required `maxScore` field) and has zero backend wiring. No dedicated homework-submission API exists yet — `academics/assignments/{grade,submit}` is a related but different domain (assignment grading, not submission review/listing). This section fixes the compile error and builds the missing backend.

## Risk: [red] - currently broken (won't build), plus new backend design needed

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 1

## TDD Test Stubs
- Test: GET /api/homework/submissions?assignmentId= returns only submissions for that tenant's assignment, 404s on cross-tenant assignmentId
- Test: PATCH /api/homework/submissions/[id] (grade a submission) rejects a score above the assignment's maxScore
- Test: teacher role can grade; student/parent roles get 403 on the grade endpoint

## Tasks

<task type="auto" id="01-01">
  <name>Design and migrate homework_submissions review fields if missing</name>
  <files>migrations/00XX_add_homework_submission_review.sql (new, next available number), src/models/Schema.ts</files>
  <action>
    Check `assignmentSubmissions` table in Schema.ts first - it may already have score/feedback/status columns from the existing assignments/grade route. If so, skip this task entirely (note in the section that no migration was needed). Only add a migration if a genuinely new field is required for the submission-review UI (e.g. a reviewedAt timestamp) that doesn't already exist.
  </action>
  <verify>docker compose run migrate applies cleanly; drizzle-kit check passes</verify>
  <done>Schema supports whatever fields the UI in task 01-03 actually needs, confirmed against existing assignmentSubmissions columns first</done>
</task>

<task type="auto" id="01-02">
  <name>Build GET/PATCH /api/homework/submissions route</name>
  <files>src/app/api/homework/submissions/route.ts (new)</files>
  <action>
    Follow the established pattern (see src/app/api/academics/assignments/grade/route.ts for the closest existing analog). GET lists assignmentSubmissions for a given assignmentId, tenant-scoped, joined to student name. PATCH grades one submission (score, feedback), validating score <= assignment.maxScore, restricted to school_admin+teacher via requireRequestContext, then requireCapability(context, 'grading.manage') matching this session's existing convention for grading-adjacent routes.
  </action>
  <verify>curl the route manually against a real tenant/assignment; confirm tenant isolation via scripts/check-tenant-isolation.ts</verify>
  <done>Route returns real DB rows, rejects cross-tenant access, rejects over-max scores</done>
</task>

<task type="auto" id="01-03">
  <name>Fix compile error and wire homework-submission-view.tsx to the real route</name>
  <files>src/features/homework/ui/homework-submission-view.tsx</files>
  <action>
    Remove MOCK_SUBMISSIONS entirely. Add a real fetch to GET /api/homework/submissions?assignmentId= on mount, replacing the useState&lt;SubmissionItem|null&gt;(MOCK_SUBMISSIONS[0]) initializer with useState&lt;SubmissionItem|null&gt;(null) and populating from the fetch response. Wire the grade/feedback save action to PATCH the new route instead of only updating local state.
  </action>
  <verify>tsc --noEmit clean; page loads with a real assignment's real submissions for a fresh tenant (empty list, not mock rows)</verify>
  <done>No MOCK_SUBMISSIONS reference remains; grading a submission persists and survives a page reload</done>
</task>
