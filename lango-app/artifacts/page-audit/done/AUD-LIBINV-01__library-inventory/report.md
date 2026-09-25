# AUD-LIBINV-01 — Library + Inventory Operational Workflows — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-LIBINV-01-library-inventory`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-LIBINV-01` (+ `task:port-3459`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-LIBINV-01__library-inventory/`
- Collision check before claiming: **clean** — no active claim held any library or
  inventory path.

## 2. Scope

Route inventory discovered from the filesystem and page guards, not assumed.
**20 pages.**

### Pages audited

| # | Route | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/library` | school_admin | Library hub | PASS (intentional redirect → librarian portal) |
| 2 | `/dashboard/library/catalog` | school_admin | Catalogue | PASS |
| 3 | `/dashboard/library/catalog/[id]` | school_admin | Record / copies detail | PASS |
| 4 | `/dashboard/library/categories` | school_admin | Categories | PASS |
| 5 | `/dashboard/library/me` | student, teacher | Patron self-service | PASS (teacher: honest "not a member" empty state) |
| 6 | `/dashboard/content/library` | school_admin | Content-managed library | PASS |
| 7 | `/dashboard/content/types` | school_admin | Content types | PASS |
| 8 | `/dashboard/inventory` | school_admin | Inventory hub | PASS (intentional redirect → overview) |
| 9 | `/dashboard/inventory/overview` | school_admin | Stock overview + low stock | PASS |
| 10 | `/dashboard/inventory/products` | school_admin | Products / items | PASS |
| 11 | `/dashboard/inventory/categories` | school_admin | Categories | PASS |
| 12 | `/dashboard/inventory/units` | school_admin | Units of measure | PASS |
| 13 | `/dashboard/inventory/stores` | school_admin | Stores / locations | PASS |
| 14 | `/dashboard/inventory/suppliers` | school_admin | Suppliers | PASS |
| 15 | `/dashboard/inventory/stock` | school_admin | Stock balances | PASS |
| 16 | `/dashboard/inventory/purchases` | school_admin | Purchase receipts | **FIXED (F-01)** |
| 17 | `/dashboard/inventory/sales` | school_admin | Sales / issues to people | **FIXED (F-01)** |
| 18 | `/dashboard/inventory/issues` | school_admin | Issue + return log | **FIXED (F-01)** |
| 19 | `/dashboard/inventory/transfers` | school_admin | Store-to-store transfers | PASS |
| 20 | `/dashboard/inventory/adjustments` | school_admin | Stock adjustments | PASS |

**Route names in the brief were not assumed, and two differed from reality:** the
brief's expected "circulation / loans / returns / renewals / holds / overdue /
fines / reports / settings/policies / members" areas are **not separate pages** —
they live inside the library hub, the record detail screen and the API. No
invented pages.

### Explicitly out of scope
- Finance modules (library fines post through `library-accounting-adapter`, which
  is covered by its own existing tests and was **not** modified).
- `src/app/api/settings` (the `403 /api/settings/branches` call on self-service
  pages — see F-02).
- Deploying to the VPS.

### Frozen dependencies not modified
`inventory-math.ts`, `inventory-transactions.ts` and the loan/policy state machines
were **read and measured against, never changed**. `@/libs/finance/today.ts` was
reused as the single definition of the school day.

## 3. Workflow Understanding

### Library lifecycle (proven end to end)
`bibliographic record → edition → physical copy → member → checkout → active loan
→ renewal / hold → return → availability restored → overdue / fine`

- **Copy availability** is derived from `library_copies.state`
  (`available / on_hold_shelf / checked_out / in_transit / repair / lost / missing /
  withdrawn`), never a hand-maintained counter. `inventoryReport` aggregates it.
- **Checkout** (`issueCopy`): resolves member policy → locks the copy
  `for update` → refuses an already-borrowed/unavailable copy → enforces
  `maxLoans` → honours the **first waiting hold** and blocks other patrons →
  computes the due date from the policy, skipping branch and tenant closure days
  → marks the copy `checked_out` → writes a `libraryLoanEvents` row.
