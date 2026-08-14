# Office Accounting Progress

## 2026-08-08

- Accepted ownership of Plan 2: Office Accounting.
- Read the complete Office Accounting specification and coordinated wave plan context.
- Established provisional v1 decisions and shared-file preservation rules.
- Created isolated file-backed implementation tracking because root planning files belong to another task.
- Started Phase 0 real-state audit.
- Mapped the existing double-entry schema, migrations 0039/0041/0042, fixed-precision money utilities, posting service and fail-open GL adapters.
- Confirmed the correct implementation strategy is an in-place ledger evolution, not a new Office Accounting ledger.
- Audited existing Finance APIs/tests and recorded lifecycle, reconciliation, reporting, permission and expense-drift gaps.
- Confirmed the next migration number must be allocated after current index 85 only at integration time.
- Added the Office Accounting extension schema and forward migration 0085 for journals, voucher types, transactional numbering, payload-bound posting requests, journal provenance/reversal links and immutable voucher events.
- Added the centralized transactional posting service with exact-cent balance validation, tenant/account/date checks, advisory-lock concurrency control, deterministic numbering, idempotent replay and explicit reversal support.
- Corrected the succeeded-request immutability trigger so permitted DELETE operations return OLD on PostgreSQL BEFORE DELETE triggers.
- Applied and idempotently re-applied migration 0085: 6/6 foundation tables, 7/7 tenant constraints and 2/2 immutability triggers.
- Added and applied migration 0089 after preserving concurrent 0086–0088 journal entries. It adds draft/approval source documents, balanced lines, duplicate-reference protection and immutable events.
- Added fine-grained Office Accounting capabilities and accountant defaults.
- Added guarded APIs for accounts, journals, voucher types, journal posting, transactions/drill-down/reversal, deposits, expenses, trial balance and P&L/balance-sheet projections.
- Added page-guarded Chart of Accounts, General Ledger, Deposit and Expense entry screens and linked them through both navigation systems.
- Added draft → pending approval → approved/rejected → posted → reversed services with maker-checker enforcement and source-document immutability.
- Replaced the broken legacy reconciliation write-to-journal behavior with migration 0090 and a separate immutable-safe match table; matching no longer mutates posted journal lines and uses exact minor-unit arithmetic.
- Added guarded period list/create/close/reopen APIs. Close is blocked by unposted approved documents or draft reconciliations; reopen has a distinct exceptional permission, mandatory reason and audit record.

## Verification log

- `npx tsc --noEmit --pretty false`: completed with accounting initially reporting 4 BigInt-literal target errors; all 4 corrected. Remaining diagnostics are confined to concurrent Transport and Role Portal files.
- Docker status command timed out without output; direct PostgreSQL connectivity subsequently succeeded.
- Migration 0085 initial + repeat apply: PASS.
- Migration 0089 initial + repeat apply: PASS (3/3 workflow tables); later rerun applied the tenant-composite account FK hardening.
- Posting acceptance: 7/7 PASS, including six-request concurrency race, exact balance, changed-payload rejection, reversal and immutable events.
- Expense workflow acceptance: 9/9 PASS, including maker-checker, approval/post replay, posted immutability, duplicate supplier reference and zero-net-impact verification cleanup.
- `git diff --check` on the initial accounting slice: PASS.
- Scoped ESLint did not complete within 180 seconds and emitted no diagnostics before timeout.
- Repository-wide `tsc --noEmit` first completed with only 4 accounting BigInt-target errors plus concurrent Transport/Portal errors; the 4 accounting errors were fixed. The second run emitted no diagnostics but did not complete within 300 seconds, so a final compiler gate is still pending.
- Office Accounting scoped TypeScript gate: PASS (34 roots, including reconciliation and period controls).
- Accounting route guard scan: 18/18 new accounting routes contain request-context and capability guards.
- Migration 0090 apply + idempotent rerun: PASS (match table, 2/2 tenant FKs, completed-reconciliation trigger).
- Production build: not started by this task because another active `next build` owns `.next/lock`; its worker remained responsive and CPU-active, so it was preserved.
