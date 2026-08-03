# Student Accounting — Core Finance Enhancement Plan

Status: planned enhancement of existing core Finance; provisional decisions pending owner review.

> The general ledger, chart of accounts, office deposits/expenses, vouchers, reconciliation and financial statements are specified separately in `../office-accounting/OFFICE-ACCOUNTING-IMPLEMENTATION-PLAN.md`. Student Accounting remains the fee/receivables subledger and posts into that shared core ledger.

## Screen inventory

| # | Screen | Visible pages | Primary action |
|---|---|---|---|
| 1 | Student Accounting | Payment Type, Offline Payments, Fees Type, Fees Group, Fine Setup, Fees Allocation, Fees Pay / Invoice, Due Fees Invoice, Fees Reminder | Configure, bill, collect and follow up fees |

## Fit against the app

| Reference page | Current app | Decision |
|---|---|---|
| Payment Type | `paymentMethod` enum | Add configurable methods; migrate from enum |
| Offline Payments | Real payment entry UI/API and `payments` | Enhance; never duplicate ledger |
| Fees Type | `feeCategories` | Keep and enhance |
| Fees Group | `feeStructures` + `feeComponents` | Keep; “group” can be UI label |
| Fine Setup | Missing | Add, optional/configurable |
| Fees Allocation | `feeSchedules` foundation | Major enhancement with preview/run/snapshot |
| Fees Pay / Invoice | Real invoice pages/API/tables | Keep and harden |
| Due Fees Invoice | Invoice filtering/reports exist | Add receivables workbench, not entity |
| Fees Reminder | Missing | Add through Broadcast infrastructure |

Keep Expenses and Financial Reports even though absent from the screenshot. Do not create offline-invoice, due-invoice or fee-pay tables.

## Foundation that must be fixed first

- Replace `doublePrecision` money with fixed-precision minor units or `numeric`.
- Replace random invoice numbers with atomic tenant/branch naming series and a uniqueness constraint.
- Add immutable invoice/payment event ledgers, optimistic/row locking and stable idempotency.
- Connect modeled components and schedules to the real structure → allocation → invoice lifecycle.
- Payments need allocations, overpayment policy, receipts, reversals/refunds and reconciliation; posted rows are never edited/deleted.
- Make overdue status/aging deterministic and add server pagination/filtering and consistent finance authorization.

## Page plans

### Payment Types — needed

`/dashboard/finance/settings/payment-methods`: code, localized label, required reference/bank/date/proof, refundable flag, active dates, branch scope and accounting mapping. Provider-backed online methods remain integrations.

### Offline Payments — enhance existing

`/dashboard/finance/payments`: exact student/guardian/invoice search, multi-invoice allocation, partial payment, receipt, proof and method-specific fields. Add cashier sessions/closing, method totals, variance, supervisor approval and export. Corrections use reversal + replacement; concurrent submissions cannot overpay.

### Fees Type — enhance existing

`/dashboard/finance/fee-types`: code/name, description, revenue mapping, taxable/refundable/discountable/fineable flags and active dates. Archive used types; never delete them.

### Fees Group — enhance fee structures

`/dashboard/finance/fee-structures`: versioned fee components with amount, recurrence, mandatory/optional, tax and due offset; scope by program/year/term/branch. Published versions are immutable and cannot rewrite invoices.

### Fine Setup — add

`/dashboard/finance/fine-policies`: scope, grace days, flat/per-day/tiered formula, cap, closure behavior and effective dates. Scheduled deterministic assessments; edits are prospective. Waive/reduce requires permission, reason and optional approval. No compounding by default.

### Fees Allocation — enhance modeled foundation

`/dashboard/finance/allocations`: period → population → structure/version → schedule → concessions → preview → approve/run. Snapshot inputs, generate invoices in resumable jobs, expose included/excluded/errors and make retries idempotent. Issued invoices require credit/cancel workflows.

