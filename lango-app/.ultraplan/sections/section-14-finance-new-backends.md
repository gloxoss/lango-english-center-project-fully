# Section 14: Finance — New Backends

## Overview
Two finance pages with no matching API at all: `reminders-statements-view.tsx` (MOCK_REMINDERS, no dunning/reminders API), `fee-allocation-view.tsx` (hardcoded fee-rule array, no fee-allocation-specific API - note this is distinct from the real `paymentAllocations` table already used by finance/payments, which allocates a *payment* across invoices; this page appears to be about allocating *fee structures* to student groups, a different concept).

## Risk: [yellow] - new backend design, money-adjacent (reminders touch guardian communication/SMS, fee-allocation touches what students owe)

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: fee-allocation assignment respects tenant isolation and doesn't let one tenant's fee structure apply to another tenant's class
- Test: triggering a reminder writes a real smsMessages row (log-only, matching this app's established honest-simulation SMS convention) rather than claiming a real SMS was sent

## Tasks

<task type="auto" id="14-01">
  <name>Build fee-structure-to-class-group assignment backend</name>
  <files>migrations/00XX_add_fee_structure_assignments.sql (new), src/models/Schema.ts, src/app/api/finance/fee-assignments/route.ts (new)</files>
  <action>
    New table feeStructureAssignments: tenantId, feeStructureId (FK), classId or classSectionId (FK), effectiveDate. GET/POST/DELETE route, requireCapability(context, 'finance.approve') matching the fee-structures precedent from Section 13. This determines which students owe which fee structure - keep it simple (class-level assignment, not per-student overrides, unless the mock UI clearly shows per-student - check first).
  </action>
  <verify>manual curl round-trip; tenant isolation check</verify>
  <done>Real, tenant-scoped fee-to-class assignment exists</done>
</task>

<task type="auto" id="14-02">
  <name>Wire fee-allocation-view.tsx to the new route, remove hardcoded fee-rule array</name>
  <files>src/features/finance/ui/fee-allocation-view.tsx</files>
  <action>Replace the hardcoded array with a real fetch/wire to task 14-01's route.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No hardcoded fee-rule array remains</done>
</task>

<task type="auto" id="14-03">
  <name>Build a payment-reminders route reusing the existing SMS log-only pattern</name>
  <files>src/app/api/finance/reminders/route.ts (new)</files>
  <action>
    GET lists overdue invoices (invoices where dueDate < now and status != 'paid'), tenant-scoped. POST triggers a reminder: inserts a real smsMessages row per the established log-only convention (see attendance's absence-SMS code for the exact pattern to copy), resolving the guardian phone the same way (primary contact first, fallback to any linked guardian).
  </action>
  <verify>triggering a reminder produces a real smsMessages row with correct tenant/recipient</verify>
  <done>Real overdue-invoice list, real (log-only) reminder dispatch</done>
</task>

<task type="auto" id="14-04">
  <name>Wire reminders-statements-view.tsx to the new route, remove MOCK_REMINDERS</name>
  <files>src/features/finance/ui/reminders-statements-view.tsx</files>
  <action>Replace MOCK_REMINDERS with a real fetch/wire to task 14-03's route.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_REMINDERS reference remains</done>
</task>
