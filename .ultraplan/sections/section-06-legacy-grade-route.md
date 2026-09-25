# Section 06: Retire the legacy grade route

## Overview
`/api/academics/assessments` (GET/POST) writes the legacy `assessment_results` table. No screen calls it (only `src/app/api/__tests__/grade-entry-route.test.ts`). Its plans have no exam-term link, so a term lock cannot be added. All real grading goes through `/api/academics/grade-entry` and the exam-term marksheet. Delete it.

## Risk: [green] Deletion. Gate: owner decision D4.

## Dependencies
- Depends on: D4 · Blocks: none · Batch 1 · Hub item: `task:up-06-legacy-grades`

## Tasks

<task type="auto" id="06-01">
  <name>Prove nothing calls it, then delete route and its test</name>
  <files>lango-app/src/app/api/academics/assessments/route.ts, lango-app/src/app/api/__tests__/grade-entry-route.test.ts</files>
  <action>
    grep the whole repo (src, scripts, tests, e2e, docs of API consumers, mobile apps if any) for "api/academics/assessments" excluding the route and its test. If anything calls it, stop and report.
    Otherwise delete both files. Keep the assessment_results table (read by report cards). Remove the route line from any API index/docs that lists it (AGENTS.md lists "GET|POST /api/academics/assessments").
  </action>
  <verify>grep returns nothing; tsc 0; npm run check:isolation passes; npm run check:ui passes.</verify>
  <done>One grading path fewer, no unguarded write left.</done>
</task>
