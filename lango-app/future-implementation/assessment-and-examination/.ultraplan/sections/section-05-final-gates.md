# Section 05: Final Gates

## Overview
The closing gate pass over the entire M13 de-mock: type-check, unit tests, tenant-isolation, live HTTP against a real tenant plus a second-tenant adversarial sweep, and a production build. Nothing is trusted as done until it is exercised against the real running app and real database for two tenants.

## Risk: green — verification only; any failing gate is a fix against the sections it caught, not new feature work.

## Dependencies
- Depends on: 01, 02, 03, 04 (all)
- Blocks: none (final section)
- Parallel batch: 3

## TDD Test Stubs
- Test: `npx tsc --noEmit` exits 0.
- Test: the assessment unit suite (`src/features/assessment/__tests__/assessment.test.ts`, 11 cases) passes.
- Test: every touched route keeps `school_id`/tenant scoping; a second tenant cannot read or write the first tenant's exams/homework/marks.

## Tasks

<task type="auto" id="05-01">
  <name>Type-check gate</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/online-exams/page.client.tsx, src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx, src/app/[locale]/(dashboard)/dashboard/academics/assessment/exam-master/page.client.tsx</files>
  <action>
    Run `npx tsc --noEmit` and resolve every error attributable to the M13 edits (unused imports/state orphaned by the mock removals, field-name mismatches against the route DTOs). Do not chase pre-existing errors unrelated to these three pages.
  </action>
  <verify>`npx tsc --noEmit` exits 0 with no errors in the three touched files.</verify>
  <done>Type-check is clean.</done>
</task>

<task type="auto" id="05-02">
  <name>Unit-test gate</name>
  <files>src/features/assessment/__tests__/assessment.test.ts</files>
  <action>
    Run the assessment unit suite (`vitest` scoped to `assessment.test.ts`, expected 11 `it()` cases). Confirm hall-overlap conflict detection, deterministic seat allocation, and homework audience scoping all pass. No M13 UI edit should touch these service tests; if a shared type/field rename from sections 01–03 broke a test, fix the rename at its source.
  </action>
  <verify>11/11 assessment unit cases pass.</verify>
  <done>Unit suite green.</done>
</task>

<task type="auto" id="05-03">
  <name>Tenant-isolation gate</name>
  <files>src/app/api/academics/online-exams/route.ts, src/app/api/academics/homework/route.ts, src/app/api/academics/exam-terms/route.ts</files>
  <action>
    Re-run the tenant-isolation checker against the online-exams and homework routes exercised by this pass. Confirm every query is `school_id`/tenant-scoped and no client-supplied id can cross tenant boundaries (the online-exams submit route derives the student from session, never from a client `studentId`).
  </action>
  <verify>Isolation check reports no new cross-tenant reads/writes on the touched routes.</verify>
  <done>Multi-tenant scoping holds.</done>
</task>

<task type="auto" id="05-04">
  <name>Live HTTP + two-tenant adversarial sweep</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/online-exams/page.client.tsx, src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx, src/app/[locale]/(dashboard)/dashboard/academics/assessment/exam-master/page.client.tsx</files>
  <action>
    Against a real running app: (1) online-exams — create an exam, add a question with options, submit an attempt, confirm the score equals the DB row and the page shows no hardcoded counts/names; (2) homework — confirm empty state with zero rows, create + grade round-trip; (3) exam-master — create term/hall/schedule/seat-allocation, confirm persistence. Then repeat the create/read checks under a second tenant and confirm none of the first tenant's rows are visible.
  </action>
  <verify>All three pages round-trip against tenant A; tenant B sees only its own data with zero leakage.</verify>
  <done>Live two-tenant sweep passes.</done>
</task>

<task type="auto" id="05-05">
  <name>Production build + tracker/memory close-out</name>
  <files>MASTER_ROADMAP_AND_TRACKER.md</files>
  <action>
    Run `npx next build` and require exit 0. Then mark M13 done in the tracker, update the memory index (assessment de-mock status), and write a one-paragraph close-out in the feature folder noting what changed (three pages de-mocked, docs corrected) and what was verified (gates above).
  </action>
  <verify>`npx next build` exits 0; tracker + memory reflect M13 complete.</verify>
  <done>Build green and the record is closed out.</done>
</task>
