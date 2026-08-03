# Phase 4 Finance Ledgers — Audit and Hardening Plan

## Audit verdict

**Current status after hardening: the ledger foundation is live and database-enforced, but Phase 4 is not 100% passed. Automatic GL mappings/posting, full reversal/approval workflows, line-based bank reconciliation, close checklist and statements remain.**

The new tables and route files demonstrate intended direction, but the normal migration path does not include migrations `0038` or `0039`, the live Docker database has none of the new tables, core invoice/payment money remains floating point, operational payment flows do not post to the new subledger or general ledger, and the four tests do not import any production code.

Recommended roadmap status until the exit gates pass: **red/yellow, approximately 20–30% complete**.

## Confirmed findings

### P0 — Financial integrity and release blockers

1. **Migrations are not registered or live.** Files `0038_add_receivables_ledger.sql` and `0039_add_double_entry_ledger.sql` are absent from `migrations/meta/_journal.json`. The live migration ledger remains at 38 entries (through `0037`) and none of the ten new finance tables exists.
2. **Core money is still floating point.** `invoices.amount`, discounts, net/paid amounts, `payments.amount`, invoice items, fee structures/categories, and expenses still use `doublePrecision`. Adding numeric columns only to new tables does not deliver exact end-to-end financial math.
3. **Payments do not post to either ledger.** The existing payment route inserts a payment and mutates `invoices.paidAmount`; it never creates `payment_allocations`, journal entries, or journal lines. The plan's core “every payment posts Debit Cash / Credit Receivables” criterion is false.
4. **Journal balance is not a database invariant.** Balance exists only as route-level JavaScript logic. Direct writes, future services, imports, or partial failures can create unbalanced journals.
5. **Journal creation is non-atomic.** The header is inserted before its lines outside a transaction. A line FK/validation failure leaves an orphan journal header.
6. **Posted accounting history is destructible.** Foreign keys use `ON DELETE CASCADE`, including journal lines from journal/account deletion and allocations from payment/invoice deletion. This contradicts immutable ledger requirements.
7. **Cross-tenant references are possible.** New tables store a session tenant ID but reference payment, invoice, student, account, bank, and journal by ID alone. Routes do not verify reference ownership, enabling cross-tenant linkage and joined-data disclosure.
8. **The tests do not test production behavior.** `ledgers.test.ts` performs arithmetic on local objects. It does not import routes/services/schema, connect to PostgreSQL, test permissions, apply migrations, or assert stored balance.

### P1 — Major accounting gaps

1. **Allocation controls are absent.** No positive-amount constraint, no uniqueness/idempotency, no check that allocations stay within payment amount or invoice balance, no verification that payment and invoice belong to the same student/tenant, and `invoiceItemId` has no FK.
2. **Credit notes are decorative records.** `invoiceId` lacks an FK; issue does not reduce receivables, allocate credit, change invoice balance, or post a balanced journal. The route emits no audit event despite the completion claim.
3. **Refunds are decorative records.** No validation against original payment/refundable balance, no provider/cash disbursement lifecycle, no reversal/allocation effect, no journal, and no approval separation beyond one capability check.
4. **Decimal safety is defeated in journals.** Values are converted through `Number`, accumulated as IEEE-754 floats, and accepted with a tolerance. This is not exact decimal accounting.
5. **Invalid journal lines are allowed.** No constraint requires non-negative amounts, exactly one of debit/credit to be positive, a non-zero line, at least two persisted lines, or active tenant-owned accounts.
6. **No posting lifecycle.** Journals have no draft/approved/posted/reversed status, posting timestamp, approval, reversal link, immutable lock, or correction workflow.
7. **Numbering is collision-prone.** Credit, refund, and journal numbers use the last six digits of `Date.now()` without tenant uniqueness or atomic sequences.
8. **Fiscal periods are weak.** Date order and overlap are unconstrained; closed-period checking races with posting; only this one journal route checks closure; and there is no controlled reopen/adjustment-period workflow.
9. **Bank reconciliation is not reconciliation.** It accepts two user-supplied balances, marks the record completed, and overwrites `bank_accounts.currentBalance`. There are no imported statement lines, ledger matches, outstanding items, variance control, or close approval.
10. **Schema reference gaps.** Parent chart accounts, credit-note invoices, fee-discount structures/approvers, fiscal-period closers, posted-by users, bank reconcilers, and several tenant-consistency relationships lack appropriate FKs.
11. **Migration SQL is retry-fragile.** Migration `0039` creates two enum types inside one exception block; if the first already exists, the exception skips creation of the second.
12. **Authorization workflow is incomplete.** Default accountants have `finance.manage` but not `finance.approve`, making refund approval inaccessible to the intended role while no separate requester/approver workflow exists.

### P2 — Operability and product gaps

1. GET endpoints are mostly unpaginated and lack as-of filters, status filters, and export controls.
2. There is no receivables aging, student statement reconciliation, trial balance, general ledger detail, balance sheet, income statement, or close checklist grounded in posted lines.
3. There are no transactional outbox events for receipts, refunds, credit notes, or posting notifications.
4. There is no branch, currency, tax, cost-center, payment-clearing, or accounting-mapping model sufficient for multi-branch operations.
5. Mojibake is present in several new French API messages.

## Implementation plan

### Stage 0 — Correct claims and establish the accounting contract

