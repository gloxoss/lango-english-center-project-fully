# Section 02: De-Mock Homework

## Overview
The homework page is a hybrid: it fetches the real `GET /api/academics/homework` list but seeds two hardcoded `hw-demo-*` items, shows hardcoded stat figures ("88%", "100% upload"), and ships a student-submit flow that posts `studentId: 'student-demo'`. Remove the fiction and keep the real teacher flows (create, grade) which already post to real routes.

## Risk: yellow — removing the student-submit flow is a product judgment; the student-facing homework UI belongs in the student portal (out of scope).

## Dependencies
- Depends on: none
- Blocks: section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: with an empty API result, the page renders the empty state with zero rows (no demo seed).
- Test: no code path posts `studentId: 'student-demo'`.
- Test: creating and grading a homework still round-trips through the real routes.

## Tasks

<task type="auto" id="02-01">
  <name>Remove the hardcoded demo homework seed and stat figures</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx</files>
  <action>
    Delete the two `hw-demo-*` seed objects and the `useState<HomeworkItem[]>([...])` initial array; initialize to `[]`. Replace the hardcoded KPI figures ("88%", "100% upload") with values computed from the real fetched list (e.g. total = list length, awaiting-grading = count of `submission.status === 'submitted'`, graded = count of `'graded'`). Keep the `GET /api/academics/homework` fetch, but stop appending `...prev` seed rows and stop fabricating `className`/`sectionName`/`submissionCount` when the API omits them — render only what the API returns.
  </action>
  <verify>With no real homework rows, the page shows the empty state and KPI cards read 0, with no `hw-demo-*` strings anywhere in the file.</verify>
  <done>The page is empty-seeded and its KPIs derive from real data.</done>
</task>

<task type="auto" id="02-02">
  <name>Remove the fake student-submit flow</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx</files>
  <action>
    Delete the student-submit modal, the "Rendre" button, and `handleStudentSubmit` (which posts `studentId: 'student-demo'`). This is a teacher-facing page; student submission is owned by the student portal. Keep the teacher "Créer un Devoir" and "Corriger" flows, which post to `/api/academics/homework` and `/api/academics/homework/[id]/grade` respectively and are already real. Remove now-unused imports/state made orphaned by this deletion.
  </action>
  <verify>Grep confirms `student-demo` and the submit route call are gone from the file; `tsc` is clean with no unused-variable errors.</verify>
  <done>The teacher page no longer contains a student-submit action.</done>
</task>

<task type="auto" id="02-03">
  <name>Verify the teacher create/grade flows against a real tenant</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/homework/page.client.tsx</files>
  <action>
    Exercise the remaining flows against a real tenant: create a homework via the modal (confirm it persists to `GET /api/academics/homework`), then grade an existing submission via the correction drawer (confirm the score persists). Fix any field-name mismatches between the UI payload and the route contract discovered during this check.
  </action>
  <verify>Create and grade both round-trip through the real routes and survive a reload.</verify>
  <done>The teacher homework page is fully real: list, create, and grade.</done>
</task>
