# Office Accounting — Core Finance Ledger Plan

Status: planned core Finance enhancement. Decisions are provisional pending owner/accountant review.

## Screen inventory

| # | Screen | Visible pages | Primary action |
|---|---|---|---|
| 1 | Office Accounting | Account, New Deposit, New Expense, All Transactions, Voucher Head | Configure accounts and record office transactions |

The screenshot shows navigation, not a complete accounting system. The implementation below adds the minimum controls necessary for financial correctness.

## Feature map against SchoolOS

### Keep

| Reference concept | Current app | Decision |
|---|---|---|
| New Expense | Real Expenses page/API/table | Reuse as intake UI |
| All Transactions | Payments, invoices, expenses and reports exist | Build unified journal read model |
| Account | No accounting account model | Add chart of accounts and cash/bank accounts |

### Change

- The current `expenses` table uses floating-point money and permits update/delete. It must become a source document or migration input; posted accounting truth belongs to immutable journal entries.
- Student payments/invoices, Payroll, Inventory and add-ons must post through one accounting interface instead of creating parallel general ledgers.
- Dashboard “voucher” terminology currently counts invoices. Rename that metric or source it from real posted vouchers once available.

### Add

- Double-entry chart of accounts, fiscal periods, journals, posting engine, deposits, payment/expense vouchers, reversals, bank/cash reconciliation, trial balance, general ledger, profit/loss, balance sheet and cash flow.
- Approval, attachments, numbering, dimensions, opening balances, closing locks and integration posting contracts.

### Remove / do not duplicate

- Do not create a second expense table, office-only payment ledger or mutable “all transactions” table.
- Do not remove student invoices, payments or expenses because the screenshot omits their current views.

## Provisional decision gate

1. **Ledger:** use double-entry accounting; assumed and required for trustworthy reporting.
2. **Currency:** MAD-first single base currency in V1; preserve currency fields for a later reviewed multi-currency phase.
3. **Posting:** operational modules create source documents, then a centralized posting service creates balanced immutable journal entries.
4. **Approval:** draft/approve/post for manual vouchers; configurable maker-checker thresholds.

## Domain boundary

Office Accounting is the core general ledger, not an optional school add-on. Student Accounting owns fee invoices/collections; Payroll owns payroll calculations; Inventory owns stock; Library owns circulation charges. Each submits a versioned posting request to Accounting and stores the returned journal reference. Accounting owns accounts, journals, periods, entries, reconciliation and financial statements.

## Page-by-page plan

### Account — required, broaden to Chart of Accounts

Route: `/dashboard/finance/accounting/accounts`.

- Hierarchical tree/list with code, localized name, type (`asset`, `liability`, `equity`, `income`, `expense`), normal balance, parent, currency, reconciliation flag and active dates.
- Separate bank/cash account details: bank name, masked account number, branch, opening date and statement-import mapping.
- Seed a reviewed Morocco-oriented starter template, but require an accountant to confirm tax/statutory mappings before production.
- Once used, accounts cannot be deleted or have their fundamental type changed; archive them after balance/child checks.
- Support controlled merge/recode migrations with complete audit evidence.

### New Deposit — required as a receipt/deposit voucher

Route: `/dashboard/finance/accounting/deposits/new`.

- Record money entering a cash/bank account from income, owner funding, transfer, refund recovery or another permitted source.
- Fields: posting date, received-into account, source/offset account or party, amount, method, reference/date, branch/dimension, description and proof.
- Student fee collection should continue through Student Accounting and post automatically; do not re-enter it as a manual deposit.
- Internal cash-to-bank movement uses a transfer voucher with two controlled legs, not income.
- Prevent duplicate bank reference/amount/date submissions using warnings and idempotency; posted deposits are reversed, never edited/deleted.

### New Expense — keep UI concept, rebuild posting lifecycle

Route: `/dashboard/finance/expenses/new`.

