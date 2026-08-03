# Section 10: Student Transfers Wiring

## Overview
`student-transfers-view.tsx` is entirely static JSX - hardcoded `<SelectItem>` options with literal names ("Yassine Alami", "Atlas Californie"), literal capacity-impact numbers, and the primary submit button has no onClick at all. The real backend (`api/students/transfers`, `api/students/promotions` + `/preview`) already exists and was verified real this session - this is pure frontend wiring, the highest-value/lowest-effort item in this whole plan.

## Risk: [green] - backend fully exists and is already tested; frontend-only wiring

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- (Backend already tested this session - no new automated test needed, frontend-only fix.)

## Tasks

<task type="auto" id="10-01">
  <name>Replace hardcoded student/class selects with real data</name>
  <files>src/features/students/ui/student-transfers-view.tsx</files>
  <action>
    Replace the hardcoded student `<SelectItem>` list with a real fetch to /api/students (search-as-you-type or a simple list, matching the pattern used elsewhere for student pickers). Replace the hardcoded target-class list with a real fetch to /api/academics/classes or class-sections.
  </action>
  <verify>tsc --noEmit clean; dropdowns show real tenant students/classes, not "Yassine Alami"/"Atlas Californie"</verify>
  <done>No hardcoded SelectItem literals remain</done>
</task>

<task type="auto" id="10-02">
  <name>Wire capacity-impact preview and the submit button to real endpoints</name>
  <files>src/features/students/ui/student-transfers-view.tsx</files>
  <action>
    Replace the literal capacity-impact numbers with a real call to the transfers route's existing capacity soft-check (or a lightweight preview call if the POST route supports a dry-run mode - check the route first). Give "Valider et exécuter le transfert" a real onClick that POSTs to /api/students/transfers with proper loading/error/success states.
  </action>
  <verify>tsc --noEmit clean; executing a real transfer through the UI actually moves a test student and the transfer shows up via the students API afterward</verify>
  <done>Button performs a real, persisted transfer; capacity warning reflects real enrollment counts</done>
</task>
