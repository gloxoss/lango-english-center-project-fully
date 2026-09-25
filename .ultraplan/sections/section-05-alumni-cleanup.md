# Section 05: Alumni transition closes hostel and transport

## Overview
`transitionStudentToAlumni` (`lango-app/src/libs/services/alumni-transition.ts`) closes class placements and changes the role, but leaves active hostel allocations and transport allocations open, so a graduated student keeps a bed and a bus seat. Fees need no change: `fee_structure_assignments` are per class (tenantId, feeStructureId, classId), not per student.

## Risk: [yellow] Touches two other modules' tables inside one transaction.

## Dependencies
- Depends on: none (test needs 01) · Blocks: 13 · Batch 1 · Hub item: `task:up-05-alumni-cleanup`

## Tasks

<task type="auto" id="05-01">
  <name>End active hostel and transport allocations in the same transaction</name>
  <files>lango-app/src/libs/services/alumni-transition.ts</files>
  <action>
    Read the hostel allocation states (reserved, checked_in, ...) and the transport_allocation_status enum first. Reuse existing service functions if they accept a tx (hostel checkOut/cancel, transport end allocation) — do not duplicate their logic. If none accept a tx, do the minimal update in the existing tx:
    hostel_allocations: reserved → cancelled, checked_in → checked_out (set the end/checkout fields the check-out service sets) + one hostel_allocation_events row each.
    transport_student_allocations: active → ended/cancelled per the enum, end date = graduation date.
    Always filter by tenantId AND studentId. Skip if none are active (idempotent — the function is already idempotent for re-runs, keep it so).
    Note in the summary: the hostel check-out route has finance side effects (see its simulateFinanceFailure hook); decide whether graduation should trigger the same charge settlement — if unclear, only cancel/close and flag it for the owner.
  </action>
  <verify>New DB test on schoolos_audit: student with a checked_in bed and an active transport allocation → after transition both are closed; a second call changes nothing; another tenant's rows untouched. tsc 0.</verify>
  <done>A graduated student holds no bed and no bus seat.</done>
</task>

<task type="auto" id="05-02">
  <name>Confirm billing skips alumni (check only)</name>
  <files>none</files>
  <action>Read the invoice generation / fee allocation run code and confirm it only bills users with role 'student'. If it does not, reopen this section with the exact file:line.</action>
  <verify>Quote the filter line in the hub done note.</verify>
  <done>Proven that graduates are not billed.</done>
</task>