- Downgrade Phase 4 in the master tracker until the exit gates pass.
- Define subledger vs general-ledger ownership, posting lifecycle, reversal policy, numbering policy, currency/rounding rules, period-close rules, approval segregation, and branch dimensions.
- Freeze direct additions to these prototype routes until one canonical finance service layer exists.

### Stage 1 — Repair migration delivery safely

- Determine whether `0038`/`0039` were applied manually in any shared environment.
- If nowhere applied, correct the draft SQL, generate/validate matching snapshots as required by repository convention, then register both in the journal in deterministic order.
- If applied anywhere, do not rewrite them; register deployment evidence and deliver corrections through the next additive migration.
- Split enum creation into independent guarded blocks.
- Apply to a disposable database first and verify up/down operational recovery through backup/restore rather than destructive rollback.

### Stage 2 — Convert the complete money path to decimals

- Add an additive conversion migration for invoice items, invoices, payments, expenses, fee structures/categories, and any other monetary columns still using float.
- Use `numeric` values as decimal strings or a single approved decimal library from request validation through calculations and responses.
- Define currency per transaction/ledger and reject mixed-currency allocations without an explicit FX workflow.
- Add positive/range checks and reconcile converted totals before cutover.

### Stage 3 — Harden tenant/reference constraints

- Add tenant-consistent composite references for payments, invoices/items, students, accounts, journals, bank accounts, fee structures, and actors.
- Add the missing FKs and self-FKs.
- Replace destructive cascades on posted financial records with `RESTRICT` or controlled archival/reversal behavior.
- Add tenant-unique atomic sequences for invoice, receipt, credit-note, refund, and journal numbers.

### Stage 4 — Build the receivables subledger service

- Create one transactional service for invoice issuance, payment receipt, allocation, credit, refund, reversal, and balance projection.
- Lock affected payment/invoice rows during allocation and enforce total allocated ≤ available payment and invoice balance.
- Require student/tenant/currency consistency.
- Make payment provider/cashier retries idempotent.
- Derive invoice paid/balance status from immutable allocation/credit/refund movements rather than treating mutable `paidAmount` as truth.
- Record dedicated audit/outbox events inside the transaction.

### Stage 5 — Build a real double-entry posting engine

- Introduce journal lifecycle: draft → approved → posted → reversed, with immutable posted entries.
- Validate lines using decimal arithmetic and tenant-owned active accounts.
- Post header and lines atomically.
- Enforce line validity with database checks and enforce whole-journal balance through a controlled posting function/service plus deferred database validation or equivalent trusted invariant.
- Generate reversal journals rather than editing/deleting posted records.
- Create configurable accounting mappings for receivables, cash/bank, revenue, discounts, refunds, expenses, and clearing accounts.
- Have subledger transactions call this engine in the same transaction or a reliable transactional-outbox posting workflow.

### Stage 6 — Make fiscal close authoritative

- Add date-order and non-overlap constraints for periods.
- Require every posting to resolve exactly one open period.
- Close only after subledger-to-GL reconciliation, unposted-draft review, bank reconciliation, and trial-balance checks.
- Block posting at the database/service boundary, not one route-level pre-check.
- Add controlled reopen or adjustment-period flow with elevated approval and audit.

### Stage 7 — Implement real bank reconciliation

- Model statement imports, statement lines, ledger cash movements, match groups, outstanding items, fees, interest, and variances.
- Make matching suggestions reviewable; never overwrite ledger truth with a typed reconciled balance.
- Close reconciliation only when variance policy and approvals pass.
- Derive bank book balance from posted ledger lines.

### Stage 8 — Replace placeholder tests with release evidence

- Add migration tests proving all tables, enums, constraints, and numeric types exist.
- Add PostgreSQL integration tests for exact decimal edge cases (`0.1 + 0.2`), over-allocation, duplicate retries, partial payment, credit, refund, reversal, and subledger reconciliation.
- Add journal tests for unbalanced direct/service writes, invalid lines, transaction rollback, inactive/cross-tenant accounts, concurrency, and immutable posting.
- Add period-close race and overlap tests.
- Add two-tenant reference and disclosure tests for every route.
- Add role/segregation tests for requester, cashier, accountant, approver, auditor, and school admin.
- Add bank statement matching/variance tests.
- Run the full suite with PostgreSQL so no financial/security release-gate tests are skipped.

### Stage 9 — Reporting and operational UI

- Build student statements, receivables aging, allocation/refund/credit details, cashier close, chart of accounts, journal review/post/reversal, period close checklist, bank reconciliation, trial balance, general ledger, balance sheet, and income statement.
- Every report must reconcile to posted journal lines and display tenant, branch, currency, basis, period, and freshness.

## Exit gates for Phase 4

Phase 4 may be marked **100% / green** only when:

- All finance migrations are journaled, applied, and verified in PostgreSQL.
- All monetary fields in active finance flows use the approved decimal representation.
- Payments, allocations, credits, refunds, and expenses reconcile to immutable subledger movements and balanced GL postings.
- Cross-tenant references are impossible at service and database layers.
- Posted journals cannot be edited or cascade-deleted and can only be corrected by reversal.
- Closed periods reject every posting path under concurrency.
- Bank reconciliation is based on statement and ledger lines, not typed balances.
- Trial balance and core statements reconcile.
- PostgreSQL integration, concurrency, security, tenant-isolation, decimal, and accounting-invariant tests pass with no skipped release gates.
- Roadmap and implementation documents contain only evidence-backed results.
