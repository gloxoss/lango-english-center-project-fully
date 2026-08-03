# Section 13: Finance Views — Existing Backends

## Overview
Five finance pages with hardcoded arrays, all with real backends already built this session: `bank-reconciliation-view.tsx` (api/finance/bank-reconciliation), `journal-explorer-view.tsx` (api/finance/journals), `chart-of-accounts-view.tsx` (api/finance/chart-of-accounts), `online-payments-view.tsx` (api/finance/payments + sandbox), `pricing-structures-view.tsx` (api/finance/fee-structures).

## Risk: [green] - all backends exist, tested, GL-integrated already

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (Backends already tested this session - frontend-only wiring.)

## Tasks

<task type="auto" id="13-01">
  <name>Wire bank-reconciliation-view.tsx</name>
  <files>src/features/finance/ui/bank-reconciliation-view.tsx</files>
  <action>Remove MOCK_BANK_ITEMS, fetch/wire to api/finance/bank-reconciliation.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_BANK_ITEMS reference remains</done>
</task>

<task type="auto" id="13-02">
  <name>Wire journal-explorer-view.tsx</name>
  <files>src/features/finance/ui/journal-explorer-view.tsx</files>
  <action>Remove MOCK_JOURNAL, fetch/wire to api/finance/journals.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_JOURNAL reference remains</done>
</task>

<task type="auto" id="13-03">
  <name>Wire chart-of-accounts-view.tsx</name>
  <files>src/features/finance/ui/chart-of-accounts-view.tsx</files>
  <action>Remove MOCK_ACCOUNTS, fetch/wire to api/finance/chart-of-accounts.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_ACCOUNTS reference remains</done>
</task>

<task type="auto" id="13-04">
  <name>Wire online-payments-view.tsx</name>
  <files>src/features/finance/ui/online-payments-view.tsx</files>
  <action>Remove MOCK_PAYMENTS, fetch/wire to api/finance/payments (+ sandbox for the test-gateway flow if this page is the sandbox demo surface - check the page's intent first, don't assume).</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_PAYMENTS reference remains</done>
</task>

<task type="auto" id="13-05">
  <name>Wire pricing-structures-view.tsx</name>
  <files>src/features/finance/ui/pricing-structures-view.tsx</files>
  <action>Remove MOCK_FEES, fetch/wire to api/finance/fee-structures. Note: this session's earlier wiring pass deliberately used finance.approve (not finance.manage) for fee-structures POST/PUT/DELETE specifically to avoid widening accountant's access - preserve that distinction in the frontend's error handling (a 403 here for an accountant is expected behavior, not a bug).</action>
  <verify>tsc --noEmit clean; confirm accountant role sees a sensible permission-denied state, not a broken UI, when attempting to create a fee structure</verify>
  <done>No MOCK_FEES reference remains; accountant's expected 403 is handled gracefully in the UI</done>
</task>
