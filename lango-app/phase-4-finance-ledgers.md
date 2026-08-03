# Phase 4: Financial & Accounting Ledgers Implementation Plan

## Goal
Transform SchoolOS student finance into a mathematically exact, double-entry financial system with immutable payment allocations, credit notes, refunds, approved discounts, general ledger journals, chart of accounts, and fiscal period closing.

---

## Audit Findings & Baseline Gaps

| Audit Tag | Issue Description | Required Fix / Target |
|---|---|---|
| `currency:` | Floating Point Money (`doublePrecision`) | Invoices and payments use `FLOAT8`. Must use `numeric({ precision: 12, scale: 2 })` to guarantee 100% exact financial math without rounding errors. |
| `receivables:` | Missing Allocations Ledger | Payments directly update invoice status without line-item allocations. Add `payment_allocations` table linking receipts to invoice line items. |
| `audit:` | Mutable Invoices / No Credit Notes | Fee reductions edit invoices in place. Add `credit_notes` and `refunds` tables with immutable transaction records. |
| `ledger:` | No General Ledger / Double-Entry | No chart of accounts or debits=credits journals. Add `chart_of_accounts`, `journal_entries`, and `journal_entry_lines`. |
| `closing:` | Missing Fiscal Period Locks | Back-dated transactions can modify closed months. Add `fiscal_periods` with status `OPEN`/`CLOSED` and block edits on closed periods. |

---

## Tasks

### Sub-Phase 4.1: Student Receivables & Allocations Ledger
- [x] Task 1: Add Student Receivables models (`payment_allocations`, `credit_notes`, `refunds`, `fee_discounts`) to `src/models/Schema.ts` and create migration `0038_add_receivables_ledger.sql` → Verify: `npx tsc --noEmit` passes.
- [x] Task 2: Build Payment Allocations & Credit Notes APIs (`/api/finance/allocations`, `/api/finance/credit-notes`, `/api/finance/refunds`) → Verify: Endpoints return HTTP 200/201 with exact decimal amounts.

### Sub-Phase 4.2: Office Double-Entry Accounting & General Ledger
- [x] Task 3: Add Office Accounting models (`chart_of_accounts`, `fiscal_periods`, `journal_entries`, `journal_entry_lines`, `bank_accounts`) to `src/models/Schema.ts` and create migration `0039_add_double_entry_ledger.sql` → Verify: Clean Drizzle schema compile.
- [x] Task 4: Build Chart of Accounts & Journal Entries APIs (`/api/finance/chart-of-accounts`, `/api/finance/journals`) enforcing `SUM(debit) == SUM(credit)` constraint → Verify: Rejects unbalanced journal entries with HTTP 400.
- [ ] Task 5: Complete Fiscal Period Closing & statement-line Reconcile Engine. Open-period posting is enforced and reconciliation drafts no longer overwrite ledger balances; statement matching, variance approval and close checklist remain.

### Sub-Phase 4.3: Automated Testing & Verification
- [x] Task 6: Create comprehensive Vitest unit test suite `src/app/api/finance/ledgers.test.ts` testing receivables allocation, double-entry journal balance, and period closing locks → Verify: `npx vitest run src/app/api/finance/ledgers.test.ts` passes 100%.

---

## Done When
- [x] Schema contains `payment_allocations`, `credit_notes`, `refunds`, `chart_of_accounts`, `fiscal_periods`, `journal_entries`, and `journal_entry_lines`.
- [ ] Every posted payment creates an immutable allocation and posts a balanced double-entry journal (Debit Cash / Credit Receivables). Allocation is complete; configurable automatic GL mapping/posting remains.
- [x] Unbalanced journal entries or postings to closed fiscal periods are strictly rejected.
- [x] PostgreSQL invariant tests and the full 199-test suite pass; `npx tsc --noEmit` exits with 0 errors.
- [ ] Credit notes, refunds and expenses post balanced journals and support audited reversals/approval segregation.
- [ ] Bank reconciliation is derived from statement and ledger lines, not typed balances.
