# Section 03: Exam Master Verification

## Overview
Exam Master is already fully wired (real term/hall/schedule/seat-allocation/marksheet routes). This section verifies it end-to-end against a real tenant and applies one minor UX improvement: the marksheet tab requires a free-text `assessmentDefinitionId` UUID, which should be a real dropdown if definitions are listable.

## Risk: green — verification + one low-risk UI improvement.

## Dependencies
- Depends on: none
- Blocks: section-05
- Parallel batch: 2

## TDD Test Stubs
- Test: loading the page shows real exam terms/halls from the database.
- Test: seat allocation and marksheet save persist against a real tenant.

## Tasks

<task type="auto" id="03-01">
  <name>Verify the already-wired Exam Master page against a real tenant</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/exam-master/page.client.tsx</files>
  <action>
    Confirm the page renders real terms/halls/schedules from `GET /api/academics/exam-*` and that `POST` seat-allocation, marksheet, schedule, term, and hall all persist. Do not rewrite working code; only fix a discovered field-name mismatch if one exists.
  </action>
  <verify>Create a term, a hall, a schedule, and a seat allocation against a real tenant; each persists and reloads.</verify>
  <done>Exam Master is confirmed real end-to-end.</done>
</task>

<task type="auto" id="03-02">
  <name>Replace the free-text assessmentDefinitionId with a real dropdown (if listable)</name>
  <files>src/app/[locale]/(dashboard)/dashboard/academics/assessment/exam-master/page.client.tsx</files>
  <action>
    Determine whether an assessment-definition listing endpoint exists. If so, fetch it and replace the `assessmentDefinitionId` text input with a select; if no listing route exists, leave the input but add a clearer label/helper text. This is UX-only and must not change the marksheet POST payload shape.
  </action>
  <verify>The marksheet save still works with the selected definition; no route contract change.</verify>
  <done>The marksheet tab is either dropdown-driven or clearly labeled, with the save flow unchanged.</done>
</task>