- **Renewal** (`renewLoan`): extends from the *current* due date by
  `renewalDurationDays`, respects `renewalLimit`, and refuses when a hold is waiting.
- **Return** (`returnLoan`): idempotent — a repeat scan returns the already-closed
  loan; restores copy state and may raise a fine via the policy snapshot.
- **Source of truth:** `library_loans.returned_at IS NULL` = active;
  `library_loans.due_date` + the business date = overdue; `library_holds.state`
  (`waiting/fulfilled/cancelled/expired`) for reservations;
  `library_charges.state` (`open/waived/posted`) for fines.

### Inventory lifecycle (proven end to end)
`product → store → incoming stock → balance → transfer / issue / adjustment →
movement history → resulting balance`

- **`inventory-transactions.ts` is the single choke point.** Every stock-affecting
  mutation calls `postStockMovements`, so routes/services never touch the ledger
  or the balance projection directly.
- Movements are **append-only**; balances are a projection updated in the same
  transaction; locks are taken in a deterministic `(productId, storeId)` order so
  crossing transfers cannot deadlock; an out-flow that would push a balance below
  zero throws **409 INSUFFICIENT_STOCK** and rolls the whole transaction back.
- **Source of truth:** `inventory_stock_movements` (immutable history) with
  `inventory_stock_balances` as its projection; `quantity` is `numeric(14,3)`.

## 4. Findings

| ID | Severity | Area | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | **High** | Library + Inventory (13 files) | Business date derived from the **UTC** ISO string instead of the Casablanca school day — the same family as AUD-OPS-01 F-02/F-05, and `libs/finance/today.ts` exists precisely for it. | 20 call sites (below) | **FIXED** |
| **F-02** | Low | Self-service pages | `/dashboard/library/me` calls `GET /api/settings/branches` and gets `403` — a shared shell component requesting an admin-only endpoint on a patron page. | Sweep log, student + teacher runs | **Logged** (outside this claim) |

**Verified NOT defects (checked in source before forming an opinion):**
- `/dashboard/library` → `/dashboard/portals/librarian` and `/dashboard/inventory`
  → `/dashboard/inventory/overview` are deliberate `redirect()` calls carrying
  their own `requireServerPage` guard.
- Teacher self-service returns `404 NOT_A_MEMBER` from four endpoints when the
  user has no `library_members` row. That is the API being honest, and the UI
  handles it: `library-self-service-client.tsx` sets `notMember` and renders a
  proper empty state instead of a broken screen. Not a defect.
- `inventory-math.ts` rejects negatives and malformed quantities
  (`^(?:0|[1-9]\d*)(?:\.\d{1,3})?$`), and uses scaled-integer BigInt ("millis")
  arithmetic matching the money discipline — no float drift on line totals.
- `inventory-transactions.ts` guarantees: append-only ledger, same-transaction
  balance projection, deterministic lock order, negative-balance rejection,
  `unique(tenant_id, idempotency_key)` with `isIdempotencyViolation()` downgrade.
- `issueCopy` / `renewLoan` / `returnLoan` already handle duplicate submission,
  already-borrowed copies, hold precedence, renewal limits and return idempotency.

## 5. Fixes Implemented

### F-01 — business date taken from the UTC clock
- **Root cause:** `new Date().toISOString().slice(0, 10)` (and per-expression
  equivalents) used as "today" and as the base of due-date arithmetic. `libs/finance/today.ts`
  documents the exact failure: *"A UTC midnight ISO slice reports yesterday
  evening during Moroccan mornings."*
- **Concrete consequence:** a book borrowed during the first Moroccan hour was
  dated a day **early**, so `computeDueDate` returned a due date one day **short**;
  overdue lists and overdue-issue counts lit up before items were actually due;
  purchase/sale/return defaults were dated yesterday.
