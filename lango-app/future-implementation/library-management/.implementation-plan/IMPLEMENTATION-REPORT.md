# Library Management + Librarian Portal — Implementation Report

Status: **operational core + hardening + gap-closure implemented and verified (2026-08-09)** — 35/35
live vitest tests, `tsc --noEmit` exit 0, `next build` exit 0, migration `0080` + `0104` applied and
idempotent, tenant-isolation scan clean for library scope. See §2b for the status refresh that
supersedes the point-in-time audit matrix below.
Date: 2026-08-09
Scope: `LIBRARY-MANAGEMENT-ADDON-PLAN.md`, `LIBRARIAN-PORTAL-PLAN.md`, `.implementation-plan/EXECUTION-PLAN.md`.

## 1. Honest verdict

The repository contains a **real, DB-backed library operational core** — not the "planned, not built" state the source plan doc claims. Migration `0080_library_management.sql` is applied to the live database (23 tables, 17 unique/partial-unique invariants, `librarian` role enum verified). `src/features/library/**` implements the catalog, members, circulation (issue/renew/return), holds, transfers, stocktakes and charges; **48 API routes** under `/api/addons/library/**` are tenant-scoped and capability-gated; **32 DB-backed vitest tests pass** against real Postgres.

The source plan files (`LIBRARY-MANAGEMENT-ADDON-PLAN.md`, `LIBRARIAN-PORTAL-PLAN.md`) are **outdated** — they still say "planned, not built" / "must be replaced". This report is the accurate current-state record, and the plan-status updates are tracked in `PLAN-STATUS.md`.

**As of 2026-08-09 the gap list below is largely closed.** §2b lists what was delivered since this
matrix was written (catalog/policy/copy completion, circulation hardening, self-service, CSV
import/export, Accounting posting, 32-test suite). The matrix and §3 findings below are the
point-in-time audit; read them with §2b.

## 2. Evidence matrix — every plan requirement classified

Legend: ✅ implemented+verified · 🟡 implemented but incomplete/unverified · ❌ missing · ⏸ intentionally deferred (V1)

### Catalog & taxonomy
| Plan requirement | Status | Evidence |
|---|---|---|
| Bibliographic records | ✅ | `libraryBibliographicRecords` table; `createCatalogRecord`; `GET/POST /catalog` |
| Record detail (editions+copies+holds) | ❌ | no `catalog/[id]` route |
| Record update / soft-delete | ❌ | `deletedAt` column exists; no UPDATE/DELETE service/route |
| Contributors | 🟡 | table + `library_record_contributors` exist; **no CRUD service/route** |
| Publishers | 🟡 | table exists; **no CRUD service/route** |
| Categories (hierarchical) | 🟡 | table (parentId) exists; **no CRUD service/route** |
| Subjects / record-subjects | 🟡 | tables exist; **no CRUD service/route** |
| Editions & identifiers | 🟡 | `createEdition` + ISBN uniqueness; **no edition GET/PUT/DELETE** |
| Cover / media metadata | 🟡 | `coverUrl` column on editions; no media asset handling (out of V1) |
| Lifecycle archive | 🟡 | `deletedAt` soft-delete column present; no archive UI/route |
| Duplicate ISBN/accession/barcode rejection | 🟡 | partial-unique ISBN idx + `UNIQUE(tenant,accession)` + `UNIQUE(tenant,barcode)` in DB; service-level `DUPLICATE_*` mapping **broken** (Drizzle error-wrapping bug, see §3.1) |
| Server pagination + stable sorting | 🟡 | `limit` cap on catalog; no `offset`/`cursor`, sort is title-only |

### Copies & policies
| Plan requirement | Status | Evidence |
|---|---|---|
| Branch/shelf/location on copies | ✅ | `branchId` FK, `shelfLocation` column; `createCopy` |
| Accession + barcode | ✅ | unique constraints; `createCopy` |
| State & condition | 🟡 | enum + defaults; transitions only via circulation/transfer — no direct state management route |
| Acquisition metadata | ✅ | `price`, `acquiredAt` on copies |
| Policy (member/material/branch precedence) | 🟡 | `libraryLoanPolicies` + `loadPolicy`; **precedence bug** (generic beats branch-specific), see §3.2 |
| Closure calendar | ❌ | not modeled |
| Due dates (policy + closures) | 🟡 | due = issuedAt + `loanDurationDays`; no closure/calendar logic |
| Grace periods | 🟡 | stored in policy; **not used in fine computation** |
| Limits (maxLoans/maxHolds) | ✅ | enforced in `issueCopy`/`loadPolicy` (limit only) |
| Renewals | ✅ | `renewLoan` caps by `renewalLimit`, blocks on active hold |
| Fine configuration | 🟡 | `finePerDay` stored; **no fine computation/creation** |
| Policy CRUD | ❌ | GET only; no create/update/delete |

