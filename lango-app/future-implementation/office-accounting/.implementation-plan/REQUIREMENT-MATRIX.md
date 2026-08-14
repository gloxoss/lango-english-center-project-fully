# Office Accounting — Requirement → Code / Test Matrix

## Final gate update — 2026-08-09

### Acceptance-gap closure (2026-08-09)

- `PATCH /api/finance/accounting/accounts` provides tenant-scoped, idempotent account archive with stable not-found, active-child, and non-zero-balance outcomes. Migration 0093 remains the authoritative race-safe database guard.
- The account UI exposes archive only for active accounts, announces errors/status, supports keyboard row selection, and replaces the fabricated fixed “7 classes” KPI with tenant-derived data.
- All eight accounting page boundaries propagate Arabic RTL direction; primary headings/actions are Arabic-aware and physical alignment/spacing uses logical start/end utilities.
- Fresh scoped TypeScript: PASS (62 roots). Scoped `git diff --check`: PASS. Tenant isolation: zero Accounting/Finance findings; five unrelated Guard/Leadership findings remain globally.
- Docker/PostgreSQL was unavailable for the final rerun (`ECONNREFUSED :5432`), so prior recorded DB/Docker evidence remains the latest valid runtime evidence; no fresh live pass is claimed.

- Full repository `npx tsc --noEmit`: exit 0.
- Isolated production Docker build: `DOCKER_BUILD_EXIT=0`.
- Accounting/Finance routes: zero tenant-isolation findings; five unrelated Guard/Leadership findings remain globally.
- Compose services are healthy and authenticated French page smoke is recorded.
- Arabic/RTL and exploratory browser testing remain manual sign-off items. Older pending build/typecheck rows below are superseded by this update.