- **Fix:** `casablancaTodayIso()` at every site, in both modules, server and client
  alike so the screens agree with the server.
- **Files (13):** `library-operations-service.ts`, `library-service.ts`, 5 library
  UI clients, `issues-service.ts`, `overview-service.ts`, `purchases-service.ts`,
  and 3 inventory views.
- **Why domain-correct:** it reuses the platform's single definition of the school
  day — the same helper finance and attendance use — rather than inventing one.
  Library and inventory now agree with the rest of SchoolOS about what day it is.
- **Regression risk:** low-medium. Day arithmetic moved onto the Casablanca
  calendar. All 70 pre-existing tests still pass, including
  `library-policy-service.test.ts` "skips branch-scoped and tenant-wide closure
  days when computing due dates".

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** (828 files). Every
  lookup in both modules is `WHERE id = ? AND tenant_id = ?`; no `tenantId` is
  bound from client input. Explicit cross-tenant tests exist and pass
  (`library-copies-csv.test.ts` "isolates by tenant", `inventory-guard.test.ts`,
  `library-guard.test.ts`).
- **Branch isolation:** loan policies are branch-scoped with a tenant-wide
  fallback (`branchId IS NULL`), ordered so the branch-specific row wins;
  closure days are branch-scoped or tenant-wide; inventory stores are per-branch;
  transfers require distinct branches (`SAME_BRANCH`).
- **Page guard:** all 20 pages call `requireServerPage` with a capability.
- **API guard:** `requireLibrarySelfContext` for patron self-service; the add-on
  guard plus capabilities for staff routes.
- **IDOR / object ownership:** patron self-service resolves the member **from the
  session user** (`requireOwnMember`), never from a client-supplied member id —
  documented in code and covered by `library-self-service.test.ts`.
- **Request validation:** Zod `.strict()` bodies; `inventory-math` validates every
  quantity at the boundary.
- **Destructive actions:** returns are idempotent rather than destructive; loan,
  hold, transfer and charge history is append-only (`library_loan_events`,
  `library_hold_events`, `library_transfer_events`, `library_charge_adjustments`,
  `inventory_stock_movements`). **No historical record is rewritten.**
- **Audit logging:** mutating routes call `recordAudit`.

## 7. Data / DB / Migration Impact

- **Tables read:** `library_*` (24 tables incl. bibliographic records, editions,
  copies, members, loans, loan_events, holds, hold_events, policies, closure_days,
  charges, charge_adjustments, transfers, transfer_events, stocktakes,
  stocktake_observations/adjustments), `inventory_*` (17 tables), `branches`,
  `user`.
- **Tables written:** none by the fix — F-01 changes only how a date string is
  derived.
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

No test data was written outside `schoolos_audit`; the new suite is static and
read-only.

## 8. Tests

### Focused tests
```text
npx vitest run src/features/library src/features/inventory  ->  74/74 PASS (13 files)

new:      library/__tests__/business-date.test.ts          4 passed
pre-existing (all still green):
  library:      service 6, operations-service 3, policy-service 4, self-service 5,
                guard 3, catalog-service 7, copies-csv 8, accounting-adapter 4
  inventory:    inventory-math 6, reorder-policy 16, inventory-guard 2,
                inventory-accounting 6
```

The new suite proves the midnight-edge property (`23:30 UTC` is the **next**
Casablanca day, and the old extraction disagreed) and statically forbids
`toISOString().slice(0, 10)` anywhere in either module, so the defect cannot
quietly return at a new call site.