### Fees Pay / Invoice — consolidate

`/dashboard/finance/invoices` plus student/guardian statement. Add draft/issued/partial/paid/overdue/cancelled/credited lifecycle, line taxes/discounts, timeline, payments, receipts and communications. Routine tuition comes from allocations; individual creation is exceptional. PDF uses immutable snapshots.

### Due Fees Invoice — add workbench

`/dashboard/finance/receivables`: not-due/1–30/31–60/61–90/90+ aging, outstanding balance, learner/guardian, program, promise-to-pay, dispute/hold and last reminder. Bulk actions create jobs. Support historical “as of” reporting.

### Fees Reminder — add through Broadcast

`/dashboard/finance/reminders`: rules before/on/after due date with cadence, minimum balance, guardian policy, quiet hours, locale and escalation. Finance creates purpose-limited variables/recipient snapshots; Broadcast renders/sends and returns evidence. Use transactional templates and frequency caps; never expose balances to unauthorized or marketing audiences.

## Target data/API

Enhance `feeCategories`, `feeStructures`, `feeComponents`, `feeSchedules`, `invoices`, `invoiceItems`, `payments`, `namingSeries`. Add `paymentMethodConfigurations`, `feeStructureVersions`, `feeAllocationRuns`, `feeAllocationTargets`, `finePolicies`, `fineAssessments`, `invoiceEvents`, `paymentAllocations`, `paymentReversals`, `refunds`, `studentCredits`, `cashierSessions`, `cashierClosings`, `financeReminderRules`, `financeReminderRuns`.

- `/api/finance/fee-types`, `/fee-structures`, `/:id/versions`
- `/api/finance/allocations/preview`, `/allocations`, `/:id/run|cancel`
- `/api/finance/invoices`, `/:id/issue|cancel|credit`, `/receivables`
- `/api/finance/payments`, `/:id/reverse|refund`, `/cashier-sessions/:id/close`
- `/api/finance/fine-policies`, `/fine-runs`, `/reminder-rules`, `/reminder-runs`

Use database transactions, locks, Zod, tenant/branch policies, outbox jobs, audit metadata and stable errors. Never trust client-calculated totals.

## Permissions and delivery order

Permissions: fee-type manage; structure manage/publish; allocation prepare/approve/run; invoice create/issue/cancel/credit; payment collect/reverse/refund; cashier close/approve; fine manage/waive; receivables/report read; reminder manage. Allow configurable maker-checker separation.

| Phase | Outcome |
|---|---|
| A | Safe money, numbering, constraints, event ledgers and statuses |
| B | Fee types and versioned structures |
| C | Allocation preview/approval/jobs and generated invoices |
| D | Invoice/statement, payment allocations and receipts |
| E | Reversals/refunds/credits, cashier closing and reconciliation |
| F | Fine policies, aging workbench and reports |
| G | Broadcast-backed reminders |
| H | Optional gateways/accounting export after provider choice |

Execute A → B → C → D → E → F → G. Do not build automation on unsafe monetary/numbering behavior.

## Acceptance, metrics and references

Prove exact arithmetic, unique sequential documents, idempotent allocation, concurrent payment safety, reversal correction, tenant/guardian isolation, fine boundaries, partial/overpayment/refund, aging “as of,” reminder caps and the equation: opening + charges − credits − allocations = closing balance.

Track billing success, unallocated payments, cashier variance, collection rate, aging movement, days-to-pay, reminder delivery/conversion and overrides.

- Frappe Education fee/portal concepts: https://github.com/frappe/education
- ERPNext accounting/payment document patterns: https://github.com/frappe/erpnext
- Medusa provider-neutral payment concepts only: https://github.com/medusajs/medusa

Evolve Lango’s existing Finance domain; do not embed a second ERP. Confirm later: MAD-only vs multi-currency, fine rules, first gateway/accounting export, and whether cashier/maker-checker controls are mandatory or configurable.