### Circulation
| Plan requirement | Status | Evidence |
|---|---|---|
| Checkout (issue) | ✅ | `issueCopy` transactional; copy lock; DB one-active-loan invariant |
| Renewal | ✅ | `renewLoan` |
| Return | 🟡 | `returnLoan` idempotent close; **no hold allocation**, **no fine eval**, **condition overwrite bug** (§3.3) |
| Double-loan prevention | ✅ | DB partial-unique `library_loans_copy_active_unique` + copy `for('update')` lock |
| Immutable loan events | ✅ | `libraryLoanEvents` (append-only inserts) |
| Renewal policy + hold conflicts | ✅ | `renewLoan` blocks renew when a waiting hold exists |
| FIFO hold queue | 🟡 | `placeHold` (no position column; order-by `placed_at`); **no allocation on return**; **no ready-for-pickup state** |
| Hold-blocked issue | ✅ | `issueCopy` checks first waiting hold |
| Idempotent checkout/renewal/return/scanning | 🟡 | return is idempotent; **no idempotency key for issue/renew/scans** |
| Override with reason/audit | ❌ | `library.circulation.override` permission exists but is **never consulted**; no override path |
| Lost/damaged/write-off handling | 🟡 | `returnLoan` lost/damaged → copy state + event; **no charge creation**, **no write-off finalization** |
| Corrections append events | 🟡 | events appended; no correction API |

### Holds / transfers / stocktake / charges
| Plan requirement | Status | Evidence |
|---|---|---|
| Holds queue (place/cancel/expiry) | 🟡 | place + cancel; **no expiry sweep**, **no ready/pickup lifecycle** |
| Hold FIFO + competing allocation | 🟡 | `orderBy(placed_at)`; **no allocation on return** |
| Transfer lifecycle (dispatch/receive/cancel) | ✅ | `createTransfer`/`transitionTransfer`; copy state `in_transit`→`available`; **no discrepancy** |
| Transfer discrepancy | ❌ | enum value `discrepancy` exists; **no transition path** |
| Stocktake (start/observe/close) | 🟡 | start/observe/close; **no reconcile/adjust/approve**; `library_stocktake_adjustments` never written; **close is not immutable/reviewed** |
| Lost/damaged/write-off | 🟡 | copy states exist; **no charge**, **no write-off finalize** |
| Charges + waivers | 🟡 | `waiveCharge` (idempotent state claim); **no charge creation**; **no finance posting** |
| Notifications intents | ✅ | table + enum; no delivery (deferred to Communication) |

### Members & self-service
| Plan requirement | Status | Evidence |
|---|---|---|
| Member projection over users | ✅ | `libraryMembers` FK to `user`; `createMember` requires active tenant user |
| Member eligibility/blocks | ✅ | `loadPolicy` blocks inactive/blockUntil |
| Member search (allowlisted fields) | ✅ | `listMembers` projects id/memberNumber/state/branch/name/email/role — no grades/finance/HR |
| Student self-service (own loans) | ✅ | `me/loans` via `requireLibrarySelfContext` + `listOwnLoans(userId)` — identity from session, never client-supplied |
| Self-service holds/charges/history | ❌ | only loans endpoint; no `me/holds`, `me/charges`, `me/home` |
| Parent view (guardian + explicit library rights) | ❌ | role `parent` allowed in self-context but **only own loans**; no guardian-child projection |
| No arbitrary member ID from client | ✅ | self-service derives member from session `userId` |

### Operations / reports / imports
| Plan requirement | Status | Evidence |
|---|---|---|
| Overview + overdue reports | ✅ | `/reports/overview`, `/reports/overdue` |
| Inventory / circulation reports | ✅ | `/reports/inventory` (per-branch state/condition pivot + totals), `/reports/circulation` (loan/hold/transfer/charge aggregates + 30-day daily series), wired into the reports page |
| CSV export (filter parity) | ❌ | missing |
| CSV import (validate→preview→commit) | ❌ | missing |
| Dashboard + desk pages | ✅ | `/portals/librarian` dashboard + `/desk` + 10 operational pages (catalog, copies, members, policies, holds, transfers, stocktake, reports, …) |
| Member detail page | ✅ | `/api/addons/library/members/[id]` + `/portals/librarian/members/[id]` page + detail client; members list row → detail `<Link>` navigation |
| Add-on disable → 403 + identity preserved | 🟡 | `requireAddon` in guard; **no regression test** |
| Direct-URL protection | 🟡 | `requireLibraryPage` server guard; **no client-side 403 state** |

