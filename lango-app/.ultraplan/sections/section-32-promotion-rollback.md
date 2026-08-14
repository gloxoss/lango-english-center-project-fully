# Section 32: Promotion rollback

## Overview
The doc's explicit requirement: "permissioned rollback only while no dependent records exist in the target session; otherwise use a corrective transfer." The ledger (`promotion_batches`/`promotion_decisions`) shipped earlier this session already carries everything a rollback needs - this section adds the dependency-scan + revert action on top of it, no new ledger tables.

## Risk: [yellow] - correctness-sensitive (must never revert a batch that already has real downstream activity against it), but self-contained: one new endpoint, reuses existing tables

## Dependencies
- Depends on: none (the ledger it operates on already exists)
- Blocks: none
- Parallel batch: 4

## TDD Test Stubs
- Test: a batch with zero downstream activity (no attendance/grades/invoices recorded against the new placement) reverts cleanly - each decision's placement is closed, the predecessor placement is reopened (isCurrent=true, endDate cleared), user.classSectionId reverts
- Test: a batch where even one student has downstream activity (an attendance record, a grade, an invoice) recorded after the promotion is rejected entirely (409), not partially reverted
- Test: a reverted batch's status becomes 'reverted', and re-attempting revert on an already-reverted batch is rejected (idempotent-safe, not a repeatable action)
- Test: only school_admin with students.placements.manage can revert - this capability already exists with a description that literally says "rollback", confirmed during Research

## Tasks

<task type="auto" id="32-01">
  <name>Dependency-scan helper</name>
  <files>src/libs/services/student-placement.ts</files>
  <action>
    Add `hasDownstreamActivity(tenantId, placementId, studentId, sinceDate)`: checks for any attendance record, assessmentResult, or invoice created for that student on or after the placement's startDate (using each table's own tenantId+studentId+createdAt/date columns - no new schema needed, this is a read-only check against existing tables). Returns true if anything is found.
  </action>
  <verify>unit-style manual check: promote a student, add a real attendance record for them, confirm the helper returns true; promote a different student with no activity, confirm false</verify>
  <done>Accurate, conservative (false positives are safe, false negatives are not) downstream-activity detection</done>
</task>

<task type="auto" id="32-02">
  <name>POST /api/students/promotions/[batchId]/revert</name>
  <files>src/app/api/students/promotions/[batchId]/revert/route.ts (new)</files>
  <action>
    requireCapability 'students.placements.manage'. Load the batch and its decisions; reject if status is already 'reverted'. For every decision, run 32-01's dependency scan on the decision's resulting placement - if ANY student in the batch has downstream activity, reject the whole request with 409 and the list of blocking students (all-or-nothing, matching this session's established transaction-safety judgment calls elsewhere). If clean: for each decision with a placementId, in one transaction per student (same advisory-lock pattern as recordStudentPlacement), close that placement and reopen its predecessor (promotedFromPlacementId) as current; for 'graduate'/'transfer'/'withdraw' decisions that only closed a placement (no new one opened), simply reopen the closed placement instead. Finally set the batch's status='reverted', revertedAt=now().
  </action>
  <verify>manual test: revert a clean batch, confirm studentPlacements/user.classSectionId return to their pre-promotion state; attempt revert on a batch with real downstream activity, confirm 409 and zero rows changed</verify>
  <done>Rollback is all-or-nothing, safe, and leaves an accurate audit trail (batch status, not a deleted row)</done>
</task>