Baseline recorded 2026-08-09 against the live worktree and `migrations/meta/_journal.json`
(journal index 99 ends at `0098_accounting_bank_reconciliation`; `0091_live_classrooms_schedule_overlap`
and `0096_school_leadership_portal` are concurrent tasks' files — do not touch). This matrix maps
every plan phase and the 8 work areas of the completion brief to existing code and tests, and flags
every gap.

Legend: ✅ present · ⚠️ partial · ❌ missing · 🔴 gap that must be closed before sign-off

## 1. Source-of-truth map

| Requirement source | Location |
|---|---|
| Implementation plan | `future-implementation/office-accounting/OFFICE-ACCOUNTING-IMPLEMENTATION-PLAN.md` |
| Manual testing | `future-implementation/office-accounting/MANUAL-TESTING.md` |
| ADR | `future-implementation/office-accounting/.implementation-plan/ACCOUNTING-ADR.md` |
| Shared UI/app context | `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` |
| Completion brief (8 areas + mandatory tests) | controlling user message |

## 2. Existing ledger & extension baseline (read-only discovery)

### Migrations (applied, idempotent)
| Migration | Tables added | Invariants added |
|---|---|---|
| `0039_add_double_entry_ledger.sql` | `chart_of_accounts`, `fiscal_periods`, `journal_entries`, `journal_entry_lines`, `bank_accounts`, `bank_reconciliations` | core ledger; **DB-layer invariants for all sources**: row CHECK one-sided lines, DEFERRED ≥2-line + exact-balance triggers, immutability triggers, open-period + same-tenant active-account scope |
| `0042_harden_finance_reference_integrity.sql` | — | reference integrity |
| `0057_add_journal_line_reconciliation_link.sql` | `journal_entry_lines.reconciliation_id` | reconciliation link |
| `0085_office_accounting_foundation.sql` | `accounting_journals`, `accounting_voucher_types`, `accounting_numbering_series`, `accounting_posting_requests`, `accounting_journal_links`, `accounting_voucher_events` | tenant-composite FKs, `UNIQUE(tenant_id,id)` everywhere, numbering/lock CHECKs, immutable voucher events + succeeded posting-request triggers, source/version/idempotency uniqueness, `journal_links.reversal_unique` = one reversal per original |
| `0089_office_accounting_workflow.sql` | `accounting_documents`, `accounting_document_lines`, `accounting_document_events` | draft→approve lifecycle, `one_side` CHECK on lines, supplier-reference partial unique, immutable posted doc + events triggers |
| `0090_office_accounting_reconciliation.sql` | `accounting_reconciliation_matches` | tenant-safe match table, completed-reconciliation immutability trigger |
| `0093_harden_ledger_invariants.sql` | — | chart-of-accounts mutation guard: delete of used/parent accounts blocked, type-change on posted accounts blocked, archive only when zero net balance + no active children |
| `0097_accounting_period_close_reopen.sql` | `accounting_closing_runs`, `accounting_closing_balances`, `accounting_period_reopen_requests`, `accounting_period_events` | close snapshot (balanced totals, one active run per period, run/balances/events immutable); two-step maker-checker reopen (one pending request per period, pending→approved\|rejected only); immutable close/request/decision audit trail |
| `0098_accounting_bank_reconciliation.sql` | `accounting_statement_imports`, `accounting_statement_lines`, `accounting_statement_matches`, `accounting_reconciliation_events` (+ `bank_reconciliations.reconciled_at`) | replay-safe CSV import batches (SHA-256 content fingerprint, `UNIQUE(tenant,recon,fingerprint)`); one-sided statement lines with unmatched→partial→matched lifecycle; pair-unique statement↔journal matches enabling split (one line → several journal lines) and merge (several lines → one journal line); immutable reconciliation event log; once a reconciliation is `completed` every statement artifact (lines/matches/imports) is DB-immutable on INSERT/UPDATE/DELETE |

### Services
| Service | File | Coverage |
|---|---|---|
| Posting | `src/features/accounting/services/posting-service.ts` | ✅ balanced ≥2 one-sided exact-cent lines, payload digest, advisory locks (idempotency + numbering), open-period check, tenant-validated accounts/voucher, idempotent replay / 409 on changed payload, reversal (equal-and-opposite, linked) |
| Source documents | `src/features/accounting/services/document-service.ts` | ✅ draft→submit→approve/reject→post→reverse, maker-checker, idempotent re-post, posted-document immutability |
| Reconciliation | `src/features/accounting/services/reconciliation-service.ts` | ✅ bounded validated CSV import (1 Mo / 5 000 rows, RFC-4180 quoting, header/amount/date validation); replay-safe imports (SHA-256 fingerprint, re-import returns `alreadyImported`); statement-line lifecycle match/unmatch/split/merge (over-match guards on both sides); controlled fee/interest postings through the canonical posting service (offset account_type enforced); signed close (unmatched-line block, explicit variance reason, reconciled_at, idempotent); immutable events |
| Money | `src/libs/finance/money.ts` | ✅ bigint cents, exact two-decimal |
| Context/roles | `src/libs/api/context.ts` | ✅ `requireRequestContext`, `requireTenant` |

### API surface (`src/app/api/finance/accounting/**`)
| Route | Capabilities | Notes |
|---|---|---|
| `accounts` | `accounting.account.read/​manage` | ✅ list/search/create; parent tenant check |
| `journals` | — | ✅ list/create (verify guard) |
| `voucher-types` | — | ✅ list/create |
| `periods` | `accounting.statement.read`, `accounting.period.close` | ✅ list/create |
| `periods/[id]/close` | `accounting.period.close` | ✅ blockers + immutable ledger snapshot (`accounting_closing_runs`/`_balances`) + 'closed' audit event; idempotent |
| `periods/[id]/reopen` | `accounting.period.reopen` | ✅ two-step maker-checker: request (reason ≥10) then decide (approve/reject by different actor); approval reopens + supersedes snapshot; immutable events |
| `periods/[id]/reopen-requests` | `accounting.period.reopen` | ✅ GET the reopen-request queue for a period (drives the approve/reject UI) |
| `periods/[id]/reopen-requests/[requestId]/decide` | `accounting.period.reopen` | ✅ approve (reopen + supersede) or reject; requester ≠ approver |
| `deposits` | `accounting.account.read`, `accounting.deposit.create` | ✅ immediate posting via central service |
| `expenses` | `accounting.account.read`, `accounting.expense.prepare` | ✅ draft document |
| `expenses/[id]/submit|approve|reject|post` | expense/approve/post | ✅ maker-checker via service |
| `journal-entries` | `accounting.journal.create`+`voucher.post` | ✅ manual balanced posting |
| `transactions` | `accounting.account.read` | ✅ paginated GL, debits/credits |
| `transactions/[id]` | `accounting.account.read` | ✅ drill-down: lines+events+link |
| `transactions/[id]/reverse` | `accounting.voucher.reverse` | ✅ linked reversal |
| `trial-balance` | `accounting.statement.read` | ✅ totals + `balanced` flag |
| `statements/[type]` | `accounting.statement.read` | ✅ profit-loss + balance-sheet (`asOf`), general-ledger (opening/movement/closing, `from`/`to`), cash-flow (indirect treasury bridge); `runId` reads the pinned closing snapshot; `?format=csv` gated by `accounting.export` |
| `statements/drill-down` | `accounting.statement.read` | ✅ bounded account drill-through with running balance, capped at 1000 |

### Reconciliation (`src/app/api/finance/bank-reconciliation/**`)
| Route | Capabilities | Notes |
|---|---|---|
| `bank-reconciliation` | `finance.read` / `finance.manage` | ✅ create draft + list |
| `bank-reconciliation/[id]` | `finance.read` | ✅ detail: reconciliation + statement lines + matches + imports + events |
| `bank-reconciliation/[id]/import` | `accounting.reconcile` | ✅ bounded CSV import; 413 oversized / 422 malformed / replay-safe |
| `bank-reconciliation/[id]/match` | `accounting.reconcile` | ✅ legacy journal-line match (unchanged) |
| `bank-reconciliation/[id]/matches` | `accounting.reconcile` | ✅ statement-line ↔ journal-line match (partial/split capable, over-match guards) |
| `bank-reconciliation/[id]/matches/unmatch` | `accounting.reconcile` | ✅ unmatch one or all matches on a statement line |
| `bank-reconciliation/[id]/split` | `accounting.reconcile` | ✅ split one statement line across several journal lines (atomic) |
| `bank-reconciliation/[id]/merge` | `accounting.reconcile` | ✅ merge several statement lines onto one journal line (atomic) |
| `bank-reconciliation/[id]/fee-interest` | `accounting.reconcile` | ✅ controlled fee/interest posting via canonical posting service (offset type enforced) |
| `bank-reconciliation/[id]/close` | `accounting.reconcile` | ✅ signed close: unmatched-line block, explicit variance reason, reconciled_at, idempotent; immutability after close at DB layer |

### Pages (page-guarded)
| Page | Notes |
|---|---|
| `dashboard/finance/accounting/accounts` | ✅ Chart of Accounts |
| `dashboard/finance/accounting/voucher-types` | ✅ Journals/Voucher types |
| `dashboard/finance/accounting/deposits/new` | ✅ Deposit voucher |
| `dashboard/finance/accounting/expenses` | ✅ Expense workflow |
| `dashboard/finance/accounting/transactions` | ✅ GL view |
| `dashboard/finance/accounting/student-accounting` | ✅ Student mappings / exception queue / source→ledger reconciliation |
| `dashboard/finance/accounting/statements` | ✅ balance générale / grand livre / résultat / bilan / flux de trésorerie + forage + export CSV |
| `dashboard/finance/accounting/periods` | ✅ create / close / reopen request / maker-checker approve-reject queue |
| `dashboard/finance/expenses/new` | ✅ expense draft intake |
| `dashboard/finance/bank-reconciliation` | ✅ full lifecycle UI: import CSV, match/unmatch, split, merge, fee/interest posting, signed close, events log (drives every 0098 route) |
| `dashboard/finance/journal` | pre-existing finance journal page |

### Permissions (`src/libs/api/permissions.ts`)
All `accounting.*` keys exist (lines 54–68). Accountant defaults (266–282) grant all
accounting keys **except** `accounting.period.reopen` and `accounting.period.reopen` is
deliberately withheld (exceptional). ✅ `accountant` also lacks `hr.*` (documented).

### Existing evidence suites (`scripts/*`)
| Suite | Result | Covers |
|---|---|---|
| `migrate-0085-office-accounting.ts` | ✅ PASS | apply + rerun |
| `check-0085-office-accounting.ts` | ✅ PASS | inventory |
| `migrate-0089/0090-office-accounting.ts` | ✅ PASS | apply + rerun |
| `test-office-accounting-posting.ts` | ✅ 7/7 | 6-way race → 1 entry; exact balance; changed-payload 409; reversal; immutable events |
| `test-office-accounting-workflow.ts` | ✅ 9/9 | lifecycle, maker-checker, idempotent post, immutable posted doc, duplicate supplier ref, zero-net cleanup |
| `verify-accounting-0093.mjs` | ✅ 20/20 | migration apply + idempotent rerun; 0039 invariants (1-line, unbalanced, both-sides, zero-amount rejected; valid accepted; entries/lines immutable); 0093 account guard (delete/type-change/archive blocked; zero-balance archive, unused delete/type-change allowed) |
| `verify-accounting-0097.mjs` | ✅ 33/33 | migration apply + idempotent rerun; close blockers + immutable snapshot (run/balances/event); idempotent re-close; two-step maker-checker reopen (same-actor blocked, reject keeps closed, approve reopens + supersedes snapshot); immutability of runs/balances/events; two-tenant isolation |
| `verify-accounting-0098.mjs` | ✅ 51/51 | migration apply + idempotent rerun; CSV parser bounds (valid/malformed header/amount/date/both-sides/oversized); import + detail; match + over-match guard; balance accumulation; balanced signed close + re-close idempotency + reconciled_at; DB immutability after close (lines/matches/imports INSERT/UPDATE/DELETE + events UPDATE/DELETE); replay-safe imports (identical rejected, different accepted); unmatched-line close block; variance close requires reason; split; merge; unmatch; controlled fee/interest postings (balanced entries, idempotent replay, offset account_type enforced, events); two-tenant isolation |
| `typecheck-office-accounting.mjs` | ✅ scoped | 62 roots (incl. `src/features/accounting/**`, all `finance/accounting` + `bank-reconciliation` routes, pages, `src/features/finance/ui/bank-reconciliation-view.tsx`) |

## 3. Phase → code/test matrix

| Plan phase | Requirement | Code status | Test status | Gap to close |
|---|---|---|---|---|
| A Ledger foundation | accounts/periods/journals/numbering | ✅ 0085 + core ledger | ✅ migrate/check | 🔴 archive-not-delete accounts; prevent type change on used accounts |
| B Posting engine | balanced/idempotent/reversal/immutable | ✅ posting-service | ✅ 7/7 posting + 20/20 0093 verifier | ✅ DB-layer invariants (0039 CHECK + DEFERRED triggers + immutability; 0093 account guard) |
| C Accounts/Voucher-type pages + drill-down | pages + drill-down | ✅ | ⚠️ no browser/DB evidence yet | 🔴 browser evidence; drill-down page |
| D Deposits/expenses flows | approval/post/reversal + duplicate detection | ✅ | ✅ 9/9 workflow | ⚠️ legacy `expenses` migration/round-trip not yet reconciled |
| E Source adapters | Student Accounting adapter; Payroll contract; reconciliation evidence | ✅ student adapter (0103) | ⚠️ Payroll contract is WA6; adapter + reconciliation evidence ✅ | ✅ 0103 verifier (A1–A9); 🔴 Payroll handoff doc (WA6) |
| F Bank reconciliation | import, match/unmatch/split/merge/close | ✅ 0098 + service + 8 routes | ✅ 51/51 verifier | ✅ replay-safe CSV, lifecycle, fee/interest, signed close, post-close immutability; ✅ full lifecycle UI (`bank-reconciliation-view.tsx`) |
| G Statements + close | TB/GL/P&L/BS/cash-flow + period locks | ✅ TB/GL/P&L/BS/cash-flow + close snapshots (0097) | ✅ 16/16 reports verifier + 33/33 close verifier | ✅ GL opening/closing, drill-through, CSV export, BS result-in-equity balanced; 🔴 report UI pages |
| H Release verification | migrations, races, two-tenant, tsc, build, isolation, Docker/browser | ⚠️ | ⚠️ | 🔴 two-tenant adversarial, authenticated authz, prod build, Docker/browser |

## 4. The 8 work areas → gap list (verbatim brief mapping)

### WA2 — Harden ledger invariants
| Invariant | Status | Evidence needed |
|---|---|---|
| Exact fixed-precision balance | ✅ DB-layer (0039 DEFERRED trigger) + service | ✅ 0093 verifier (unbalanced entry rejected) |
| ≥2 valid one-sided lines | ✅ DB-layer (0039 row CHECK + DEFERRED trigger) + service | ✅ 0093 verifier (1-line, both-sides, zero-amount rejected; valid accepted) |
| Atomic transactional numbering | ✅ advisory lock + `for update` | ✅ posting race (7/7) |
| Tenant-safe composite references | ✅ composite FKs | ✅ 0085/0090 checks; 🔴 two-tenant test |
| Payload-bound idempotency + source versioning | ✅ digest + 3 unique keys | ✅ 7/7 |
| Immutable posted entries & events | ✅ entries (0039 BEFORE triggers) + events (0085) | ✅ 0093 verifier (entries/lines UPDATE+DELETE rejected) |
| One linked reversal per original | ✅ `journal_links.reversal_unique` | 🔴 double-reversal test (manual testing lists it) |
| Closed-period rejection | ✅ `FISCAL_PERIOD_CLOSED` | ✅ manual adversarial; 🔴 suite test |
| Archive (not delete) used accounts | ✅ DB guard (0093: delete blocked; archive only with zero net + no active children) | ✅ 0093 verifier; ⚠️ API archive action not exposed (accounts route is list/create only) |
| Prevent incompatible type changes on used accounts | ✅ DB guard (0093) | ✅ 0093 verifier (type change on used account rejected) |

### WA3 — Period close/reopen
| Requirement | Status |
|---|---|
| Blocker checks (pending approved docs, draft recons) | ✅ close route/service; 0097 verifier asserts both blockers reject close |
| Close evidence + snapshots | ✅ `accounting_closing_runs` + `accounting_closing_balances` (immutable, balanced totals, per-account debit/credit/net) written on close |
| Reproducible as-of statements | ✅ statements `asOf` (live) + new `runId` reads the pinned snapshot; `getClosingBalances` service |
| Exceptional reopen capability | ✅ two-step flow; `accounting.period.reopen` (exceptional) required on BOTH request and decide |
| Mandatory reason **and approval** | ✅ reason (min 10) on request; approval by a different actor mandatory (maker-checker) |
| Immutable audit history | ✅ `accounting_period_events` (immutable) records close/request/approve/reject; supersede transition is the only closing-run mutation |

### WA4 — Bank/cash reconciliation
| Requirement | Status |
|---|---|
| Bounded validated CSV import | ✅ migration 0098; `parseStatementCsv` (RFC-4180, 1MB/5k-row bounds, header+date+amount validation, one-sided debit/credit CHECK) |
| Replay-safe imports | ✅ `accounting_statement_imports.content_fingerprint` SHA-256 + `UNIQUE(tenant,recon,fingerprint)`; identical re-import → `alreadyImported:true`; race → 409 `IMPORT_REPLAY_REJECTED` |
| Statement-line lifecycle | ✅ `accounting_statement_lines` (date/description/reference/amounts, `status` CHECK unmatched/partial/matched) + imports/matches/events tables |
| Match / unmatch / split / merge | ✅ service + 4 routes; pair-unique matches, over-match guards on both sides, `partial`/`matched` status rollover |
| Controlled fee/interest postings | ✅ `fee-interest` route → `postReconciliationFeeOrInterest` → `postAccountingVoucher`; asset-offset pair validated; events recorded |
| Signed close | ✅ close route/service; blocks unmatched/partial lines and unexplained variance; race guard; idempotent re-close returns `alreadyClosed` |
| Immutability after close | ✅ DB triggers lock all statement artifacts (lines/matches/imports/events) once `status='completed'` |

### WA5 — Student Accounting adapter + source→ledger reconciliation
| Requirement | Status |
|---|---|
| Versioned posting adapter for student sources | ✅ migration 0103 (`accounting_source_mappings` + `accounting_adapter_exceptions`); `postStudentInvoice`/`postStudentPayment` route every invoice/payment through `postAccountingVoucher` with idempotency key `student_<module>:<tenant>:<doc>`; exact largest-remainder cents split keeps Dr=Cr under discounts (A1/A3/A4) |
| Missing/invalid mappings block + explicit exception queue | ✅ resolution returns null on missing mapping → exception row (`accounting_adapter_exceptions`) with the exact would-be payload; retry after mapping fix auto-resolves; resolve/dismiss lifecycle + 3 routes (A2/A5/A6) |
| Never silently post to suspense | ✅ no suspense fallback in code; blocked invoices/payments create NO journal entry and no student_* journal lines (A2 asserts both) |
| Source→ledger reconciliation report | ✅ `studentLedgerReconciliation` service + `reconcile` route; per-document state posted/blocked/pending, summary totals + drift = blocked+pending (A8) |

### WA6 — Versioned posting contract + Payroll handoff
| Contract field | Status |
|---|---|
| `sourceModule` / `sourceDocumentId` / `sourceVersion` | ✅ |
| tenant-scoped `idempotencyKey` | ✅ |
| canonical payload digest | ✅ |
| `entryDate` / `journalCode` / `voucherTypeCode` / `description` | ✅ |
| balanced account-ID lines | ✅ |
| **Returns `postingRequestId`** | ✅ `posting-service.ts` returns `postingRequestId` on both fresh and idempotent paths (read from `accounting_journal_links`) |
| Returns `entryNumber` + `idempotent` | ✅ top-level `entryNumber` + `AccountingPostingResult` type exported; `entry` rows fully typed |
| Same key/version+payload → original | ✅ |
| changed payload → 409 | ✅ |
| invalid/inactive/cross-tenant mappings block | ✅ (422 INVALID_ACCOUNT / VOUCHER_SOURCE_MISMATCH) |
| **Published typed contract + Payroll handoff doc** | ✅ `POSTING_CONTRACT_VERSION='1.0'` + `AccountingPostingInput`/`AccountingPostingResult` in `posting-service.ts`; [`POSTING-CONTRACT.md`](../POSTING-CONTRACT.md) covers replay semantics, canonical payroll journal, reverse handoff, and the latent IR rounding drift |

### WA7 — Financial reports
| Report | Status |
|---|---|
| General ledger | ✅ account-level GL with opening/movement/closing (`statements/general-ledger`, `from`/`to`) |
| Trial balance | ✅ + balanced flag |
| Profit & loss | ✅ result = revenue − expense |
| Balance sheet | ✅ + period result shown in equity; `balanced` flag (A = L + E + result) |
| Cash flow | ✅ indirect treasury bridge (`statements/cash-flow`): operating + financing = Δ treasury, reconciled flag; treasury = asset accounts with PCG Class-5 codes (`5*`) |
| Bounded drill-through | ✅ `statements/drill-down?accountId&from&to&limit` — account-scoped lines with running balance, capped at 1000 |
| Reproducible period/as-of filters | ✅ `asOf` (live), `runId` (pinned snapshot), `from`/`to` on GL/cash-flow |
| Safe CSV export | ✅ `?format=csv` on statements (all 4 types) + trial-balance; requires `accounting.export` |

### WA8 — UI states + i18n + docs + evidence
| Requirement | Status |
|---|---|
| Accounts / voucher-types / deposits / expenses / GL pages | ✅ |
| Periods page (close + maker-checker reopen queue), trial-balance + statements pages + drill-through | ✅ |
| Reconciliation states | ⚠️ basic list/create UI; 🔴 rich lifecycle UI (import/match/split/merge/close) remains |
| French + Arabic behavior | ⚠️ French present; 🔴 Arabic parity |
| Manual documentation + recorded evidence | ⚠️ existing; 🔴 full updated guide + evidence artifacts |

## 5. Mandatory-test coverage (verbatim brief) → status
| Mandated test | Status |
|---|---|
| Migration apply + idempotent rerun | ✅ 0085/0089/0090 |
| Two-tenant references | ✅ covered by the isolation assertions in the 0097 (two-tenant close/reopen), 0098 (two-tenant reconciliation), 0103 A9 (mappings/exceptions never leak), reports R7 and the new reversal-concurrency verifier (tenant B cannot reference tenant A's reversal link) |
| Balance property tests | ✅ service + DB-level (0039) + 0093 verifier |
| Atomic numbering concurrency | ✅ 7/7 race |
| Identical idempotent request races | ✅ 7/7 |
| Changed-payload replay rejection | ✅ 7/7 |
| Closed-period and reopen authorization | ✅ 0097 verifier (close blocks; reopen request→decide maker-checker; same-actor blocked; tenant-scoped) |
| Maker/checker behavior | ✅ 9/9 |
| Reversal concurrency | ✅ `verify-accounting-reversal-concurrency.mjs` 21/21: six racing reversals of the same entry → exactly one wins, five rejected at the single-reversal-link DB guard (`accounting_journal_links.reversal_of_entry_id` unique); winning-key replay is idempotent; sequential double reversal rejected; net ledger impact zero; two-tenant isolation |
| Malformed/oversized/replayed CSV imports | ✅ 0098 verifier (bad header/amount/both-sides/date, 1MB+ oversized, exact re-import replay) |
| Reconciliation split/merge and closed immutability | ✅ 0098 verifier (A3 split, A4 merge, A5 unmatch, A1 post-close immutability ×9) |
| Source-to-ledger reconciliation | ✅ 0103 verifier (A8 report: counts posted=2 blocked=1 pending=1, sourceTotal=posted+blocked+pending, drift=blocked+pending; A9 two-tenant isolation) |
| Report debit=credit and statement equations | ✅ reports verifier (`verify-accounting-reports.mjs`, 16/16): TB ΣD=ΣC; GL closing=opening+period + balanced totals; P&L result; BS A=L+E+result; cash-flow operating+financing=Δtreasury reconciled; drill-down running balance; CSV; two-tenant |
| tsc / tenant isolation / production build / Docker+browser | ⚠️ scoped tsc ✅ (62 roots); full-repo `tsc --noEmit` ✅ in the accounting scope (the previously reported 25 payroll-owned test errors are resolved by their owner; the only remaining errors are 5 in corrupted generated `.next/dev/types` files — environmental race collateral, not source); tenant-isolation static analysis: every accounting/finance route passes, repo-wide gate blocked by 6 pre-existing non-accounting routes (guard/guardian/leadership); 🔴→ isolated `docker build` is the authoritative prod-build gate (host build races a running `next dev` over `.next`); Docker/browser ✅ (compose stack healthy, DB has all accounting tables, authenticated browser fetch of every WA8 page returns 200 with its French heading) |

## 6. Next work order (drives tasks #31–#38)

1. **WA2** ledger hardening: **DONE** — 0039 already enforced balance/one-sided/immutability at the DB layer; migration **0093** adds the chart-of-accounts mutation guard, verified 20/20 (idempotent rerun + adversarial). Remaining small gap: expose an archive action on the accounts API/UI.
2. **WA3** period close/reopen: **DONE** — migration **0097** adds close snapshots (`accounting_closing_runs`/`_balances`), a two-step maker-checker reopen flow (`accounting_period_reopen_requests` + decide route), and an immutable `accounting_period_events` audit log; statements accept `runId` for reproducible as-of. Verified 33/33. UI gap closed: `finance/accounting/periods` page (create, close with mandatory reason, reopen request, approve/reject queue) + a GET reopen-requests list route.
3. **WA4** reconciliation: **DONE** — migration **0098** adds statement import/lines/matches/events tables + post-close immutability triggers; `reconciliation-service` (bounded RFC-4180 CSV parse, SHA-256 replay-safe import, match/unmatch/split/merge, fee/interest postings, signed close) + 8 API routes. Verified 51/51 + scoped tsc (62 roots). UI gap closed: `dashboard/finance/bank-reconciliation` now drives the full lifecycle — CSV import, match/unmatch, split, merge, fee/interest posting, signed close and the events log.
4. **WA5** Student Accounting adapter + exception queue + source→ledger reconciliation: **DONE** — migration **0103** adds `accounting_source_mappings` (per-type default via NULL key + partial unique index, tenant-composite FK to chart of accounts) and `accounting_adapter_exceptions` (no-suspense block queue, unique per source+version); `student-accounting-adapter` service (`postStudentInvoice`/`postStudentPayment` via the canonical posting service with idempotency keys, exact largest-remainder split, auto-resolve-on-retry, `studentLedgerReconciliation` report) + 6 API routes. Verified 9/9 scenarios (A1–A9) + scoped tsc (53 roots). UI gap closed: `finance/accounting/student-accounting` page (mappings CRUD, exception resolve/dismiss, source→ledger reconciliation).
5. **WA6** versioned posting contract + Payroll handoff: **DONE** — `postAccountingVoucher` now returns `postingRequestId` + top-level `entryNumber` on both fresh and idempotent paths; `POSTING_CONTRACT_VERSION='1.0'` with exported `AccountingPostingInput`/`AccountingPostingResult`; [`POSTING-CONTRACT.md`](../POSTING-CONTRACT.md) documents replay semantics, the canonical payroll journal, reverse handoff, and the latent IR rounding drift. Scoped tsc (53 roots) + 0103/0098 verifiers still PASS. Remaining: implement `payroll-posting.ts` against this contract (payroll-owned module).
6. **WA7** financial reports: **DONE** — `statements/general-ledger` (opening/movement/closing per account), `statements/cash-flow` (indirect treasury bridge with reconciled equation), `statements/drill-down` (bounded account drill-through), balance-sheet now shows the period result in equity and returns a `balanced` flag, and `?format=csv` on all statements + trial-balance (gated by `accounting.export`). Verified 16/16 (`verify-accounting-reports.mjs`) + scoped tsc (54 roots). UI gap closed: `finance/accounting/statements` page (balance générale / grand livre / résultat / bilan / flux de trésorerie, filtres de période, forage par compte, export CSV).
7. **WA8** missing pages: **DONE** (student-accounting + statements + periods pages + the full bank-reconciliation lifecycle UI). Remaining: Arabic parity (the accounting feature is French-only by codebase convention), full updated manual-testing guide, and #38 evidence.
8. **#38** mandatory verification suite + two-tenant/adversarial authz + prod build + Docker/browser.

> Non-certification stands: Morocco chart/tax/statutory mappings remain uncertified until a
> qualified local accountant approves them (ADR compliance boundary; brief §1).