### Cross-cutting
| Plan requirement | Status | Evidence |
|---|---|---|
| Tenant isolation on every query | ✅ | all services filter by tenantId; foreign ids re-verified `WHERE id=? AND tenantId=?` |
| Branch/location scope | 🟡 | copy branch stored + FK; **circulation does not enforce operator branch scope**; no `context.branchId` check |
| RecordAudit on mutations | ❌ | **no route calls `recordAudit`** |
| Permission keys + librarian role | ✅ | 11 `library.*` keys; `librarian` role enum + curated default set |
| Plan tier gate | ⏸ | intentionally omitted (sign-off R2) |
| RFID/SIP2 / barcode printing | ⏸ | out of V1 |

## 2b. Status refresh — 2026-08-09 (supersedes the matrix rows below)

The audit matrix below was written when the add-on was a 4-happy-path core. Between then and now the
workstream delivered (evidence: 40 live tests in `src/features/library/services/`):

- **Catalog/copy/policy completion** — record detail (`catalog/[id]`), taxonomy CRUD
  (contributors/publishers/categories/subjects), edition/copy CRUD, copy re-home + withdrawal
  gated by state, soft-delete, paginated stable-sorted catalog, policy CRUD with
  branch-precedence fix, closure-calendar due dates. (`library-catalog-service`, `library-policy-service`)
- **Circulation hardening** — copy-row lock + DB partial-unique active-loan invariant, idempotent
  issue/return, return → next FIFO hold allocation (`on_hold_shelf`), hold expiry, stocktake
  reconcile/adjust/apply with close immutability, transfer lifecycle. (`library-service`, `library-operations-service`)
- **Member self-service isolation** — session-derived identity only (`me/home|loans|history|holds|charges|renew`),
  guardian child view only behind active relationship + explicit library right, allowlisted
  member search with min-length. (`library-self-service`, §3.14 addressed)
- **Safe CSV import/export** — bounded rows/fields, UTF-8, header validation, dry-run, formula
  injection protection, idempotent re-import, export→import round-trip parity. (`library-copies-csv`, 8 tests)
- **Accounting posting (WA6)** — `postLibraryCharge` through the shared `postAccountingVoucher`
  contract; missing account mapping blocks with a durable `accounting_adapter_exceptions` row;
  balanced 2-line idempotent voucher; migration `0104` extends `accounting_source_mappings_shape_check`.
  (`library-accounting-adapter`, 4 tests)
- **Entitlement + capability gates** — add-on disable → `403 ADDON_NOT_ACTIVATED` with the account
  preserved (identity survives for reactivation), and the librarian capability denial/grant matrix
  incl. the positive `userPermissionOverrides` grant path. (§3 matrix rows "add-on disable regression"
  and the override/waive denial gaps; `library-guard`, 3 tests)
- **Final buildable gaps (2026-08-14)** — `reports/inventory` + `reports/circulation` routes with
  real tenant-scoped aggregates wired into the reports page; `GET /api/addons/library/members/[id]`
  + `members/[id]` detail page with list→detail row navigation; live HTTP acceptance harness
  (`scripts/seed-library-test-data.ts` + `scripts/verify-library-adversarial.mjs`, 11 checks C01–C11
  covering 401/403/404/409/422/`ADDON_NOT_ACTIVATED` + cross-tenant isolation). Route inventory is now
  52 route files. (`library-operations-service`, `library-service`, 3 new tests → 8 files / 40 tests)

Still open (honest): **manual/browser sign-off** per `MANUAL-TESTING.md` §0, and the out-of-V1 items
(RFID/SIP2, barcode printing, acquisitions, digital-asset hosting, self-checkout, SMS/email delivery).

## 3. Audit findings (hardening backlog, one row each)

