# Office Accounting Findings

## Specification baseline

- Office Accounting is core Finance, not an optional addon.
- Existing invoices, payments, credit notes, refunds, expenses, receivables and addon integrations must be reused or adapted, never duplicated.
- Posted truth must be fixed-precision, balanced, immutable and corrected through reversal/replacement.
- Same source/version/idempotency payload must return the same journal; changed payload under the same key must fail.
- Implementation order is foundation → posting → core UI → deposits/expenses → adapters → reconciliation → statements/close.

## Decisions requiring professional validation

- Morocco-oriented account/tax/statutory defaults cannot be described as certified.
- V1 implementation uses MAD as base currency and supports accrual-capable postings.
- Student Accounting is the first mandatory source adapter; Payroll consumes the stable posting contract afterward.

## Repository audit

### Existing authoritative ledger to extend

- `chart_of_accounts`, `fiscal_periods`, `journal_entries`, `journal_entry_lines`, `bank_accounts`, and `bank_reconciliations` already exist from migration `0039_add_double_entry_ledger.sql` and are modeled in `src/models/Schema.ts`.
- PostgreSQL already enforces one-sided positive lines, open-period/date checks, tenant/account line scope, deferred minimum-two-line exact balance, and posted header/line immutability.
- `src/libs/services/finance-ledger.ts` performs integer-cent normalization and transactionally inserts balanced journals.
- Existing Finance APIs/pages cover chart of accounts, journal exploration, bank reconciliation, reports, expenses, invoices, payments, credits and refunds.
- Money paths were migrated to numeric precision in migration 0041; finance reference triggers were hardened in 0042.

### Gaps that require consolidation rather than replacement

- Journal numbering is random UUID-derived, not a tenant/journal/year transactional sequence.
- No posting-request/idempotency ledger binds source/version/key/payload digest to a stable outcome.
- `gl-auto-post.ts` is fail-open and silently skips missing periods/mappings; it resolves accounts by code prefix instead of versioned mappings.
- The current ledger has only posted/reversed states and lacks draft/submit/approve/post lifecycle, maker-checker evidence, voucher types/journals, and immutable voucher events.
- Fiscal periods support only open/closed, not soft-close/hard-close/reopen controls.
- The database prevents every journal header update, which conflicts with setting reversal linkage/status after posting; reversal design must avoid mutating lines while preserving an explicit bidirectional chain safely.
- Existing `source_id` is UUID-only and source identity is not uniquely/idempotently constrained.
- Bank accounts store the account number directly and maintain a mutable `current_balance`; accounting truth should derive from journal/reconciliation, with sensitive identifiers masked/encrypted according to platform capability.
- Current service checks for any open period, while PostgreSQL correctly checks the posting date. The new service should give the same deterministic domain error before relying on the trigger.
- Existing tenant consistency uses a mix of foreign keys and triggers; the extension must preserve current data and add composite guarantees only after preflight.

### Shared-file collision state

- `src/models/Schema.ts`, `migrations/meta/_journal.json`, Finance UI/routes and several global authorization/navigation files already have concurrent modifications. Phase A should build feature-local accounting schema/service modules first and integrate shared files only after re-reading current state.

### Existing API/control weaknesses to replace safely

- Chart-of-accounts POST parses raw JSON without Zod, accepts an unchecked account type/parent, and does not validate parent tenant/type/cycle rules.
- Journal GET is unbounded and returns line-level rows without server pagination or bounded filters.
- Journal POST immediately posts with broad `finance.manage`; it has no prepare/approve/post separation or idempotency key.
- Period close can create a period as a side effect, uses a `force` boolean without a separate exceptional permission/reason, and has no maker-checker/reopen lifecycle.
- Reconciliation mutates posted journal lines, but migration 0039 installs a trigger that rejects every journal-line update. The match API is therefore inconsistent with the database immutability rule. It also uses `parseFloat` for money.
- Finance reports aggregate operational invoice/payment/expense tables using floats; they are not reproducible general-ledger statements.
- Expense POST writes the source document before fail-open GL posting, while PUT/DELETE can later change or remove the expense without a linked reversal. This can drift source data from posted journal truth.
- Current permissions expose only broad `finance.read/manage/approve/close`; accounting capability separation is missing.
- Settings contain presentation defaults for journal prefixes/mappings, but they are not a versioned authoritative accounting configuration contract.

### Migration allocation

- Current highest journal entry is index 85 / `0084_student_transport_remediation`; no Office Accounting migration number is reserved yet.
