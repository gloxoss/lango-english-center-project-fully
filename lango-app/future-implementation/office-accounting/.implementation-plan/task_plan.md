# Office Accounting Implementation Task Plan

## Goal

Consolidate the existing Finance domain into one tenant-safe, immutable double-entry Office Accounting ledger without duplicating student accounting, expenses, payments, payroll, inventory, or addon subledgers.

## Provisional v1 decisions

- MAD base currency; retain currency/rate fields for a later reviewed phase.
- Accrual-capable ledger with controlled cash postings.
- Central versioned posting service; source modules never write journal truth directly.
- Maker-checker for high-risk/manual postings.
- Morocco chart, tax, and statutory mappings remain uncertified until reviewed by a qualified local accountant.

## Phases

| Phase | Status | Exit gate |
|---|---|---|
| 0. Real-state audit and decision record | complete | Reuse/extend/replace map, collision map, schema and migration baseline recorded |
| A. Ledger foundation | complete | ADR, fixed-precision schema, accounts, periods, journals, numbering migration and invariant tests |
| B. Posting engine | complete | Balanced/idempotent posting, maker-checker, immutable events, reversal and concurrency tests |
| C. Core APIs and UI | complete | Accounts, voucher types, journals and transaction drill-down with capability/page guards |
| D. Deposits and expenses | in_progress | Approval/post/reversal flows, duplicate detection, legacy expense preservation |
| E. Source adapters | pending | Student Accounting first; Payroll contract published; reconciliation evidence |
| F. Bank reconciliation | in_progress | Import, match/unmatch/split/close and replay tests |
| G. Statements and close | in_progress | Trial balance, GL, P&L, balance sheet, cash flow and period locks |
| H. Release verification | pending | Migrations, races, two-tenant tests, tsc, build, isolation, Docker and browser evidence |

## Shared-file protocol

Before editing `src/models/Schema.ts`, `migrations/meta/_journal.json`, permissions, portal manifest, sidebar, settings registry, package files, or existing cross-domain Finance services, re-read `git status --short` and preserve concurrent work. Allocate migration numbers only from the journal immediately before integration. Never run `drizzle-kit generate`.

## Errors encountered

| Error | Attempt | Resolution |
|---|---:|---|
| Root planning files already belong to an older task | 1 | Isolated this task's planning files under the Office Accounting implementation directory |
