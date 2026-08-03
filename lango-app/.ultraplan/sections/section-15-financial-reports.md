# Section 15: Financial Reports Aggregate

## Overview
`financial-reports-view.tsx` has module-level fake `INCOME_STATEMENT`/`BALANCE_SHEET` objects with literal amounts (e.g. 1240000, 612000). Real GL data exists (journalEntries, chartOfAccounts, payments, expenses, invoices) - this needs a real aggregate reporting route, following the same `Promise.all` aggregation pattern already used in `api/analytics/route.ts`.

## Risk: [yellow] - aggregate financial reporting must be arithmetically correct (a wrong income statement is worse than an honestly-missing one); reuses real GL data so gets it right by construction if it sums the same tables the ledger already balances

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: income statement total matches the sum of real journalEntryLines for the reporting period (not a separate re-derivation that could drift from the ledger)
- Test: balance sheet balances (assets = liabilities + equity) for a test tenant's real posted journal entries

## Tasks

<task type="auto" id="15-01">
  <name>Build /api/finance/reports/income-statement and /balance-sheet routes</name>
  <files>src/app/api/finance/reports/income-statement/route.ts (new), src/app/api/finance/reports/balance-sheet/route.ts (new)</files>
  <action>
    Both read from journalEntries/journalEntryLines joined to chartOfAccounts, grouped by account type (revenue/expense for income statement; asset/liability/equity for balance sheet), for a given fiscal period. Reuse the Promise.all aggregate pattern from api/analytics/route.ts. requireCapability(context, 'finance.read').
  </action>
  <verify>manually post a few real journal entries via the existing finance/journals route, confirm the report reflects them exactly, confirm balance sheet balances to zero</verify>
  <done>Both reports are real, derived directly from posted journal entries, provably balanced</done>
</task>

<task type="auto" id="15-02">
  <name>Wire financial-reports-view.tsx to the real routes, remove INCOME_STATEMENT/BALANCE_SHEET literals</name>
  <files>src/features/finance/ui/financial-reports-view.tsx</files>
  <action>Replace both hardcoded objects with real fetches to the two new routes. Remove any multi-campus comparison section if present (per this session's earlier finding that no campus/branch sub-entity concept exists for this kind of report) - check the current file content first since it may have already been touched by another agent since that finding.</action>
  <verify>tsc --noEmit clean; numbers match a manual sum of the same tenant's real journal entries</verify>
  <done>No hardcoded INCOME_STATEMENT/BALANCE_SHEET remain</done>
</task>
