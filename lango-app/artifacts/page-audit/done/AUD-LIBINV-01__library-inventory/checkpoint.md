# AUD-LIBINV-01 — CHECKPOINT (resume point)

- task: AUD-LIBINV-01 — Library + Inventory Operational Workflows
- agent: codex-2 (Executor C)
- target branch: origin/student-directory-hardening
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-LIBINV-01`
- branch: `audit/agent-c/AUD-LIBINV-01-library-inventory`
- hub claims held: `task:AUD-LIBINV-01`, `task:port-3459`
- claim files: `src/features/library`, `src/features/inventory`,
  `src/app/api/addons/library`, `src/app/api/addons/inventory`, this folder
- dev server: port 3459, `NEXT_DIST_DIR=.next-agentc`, DATABASE_URL -> `schoolos_audit`
- node_modules: real `npm install --ignore-scripts` DONE (junction breaks Turbopack;
  better-sqlite3 node-gyp fails, so --ignore-scripts is required)
- EDIT IN THE WORKTREE. The Edit tool defaults to the shared tree; that mistake
  cost time in two earlier campaigns.

## ROUTE INVENTORY (discovered from filesystem + guards, NOT assumed) — 20 pages
LIBRARY (7):
  /dashboard/library                       hub / circulation workspace
  /dashboard/library/catalog               catalogue
  /dashboard/library/catalog/[id]          record detail (use 7490535a-bb8b-415f-8f76-fd5d4f5efbd6)
  /dashboard/library/categories
  /dashboard/library/me                    self-service (student/teacher)
  /dashboard/content/library               content-managed library landing
  /dashboard/content/types
INVENTORY (13):
  /dashboard/inventory                     hub
  /dashboard/inventory/overview
  /dashboard/inventory/products            (detail id 894838c8-9ce3-481f-a468-543a5d399d2e)
  /dashboard/inventory/categories
  /dashboard/inventory/units
  /dashboard/inventory/stores
  /dashboard/inventory/suppliers
  /dashboard/inventory/stock
  /dashboard/inventory/purchases
  /dashboard/inventory/sales
  /dashboard/inventory/issues
  /dashboard/inventory/transfers
  /dashboard/inventory/adjustments

NOTE: the brief's "expected areas" (circulation, loans, returns, renewals, holds,
overdue, fines, reports, settings/policies, members) are NOT separate pages — they
live inside the library hub/catalog screens and the API. Do not invent pages.

## VERIFIED STRONG (do not "fix")
- `inventory-math.ts`: decimal-safe BigInt "millis" arithmetic (matches the money
  discipline), strict qty regex rejecting negatives/junk, half-up rounding.
- `inventory-transactions.ts`: the single stock choke point — append-only ledger,
  balance projection in the same tx, deterministic (productId,storeId) lock order,
  negative balance -> 409 INSUFFICIENT_STOCK + rollback, unique(tenant,idempotencyKey)
  with isIdempotencyViolation() downgrade to idempotent success.
- `library-service.ts`: issueCopy is idempotent (idempotencyKey + 23505 re-read),
  refuses double loans even with override (DB partial-unique is the arbiter),
  enforces member policy/blocked/loan limit, honours the first waiting hold and
  fulfils it on issue. renewLoan uses optimistic concurrency (expectedRenewedCount),
  renewal limit, and blocks on a waiting hold. returnLoan is idempotent
  (returns the already-closed loan). computeDueDate skips branch + tenant closures.
- `library-operations-service.ts`: transfers have a strict state machine, stocktake
  observations are upsert-idempotent, stocktake close only flags available copies.
- Tenant scoping on every lookup (`eq(tenantId, ...)`) throughout.

## FINDINGS + FIX (DONE in worktree)
F-01 FIXED  Business date taken from the UTC ISO string instead of the Casablanca
            school day — the same defect family as AUD-OPS-01 F-02/F-05, and
            `libs/finance/today.ts` exists precisely for it. Affected 13 files /
            ~20 sites across BOTH modules: loan due-date base and due-date walk,
            overdue report, overdue issue detection, inventory overdue counts,
            libraryOverview/ownLibraryHome "today", returnDate/expenseDate defaults,
            order/sale form defaults, and 5 client-side overdue highlights.
            Consequence: a book borrowed in the first Moroccan hour was dated a day
            early and came back due a day short; overdue lists lit up an hour early.
            FIX: `casablancaTodayIso()` everywhere.
TEST: src/features/library/__tests__/business-date.test.ts (4 tests) — proves the
            midnight-edge property (23:30 UTC -> next Casablanca day) and statically
            forbids `toISOString().slice(0,10)` in either module.

## TESTS: 74/74 PASS (13 files) after F-01
Includes all pre-existing suites (library-service, operations, policy incl. the
closure-day due-date test, self-service, guard, catalog, copies-csv,
accounting-adapter; inventory-math, reorder-policy, inventory-guard,
inventory-accounting) + 4 new.

## NEXT EXACT ACTION
1. Read /tmp/agentc-li-gates2.log (check:types/isolation/ui/i18n) — types were
   clean after the import-placement repair.
2. Sweep 20 routes desktop FR as school_admin on port 3459, plus /dashboard/library/me
   under student and teacher (self-service visibility is an explicit brief item).
   AUDIT_BASE=http://localhost:3459 node scripts/visual-sweep.mjs school_admin routes.txt out/
3. Mobile 390 + AR RTL on changed pages (library hub, inventory issues, purchases).
4. report.md from shared/REPORT_TEMPLATE.md with a complete 20-row route matrix for
   BOTH modules, plus the lifecycle proofs requested by the brief.
5. commit -> push -> `hub done task:AUD-LIBINV-01` -> release both claims -> stop.

## GOTCHA already hit once here
A codemod that inserts `import ...` after "the last import line" breaks files with
MULTI-LINE import blocks (it lands inside `import {`). The safe rule: an import
statement ends at the line matching `from ['"]`. Re-run check:types after any
automated import insertion.
