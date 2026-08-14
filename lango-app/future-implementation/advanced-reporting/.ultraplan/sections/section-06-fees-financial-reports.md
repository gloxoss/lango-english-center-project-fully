# Section 06: Fees & Financial Domain Adapters

## Overview
This section builds query adapters for 4 Fees Reports (Fees Summary, Receipts Ledger, Due Fees Receivables Aging, Fine Log) and 5 Financial Reports (Account Statement, Income/Expense Ledger, Transactions Log, Balance Sheet, Income vs Expense Trends).

## Risk: yellow - Accounting reconciliation & double-entry validation
Financial statement queries must enforce Assets = Liabilities + Equity and calculate receivables aging as-of specific historical dates without relying on mutable current status labels.

## Dependencies
- **Depends on:** section-02, section-03
- **Blocks:** section-09 (verification)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: `FeesAdapter.getDueAgingReport()` calculates historical aging buckets (Current, 1-30, 31-60, 61-90, 90+) as of chosen date.
- Test: `FinancialAdapter.getBalanceSheetReport()` enforces equation Assets = Liabilities + Equity.
- Test: Excludes reversed receipts from net totals while retaining them in audit mode.
- Test: Excludes unposted draft journal vouchers from financial statement calculations.

## Tasks

<task type="auto" id="06-01">
  <name>Build Fees Domain Query Adapter</name>
  <files>src/addons/advanced-reporting/adapters/fees-adapter.ts</files>
  <action>
    Create `FeesAdapter` executing queries for:
    1. `fees.summary`: Invoiced charges, fee structures, discounts, collections, and outstanding balances.
    2. `fees.receipts`: Posted payment receipts by cashier, payment method, student, and reversal state (excluding reversed from net).
    3. `fees.due_aging`: Historical receivables aging buckets as of chosen date with guardian contact route.
    4. `fees.fines`: Assessed, waived, paid, and outstanding fines with approver audit trail.
  </action>
  <verify>Run unit tests verifying historical as-of calculation logic.</verify>
  <done>FeesAdapter operational with accounting control reconciliation.</done>
</task>

<task type="auto" id="06-02">
  <name>Build Fees Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/fees-reports-view.tsx</files>
  <action>
    Build UI component for Fees domain reports, rendering collection progress bars, aging chart distribution, and cashier receipt totals.
  </action>
  <verify>Check receipt reversal filter toggle in UI.</verify>
  <done>Fees reports UI component integrated with workspace.</done>
</task>

<task type="auto" id="06-03">
  <name>Build Financial Domain Query Adapter</name>
  <files>src/addons/advanced-reporting/adapters/financial-adapter.ts</files>
  <action>
    Create `FinancialAdapter` executing queries for:
    1. `finance.statement`: Account/party statement with opening balance, debits, credits, and running balance.
    2. `finance.income_expense`: Posted income and expense accounts by period and account hierarchy.
    3. `finance.transactions`: Journal lines with voucher drill-down and reversal chains.
    4. `finance.balance_sheet`: Assets, liabilities, equity, and retained earnings satisfying equation Assets = Liabilities + Equity.
    5. `finance.income_vs_expense`: Monthly/quarterly net financial performance trends.
  </action>
  <verify>Verify Balance Sheet equation test against posted journal entries.</verify>
  <done>FinancialAdapter operational with balance sheet balancing verification.</done>
</task>

<task type="auto" id="06-04">
  <name>Build Financial Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/financial-reports-view.tsx</files>
  <action>
    Build UI component rendering Account Statements, Balance Sheets, Income Statements, and Income vs Expense comparison charts.
  </action>
  <verify>Verify hierarchical account collapse/expand rendering.</verify>
  <done>Financial reports UI component integrated cleanly.</done>
</task>