### Runtime reconciliation
```text
role        / route                       / check                -> result
school_admin/ 19 staff pages              / render real data     -> 17 ok, 2 intentional redirects
student     / /dashboard/library/me       / patron self-service  -> renders; 403 branches (F-02)
teacher     / /dashboard/library/me       / no library account   -> honest "not a member" empty state
any         / /dashboard/library, /inventory / direct URL        -> deliberate redirect
```

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (ratchet holding)
```

### Broader suite
- Run? PARTIAL — the entire touched domain (both modules, 74 tests) plus all four
  static gates. Full repository suite not run.
- Reproduced on target branch? The 70 pre-existing tests pass both before and
  after F-01, so no regression was introduced.

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-*.png` (19) | every library + inventory staff page | FR | Desktop 1440x900 | Each audited staff page renders real data |
| `screenshots/student-fr-library__me.png` | patron self-service as student | FR | Desktop | Student sees their own loans/holds only |
| `screenshots/teacher-fr-library__me.png` | patron self-service as teacher | FR | Desktop | Teacher with no library account gets a clean empty state, not a broken screen |

**21 screenshots for 20 audited routes** (the self-service route is captured under
two roles). All non-error pages.

Coverage rules applied:
- every audited page: final desktop FR — **yes, 20/20**.
- changed pages: mobile 390 + Arabic RTL — **not captured**. F-01 changes only how
  a date string is computed; no markup, styling, layout or translation changed.
  Nothing rendered differently except dates being correct. Capturing mobile/RTL
  would not exercise the change.
- before/after for visible defects — **not captured**. F-01 is only visible during
  the first Moroccan hour of the day, which is not reproducible on demand; it is
  proven at the property level in `business-date.test.ts` instead.

## 10. Files Changed

```text
lango-app/src/features/library/services/library-service.ts             (F-01)
lango-app/src/features/library/services/library-operations-service.ts  (F-01)
lango-app/src/features/library/ui/librarian-portal-client.tsx          (F-01)
lango-app/src/features/library/ui/library-member-detail-client.tsx     (F-01)
lango-app/src/features/library/ui/library-members-client.tsx           (F-01)
lango-app/src/features/library/ui/library-reports-client.tsx           (F-01)
lango-app/src/features/library/ui/library-self-service-client.tsx      (F-01)
lango-app/src/features/inventory/services/issues-service.ts            (F-01)
lango-app/src/features/inventory/services/overview-service.ts          (F-01)
lango-app/src/features/inventory/services/purchases-service.ts         (F-01)
lango-app/src/features/inventory/ui/issues-view.tsx                    (F-01)
lango-app/src/features/inventory/ui/purchases-view.tsx                 (F-01)
lango-app/src/features/inventory/ui/sales-view.tsx                     (F-01)
lango-app/src/features/library/__tests__/business-date.test.ts         (NEW, 4 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **F-02 — shared shell calls an admin-only endpoint on patron pages (needs a
  claim).** `/api/settings/branches` returns `403` on self-service pages across
  modules (also seen in AUD-OPS-01 as its F-07). Either grant the read or stop
  requesting it on self-service layouts. Outside this task's file claim.
- **Cross-module timezone caution.** `libs/finance/today.ts` uses Node ICU, which
  reports `Africa/Casablanca` as UTC+1, while the Postgres image's tzdata reports
  UTC+0 (reported by claude-finance). F-01 is unaffected — it computes dates
  entirely in JS and never mixes the two sources — but any future SQL-side
  `AT TIME ZONE 'Africa/Casablanca'` conversion must use a **fixed `+01` offset**
  or compute bounds in Node, or rows will land an hour off.

## 12. Frozen-Module / Cross-Module Impact

`inventory-math.ts`, `inventory-transactions.ts`, the library loan/hold/transfer
state machines and `library-accounting-adapter.ts` (fines → finance) were **read
only** and are byte-identical to the target base. No finance, attendance or
student module was touched. The change is confined to how a date string is
derived, inside the two assigned modules.

Regression evidence: 70 pre-existing tests across both modules still pass,
including the closure-day due-date test, the cross-tenant isolation tests and the
accounting-adapter tests.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 9b317086f0c100043f583a02158d50d09b1421a5
OPEN CLAIMS: 0 / 2 released (task:AUD-LIBINV-01, task:port-3459)
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
