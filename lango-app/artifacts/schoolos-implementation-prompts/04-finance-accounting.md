# 04 — Finance and Accounting Prompt Pack

## Domain contract

- Student Accounting is the receivables subledger: charges, discounts, fines, invoices, payments, credits, refunds, and statements.
- Office Accounting is the general ledger: chart of accounts, journals, periods, bank reconciliation, and financial statements.
- Money uses fixed-precision decimals, currency codes, immutable posted entries, effective dates, idempotency, and reversal—not destructive edits.
- Provider webhooks are signature-verified and replay-safe. Every receipt and export is tenant/branch scoped.

## FA-01 — Fee definitions, groups, and rules

**Routes:** `/dashboard/finance/fee-types`, `/fee-groups`, `/fine-rules`. **Objective:** define reusable charge types, grouped schedules, discounts, due dates, late rules, tax/account mappings, and eligibility. **Layout:** definition list plus versioned rule editor with worked examples. **Actions:** draft, simulate, activate, supersede, archive unused. **States:** invalid dates, ambiguous eligibility, mapping missing, locked by allocations. **Acceptance:** deterministic calculation and historical rule version retention. **Exclude:** editing a rule to mutate issued invoices.

## FA-02 — Fee allocation workspace

**Routes:** `/dashboard/finance/allocations`, `/allocations/new`, `/allocations/[id]`. **Objective:** safely apply fee rules to explicit cohorts or students. **Layout:** audience builder, preview totals/exceptions, approval, background job progress and results. **Actions:** preview, exclude learner, approve, run, cancel queued job, reverse eligible batch. **States:** no recipients, duplicate charge warning, partial failure, completed with exceptions. **Acceptance:** recipient snapshot, idempotency key, row-level outcomes, audited approvals. **Exclude:** synchronous browser loops and hidden bulk charges.

## FA-03 — Invoice list, create, and detail

**Routes:** `/dashboard/finance/invoices`, `/invoices/new`, `/invoices/[id]`, `/invoices/due`. **Objective:** issue and manage understandable invoices without losing ledger truth. **Layout:** status/period/class filters; detail with payer/student, lines, adjustments, payments, balance, communication, timeline. **Actions:** create draft, issue, send, add authorized adjustment, void/reverse, download. **States:** draft, issued, partially paid, paid, overdue, disputed, voided. **Acceptance:** immutable issued lines except documented adjustments; totals recomputed server-side. **Exclude:** deleting issued invoices.

## FA-04 — Cashier and offline payment

**Routes:** `/dashboard/finance/cashier`, `/payments/offline`, `/payments/[id]`. **Objective:** find payer/invoice, record cash/bank/check payments, allocate amounts, and produce a receipt. **Layout:** fast payer search, open invoices, allocation panel, tender details, confirmation. **Actions:** collect, split allocation, hold draft, confirm, print/email receipt, reverse with approval. **States:** overpayment, underpayment, duplicate reference, closed drawer, reversed. **Acceptance:** server atomic transaction, receipt sequence, idempotency, cash-session reconciliation. **Exclude:** backdating without permission and reason.

## FA-05 — Online payments, refunds, and reconciliation

**Routes:** `/dashboard/finance/online-payments`, `/refunds`, `/reconciliation`. **Objective:** track intent → provider event → allocation → ledger posting and resolve exceptions. **Layout:** provider health, payment event timeline, unmatched queue, reconciliation table. **Actions:** retry safe sync, match, refund eligible amount, mark investigated. **States:** pending, authorized, captured, failed, disputed, refunded, unmatched, signature rejected. **Acceptance:** provider event IDs unique, webhook replay safe, refunds linked to original. **Exclude:** trusting browser redirects as payment proof.

## FA-06 — Receipts, reminders, and student statements

**Routes:** `/dashboard/finance/receipts`, `/reminders`, `/students/[id]/statement`. **Objective:** retrieve official receipts, schedule respectful reminders, and explain every balance movement. **Layout:** receipt search; reminder policy/queue; chronological statement with opening/charges/payments/credits/closing. **Actions:** download copy, send reminder, pause contact, export statement. **States:** delivery pending/failed, disputed balance, restricted contact. **Acceptance:** no duplicate reminder per policy window, consent/channel rules, statement totals reconcile. **Exclude:** harassment-like high-frequency reminders.

## FA-07 — Chart of accounts and accounting setup

**Routes:** `/dashboard/accounting/accounts`, `/accounts/new`, `/accounts/[id]`, `/periods`. **Objective:** maintain a valid tenant chart, opening balances through controlled journals, and accounting periods. **Layout:** hierarchical chart, account detail activity, period calendar/status. **Actions:** create child, archive unused, open/soft-close/hard-close period, map defaults. **States:** active, inactive, control account, closed period, account in use. **Acceptance:** balanced opening journals, no deletion of posted accounts. **Exclude:** direct balance fields.

## FA-08 — Deposits, expenses, and vouchers

**Routes:** `/dashboard/accounting/deposits/new`, `/expenses/new`, `/vouchers`, `/vouchers/[id]`. **Objective:** draft, approve, post, and evidence non-student financial transactions. **Layout:** transaction form with account lines, branch/cost center, attachment, approval timeline. **Actions:** save draft, submit, approve/reject, post, reverse. **States:** unbalanced, awaiting approval, posted, reversed, period closed. **Acceptance:** debits equal credits, segregation of duties configurable, attachment authorization. **Exclude:** edit/delete after posting.

## FA-09 — Journal and transaction explorer

**Routes:** `/dashboard/accounting/transactions`, `/journals/[id]`. **Objective:** trace financial events from source document through subledger and ledger. **Layout:** advanced filters, balanced journal detail, source/correlation links, audit timeline. **Actions:** inspect, export scoped data, create correcting reversal if authorized. **States:** posted, reversed, orphan-source alert, export queued. **Acceptance:** every posting traceable; totals balanced per journal and currency. **Exclude:** inline editing.

## FA-10 — Bank and cash reconciliation

**Routes:** `/dashboard/accounting/bank-reconciliation`, `/cash-sessions`. **Objective:** match bank lines/cash counts to posted transactions and resolve differences. **Layout:** statement import and mapping, matched/unmatched panels, variance summary, close checklist. **Actions:** import, auto-suggest, match/split, create authorized adjustment, close. **States:** duplicate import, ambiguous match, variance, closed. **Acceptance:** deterministic matching rules with human confirmation and immutable close record. **Exclude:** auto-posting unexplained variances.

## FA-11 — Financial statements and close

**Routes:** `/dashboard/accounting/trial-balance`, `/balance-sheet`, `/income-statement`, `/income-vs-expense`, `/close`. **Objective:** produce drillable statements from posted journals and guide period close. **Layout:** period/branch dimensions, statement hierarchy, comparison columns, drill-through, close checklist. **Actions:** run, compare, export, lock period, reopen with elevated approval. **States:** stale due to pending posting, unbalanced blocker, closed, restatement. **Acceptance:** reports reconcile to trial balance; exports state basis/date/currency. **Exclude:** invented projections presented as actuals.

## Verification prompt

Test decimal precision, allocation retries, duplicate payment references, webhook replay, partial payment, overpayment credit, refunds, invoice reversal, receipt numbering, cash variance, closed periods, balanced journals, statement reconciliation, tenant/branch scope, audit and permission separation.