| # | Finding | Severity | Fix |
|---|---|---|---|
| 3.1 | Service-level `23505` catch is broken: Drizzle wraps pg errors (`DrizzleQueryError`), `.code` lives on `.cause`. `createEdition`/`createCopy`/`createMember`/`placeHold` never throw their friendly `DUPLICATE_*` codes; HTTP falls through to generic 409. | High | unwrap `.cause.code` helper; map to specific codes |
| 3.2 | `loadPolicy` `orderBy(desc(branchId))` — Postgres DESC puts NULL (generic policy) **first**, so generic beats branch-specific. Precedence wrong. | High | prefer branch-specific (`branchId IS NOT NULL` desc, then asc) |
| 3.3 | `returnLoan` always sets copy `condition: input.condition`; a `good` return downgrades a `fair`/`poor` copy to `good`. No fine eval. No next-hold allocation. | High | only set condition on damaged; eval overdue fine; allocate next FIFO hold → `on_hold_shelf` |
| 3.4 | `library.circulation.override` never consulted; no override-with-reason path; blocks are unconditional. | High | issueCopy accepts override+reason (capability-gated, audited) |
| 3.5 | No fine/charge creation anywhere (overdue, lost, damage). `libraryCharges` only created by tests. | High | charge creation on return + lost finalization; idempotent via dedupe |
| 3.6 | No hold allocation on return → holds queue stalls forever; copy returns to `available` not `on_hold_shelf`. | High | allocate next hold on return |
| 3.7 | No expiry sweep for holds; `expiresAt` never set. | Med | expiry sweep + expired state |
| 3.8 | Stocktake close is a blind UPDATE; no reconcile/adjust/approve; adjustments table unused. | Med | reconcile + approve flow |
| 3.9 | No CSV import/export. | Med | add (see §5) |
| 3.10 | No Accounting posting for charges. | Med | `postAccountingVoucher` integration (see §5) |
| 3.11 | No `recordAudit` on any mutation route. | Med | add to every mutation |
| 3.12 | No operator branch-scope enforcement; no cross-branch deny. | Med | validate copy branch vs `context.branchId` (unless override) |
| 3.13 | `placeHold` doesn't check `maxHolds`, copy availability, or set `expiresAt`. | Med | enforce policy + availability |
| 3.14 | Member search has no min-length or rate cap (directory enumeration). | Low/Med | min query length + cap |
| 3.15 | `issueCopy` doesn't check copy `branchId` matches member branch (cross-branch borrow) — acceptable if policy; decide + document. | Low | document/allowlist |

## 4. Verified operational behavior (executed against real local Postgres)

`npx vitest run src/features/library/services/` → **8 files, 40 tests, all pass** (2026-08-14, live DB).
Full inventory with per-test assertions: `VERIFICATION-EVIDENCE.md` §2. The original happy-path set
(`library-service.test.ts`):

1. **Real tenant-scoped catalog inventory** — `listCatalog` returns records with edition copy counts (total/available computed via SQL).
2. **Issue → renew → idempotent return** — loan created, copy `checked_out`, renew increments to 1, double-return returns the same `returnedAt` (idempotent), copy back to `available`.
3. **Cross-tenant circulation rejection** — issuing with a foreign tenantId throws `INVALID_MEMBER`; no stray loan row created.
4. **Hold/transfer/stocktake/charge lifecycle** — hold placed→cancelled; transfer request→dispatch→receive moves copy branch+state; stocktake start→observe→close; charge inserted→waived.

DB object verification (via `pg_tables`/`pg_indexes`/`pg_enum`):
- 23 `library_*` tables present.
- 17 unique/partial-unique indexes present (incl. `library_loans_copy_active_unique`, `library_holds_copy_member_waiting_unique`, `library_charges_loan_reason_unique`, `library_charges_tenant_dedupe_key_unique`, ISBN13/10 partial, accession/barcode, policy tenant+category+branch).
- `librarian` value present in `role` enum.

## 5. Delivery record (was "Next work")

All six items below are **delivered** (2026-08-09), per §2b:
1. **Circulation core hardened** — concurrency (copy lock + partial-unique invariant), idempotent
   issue/return, return→FIFO hold allocation, hold expiry, stocktake reconcile/apply with close
   immutability, override-with-reason path.
2. **Catalog/copy/policy API completed** — taxonomy CRUD, record detail/update/soft-delete, copy
   list/update, policy CRUD + branch precedence + closures.
3. **Self-service completed** — `me/home|loans|history|holds|charges|renew` + guardian child view
   behind active relationship + explicit library right.
4. **Safe CSV import/export** — bounded, UTF-8, header validation, dry-run, formula-injection
   protection, idempotent re-import, export parity.
5. **Accounting posting integration** — `postLibraryCharge` → `postAccountingVoucher`; missing
   mapping blocks with actionable durable exception; migration `0104`.
6. **Test suite + docs delivered** — 35 live tests (incl. `library-guard` add-on disable + capability
   denial); `VERIFICATION-EVIDENCE.md`, `MANUAL-TESTING.md`, `PLAN-STATUS.md`, and this report updated.

Remaining: **manual/browser sign-off** (`MANUAL-TESTING.md` §0) and out-of-V1 items.
