# Section 17: Homework View (list)

## Overview
`homework-view.tsx` (distinct from `homework-submission-view.tsx` in Section 01) shows `MOCK_HOMEWORK`. No dedicated homework-listing API exists - `academics/assignments` (list/create) is the closest real backend and is likely exactly what this page needs, but confirm the two aren't meant to be genuinely different concepts before assuming reuse.

## Risk: [yellow] - depends on a judgment call (reuse assignments API vs. this being a distinct "homework" concept); resolve that before writing code, don't guess silently

## Dependencies
- Depends on: none (independent of Section 01's submission-review work)
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (Reuses an already-tested route if the reuse decision goes that way; no new test needed in that case.)

## Tasks

<task type="auto" id="17-01">
  <name>Determine whether homework-view.tsx is the same domain as academics/assignments</name>
  <files>src/features/homework/ui/homework-view.tsx (read), src/app/api/academics/assignments/route.ts (read)</files>
  <action>
    Compare the shape of MOCK_HOMEWORK's fields against what assignments/route.ts already returns. If they match closely (title, dueDate, classSubjectId, maxScore), this is the same concept under a different UI - wire directly to the existing route, no new backend. If homework-view represents something genuinely different (e.g. a student-facing "my homework across all subjects" aggregate rather than a teacher's per-class assignment list), that's still servable by the same underlying table with a different query shape, not a new table - build a query variant, not a new domain.
  </action>
  <verify>read-only comparison task</verify>
  <done>Clear decision recorded in this section file before task 17-02 starts</done>
</task>

<task type="auto" id="17-02">
  <name>Wire homework-view.tsx to the real route, remove MOCK_HOMEWORK</name>
  <files>src/features/homework/ui/homework-view.tsx</files>
  <action>Based on task 17-01's finding, fetch real data from academics/assignments (possibly with a new query param for the aggregate case) and remove MOCK_HOMEWORK entirely.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_HOMEWORK reference remains</done>
</task>
