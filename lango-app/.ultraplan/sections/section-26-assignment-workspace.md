# Section 26: Assignment workspace UI + coverage metrics

## Overview
One screen combining class/section/subject/teacher context - replacing the today-scattered class-teachers and subject-teachers pages with a single assignment workspace, plus coverage metrics (offerings without a primary teacher, subjects without an assigned teacher, overloaded teachers by workloadHours).

## Risk: [yellow] - UI-heavy, depends on both 24 and 25's backends being live

## Dependencies
- Depends on: section-24, section-25
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- Test: coverage metrics match a manual count against real offerings/classSubjects/classTeachers data
- Test: assigning a primary teacher through this UI produces the exact same result as calling the section-24 reassignment service directly

## Tasks

<task type="auto" id="26-01">
  <name>Coverage metrics endpoint</name>
  <files>src/app/api/academics/coverage/route.ts (new)</files>
  <action>
    GET, tenant-scoped, optional ?sessionYearId=: returns { offeringsWithoutPrimaryTeacher: [...], subjectsWithoutTeacher: [...], overloadedTeachers: [...] } - each computed with a real aggregate query (left join offerings to classTeachers where role='primary' and endsOn is null; left join classSubjects to subjectTeachers; teacher.workloadHours above a configurable threshold, reuse the existing workloadHours field rather than inventing a new one).
  </action>
  <verify>manual check against a real tenant with a deliberately-uncovered offering and subject</verify>
  <done>All three metrics return real, verifiable data</done>
</task>

<task type="auto" id="26-02">
  <name>Build the assignment workspace page</name>
  <files>src/features/academics/ui/assignment-workspace-view.tsx (new), src/app/[locale]/(dashboard)/dashboard/academics/assignments/page.tsx (new)</files>
  <action>
    Class/section/offering picker on the left, subject list with assigned-teacher inline editing in the middle, coverage metric cards at the top (from 26-01). Assigning a primary teacher calls the section-24 reassign endpoint; assigning a subject teacher calls the existing subject-teachers route. Bulk-copy affordance: reuse section-23's copy endpoint's per-offering breakdown as a "copy this offering's assignments to..." action, not a separate mechanism.
  </action>
  <verify>tsc --noEmit clean; full round-trip in the browser against a real tenant</verify>
  <done>One workspace covers class-teacher and subject-teacher assignment with live coverage metrics</done>
</task>