- Draft expense with payee, expense account/category, cash/bank/payable account, amount/tax, invoice/reference, posting date, dimensions, description and receipt.
- Lifecycle: `draft → pending_approval → approved → posted`; alternatives `rejected`, `voided`, `reversed`.
- Apply approval thresholds, duplicate supplier-invoice detection, required receipt policies and restricted-account checks.
- Posting debits expense/asset and credits cash/bank/payable. Payment later clears payable when accrual mode is used.
- Migrate existing expense rows carefully: preserve original IDs/timestamps, convert precision and create opening/migration journals only after reconciliation.

### All Transactions — required as General Ledger / Journal

Route: `/dashboard/finance/accounting/transactions`.

- Server-paginated view by posting date, voucher number/type, source module/document, status, account, branch/dimension, counterparty, amount, creator/approver and reconciliation state.
- Drill down from voucher to balanced debit/credit lines, attachments, source document, approvals, audit events and reversal chain.
- Export must reproduce filters and use a bounded asynchronous job for large periods.
- Never allow direct editing of posted lines. Corrections create linked reversal/replacement vouchers.

### Voucher Head — needed, rename to Voucher Types / Journals

Route: `/dashboard/finance/accounting/voucher-types`.

- Configure voucher type/code, journal, numbering series, allowed source modules, required fields, approval policy, default accounts and active dates.
- System types include receipt/deposit, payment/expense, transfer, journal adjustment, opening, reversal and closing.
- Reserved system voucher semantics cannot be changed after use. Custom voucher types may extend presentation/workflow, not bypass balancing or permissions.

## Essential pages missing from the screenshot

- **Journal Entry:** balanced manual adjustment with explanations and approval; restricted to accountants.
- **Bank and Cash Reconciliation:** statement import/manual matching, split/merge matches, fees/interest, unmatched queue and signed close.
- **Fiscal Years and Periods:** open/soft-close/hard-close; reopening requires exceptional permission and reason.
- **Trial Balance and General Ledger:** exact account movements and opening/closing balances.
- **Financial Statements:** profit/loss, balance sheet and cash-flow views with drill-through and “as of” reproducibility.
- **Accounting Settings:** base currency, rounding, numbering, retained earnings, suspense and module mappings.

## Data model

- `accountingAccounts`, `accountingAccountTranslations`, `accountingDimensions`, `accountingDimensionValues`.
- `accountingFiscalYears`, `accountingPeriods`, `accountingJournals`, `accountingVoucherTypes`, `accountingNumberingSeries`.
- `accountingVouchers`: source, dates, lifecycle, currency/rate, description, version, creator/approver/poster and reversal link.
- `accountingVoucherLines`: account, debit or credit, base amount, party, branch/dimensions and reconciliation reference.
- `accountingVoucherEvents`: immutable lifecycle/audit evidence.
- `accountingBankAccounts`, `accountingStatementImports`, `accountingStatementLines`, `accountingReconciliationMatches`.
- `accountingPostingRequests`: versioned source-module request, idempotency key, payload digest, outcome and journal reference.
- `accountingAttachments`, `accountingClosingRuns`, `accountingOpeningBalances`.

Use fixed-precision numeric/minor units. A posted voucher must have at least two lines, positive line values, one debit/credit side per line, and exactly balanced base-currency totals. Enforce balance in the posting transaction, not only in UI validation.

## Posting and correction logic

1. Source or manual voucher is validated and approved.
2. Central posting service locks the document/period/numbering series.
3. Resolve configured accounts/dimensions and build lines from a versioned posting rule.
4. Validate open period, permissions, currency/rounding, account state and exact balance.
5. Allocate an atomic voucher number and insert voucher, lines, events and source link in one transaction.
6. Publish an outbox event for projections/reports; the journal remains authoritative.

Retries with the same source/version/idempotency key return the same posting. A changed payload with a reused key fails. Corrections reverse the original lines into an open period and optionally post a replacement; the original remains visible.

## Integrations

