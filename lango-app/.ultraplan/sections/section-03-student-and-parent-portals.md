# Section 03: 5B Student & Parent/Guardian Portals

## Overview
Build Student Portal (`/dashboard/student`) for learner self-service and Parent Portal (`/dashboard/parent`) featuring multi-child context switcher, academic progress timeline, attendance alerts, exam results, and tuition fee invoice breakdown.

## Risk: [yellow] - Requires strict guardian-student relationship authorization.

## Dependencies
- Depends on: Section 01
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- Test: verifies parent can only view data for explicitly linked children in guardian_students.
- Test: verifies multi-child context switcher toggles active student view cleanly.

## Tasks

<task type="auto" id="03-01">
  <name>Build Parent Multi-Child Context Switcher Header Component</name>
  <files>src/components/parent/ChildContextSwitcher.tsx, src/libs/api/parent-context.ts</files>
  <action>
    Create header dropdown displaying linked children from guardian_students table and storing activeChildId in session/context.
  </action>
  <verify>Selecting a child updates active child context and reloads child data</verify>
  <done>Parent header allows seamless multi-child switching</done>
</task>

<task type="auto" id="03-02">
  <name>Build Student & Parent Academic Timeline & Marks View</name>
  <files>src/app/[locale]/(dashboard)/student/page.tsx, src/app/[locale]/(dashboard)/parent/page.tsx, src/components/student/AcademicTimeline.tsx</files>
  <action>
    Build schedule overview, attendance history summary, homework assignments list, and Moroccan /20 exam bulletin card.
  </action>
  <verify>Navigating to student/parent page displays student academic records</verify>
  <done>Learners and parents can view schedules, attendance, and exam bulletins</done>
</task>

<task type="auto" id="03-03">
  <name>Build Parent Financial & Invoice Breakdown View</name>
  <files>src/components/parent/ParentInvoiceBreakdown.tsx, src/app/api/parent/invoices/route.ts</files>
  <action>
    Build invoice breakdown card showing fee structure, paid amount, remaining balance, and downloadable PDF receipts.
  </action>
  <verify>Invoice list accurately reflects payments and remaining balance</verify>
  <done>Parents can view fee invoices and download payment receipts</done>
</task>