- Student Accounting: issued invoices, receipts, credits, refunds and fines.
- Payroll: payroll liabilities/expenses and bank/cash settlement batches.
- Inventory: purchases, sales, stock valuation summaries if/when accounting scope enables them.
- Library/Hostel/Transport: approved charges flow through Student Accounting, not directly to income.
- Expenses: approved source document posts payable or cash/bank expense.

Each adapter supplies a versioned posting contract and reconciliation report. Missing/invalid mappings block posting into an exception queue; never guess a suspense account silently.

## API surface

- `/api/finance/accounting/accounts`, `/voucher-types`, `/periods`
- `/api/finance/accounting/deposits`, `/expenses`, `/journal-entries`
- `/:documentId/submit|approve|post|reject|reverse`
- `/api/finance/accounting/transactions`, `/trial-balance`, `/statements/:type`
- `/api/finance/accounting/bank-statements/import`, `/reconciliation/match|unmatch|close`
- Internal: `/api/internal/accounting/posting-requests` or an in-process service boundary with the same contract.

Every mutation uses Zod, tenant/branch authorization, idempotency, transactions, audit metadata and stable error codes. Large imports/exports/report rebuilds are resumable jobs.

## Permissions and controls

- `accounting.account.read|manage`, `accounting.voucher.prepare|approve|post|reverse`, `accounting.deposit.create`, `accounting.expense.prepare|approve`, `accounting.journal.create`, `accounting.period.close|reopen`, `accounting.reconcile`, `accounting.statement.read`, `accounting.export`.
- Configurable maker-checker thresholds; creator cannot approve their own high-risk voucher.
- Closed periods reject normal posting. Emergency reopen logs actor, reason, approval and impacted statements.
- Protect attachments/bank data, mask exports by default and log every export.

## Delivery blueprint

| Phase | Deliverable | Dependency |
|---|---|---|
| A | Accounting ADR, money migration strategy, chart of accounts, periods, journals and numbering | Accountant review |
| B | Balanced posting engine, vouchers/lines/events, reversals and core tests | A |
| C | Account and Voucher Type pages; journal/transaction drill-down | B |
| D | Deposit and rebuilt expense approval/posting flows | B–C |
| E | Student Accounting adapter and reconciliation; then Payroll/other adapters | B–D |
| F | Bank/cash statement import and reconciliation | D |
| G | Trial balance, GL, P&L, balance sheet, cash flow and period close | E–F |
| H | Optional multi-currency, budgeting, payables and external accounting export | Proven need |

Execute A → B → C → D → E → F → G. Do not retrofit automatic postings before the ledger and migration reconciliation tests exist.

## Acceptance and operational tracking

- Property tests: every posted voucher balances; reversal plus original nets to zero; retries never duplicate postings.
- Test tenant/branch isolation, closed periods, numbering concurrency, account archival, approval separation, duplicate deposit/expense, import replay and reconciliation split/merge.
- Reconcile source subledgers to control accounts and prove trial balance debits equal credits for every period.
- Track unposted exceptions, posting latency/failures, suspense/unmapped items, unreconciled bank lines, period-close duration, reopened periods, reversals and manual journal rate.
- Migration requires before/after totals, sampled source-document traceability, signed accountant acceptance, backup and rollback plan.

## Open-source references

- ERPNext accounting/payment-entry patterns: https://github.com/frappe/erpnext
- Frappe Books for compact double-entry UI/domain inspiration: https://github.com/frappe/books
- Ledger CLI for double-entry invariants and reporting concepts: https://github.com/ledger/ledger
- Akaunting for small-business UX ideas: https://github.com/akaunting/akaunting (BSL; reference only unless licensing is approved).

Use references for workflows and invariants, not blind source copying. Morocco-specific chart, tax, retention and statutory requirements require review by a qualified local accountant before production.

## Decisions to confirm later

1. Is V1 MAD-only, and are foreign-currency bank accounts required?
2. Cash-basis only or accrual accounting with payables?
3. Which Morocco chart/tax/reporting obligations are in launch scope?
4. Which integrations post in the first release: Student Accounting only, or Payroll and Inventory too?

