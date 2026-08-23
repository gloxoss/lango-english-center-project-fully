# Library Management Add-on — Verification Evidence

Date: **2026-08-14**. Live environment: local `schoolos` PostgreSQL 17 via `DATABASE_URL`
(`localhost:5432`). All checks repeatable — every vitest suite and migration verifier runs green
back-to-back. Companion docs: `MANUAL-TESTING.md` (human/browser flow), `PLAN-STATUS.md`
(deliverable-level status), `.implementation-plan/IMPLEMENTATION-REPORT.md` (full audit matrix).

## 1. Result summary

| Gate | Result |
|---|---|
| Migration `0080_library_management` apply + idempotent rerun | PASS — 23 tables, `librarian` role, 17 unique/partial-unique indexes (`scripts/verify-library-0080.mjs`, both applies) |
| Migration `0104_library_accounting_mappings` apply | PASS — `accounting_source_mappings_shape_check` extended with `library_member` / `library_charge_reason` |
| Migration `0104` idempotent rerun | PASS — re-applies cleanly, no constraint reset |
| Live vitest suite (8 files, 40 tests) | PASS — `npx vitest run src/features/library/services/` |
| `tsc --noEmit` | PASS — exit 0, 0 errors project-wide |
| `npx next build` | PASS — exit 0, full route manifest generated |
| Tenant isolation static check (`check-tenant-isolation.ts`) | PASS for library scope — no library route flagged; only 6 pre-existing non-library flags (guard/kiosk-sessions, guard/me, guardian/me/children, leadership/me/home) |
| Adversarial HTTP harness (`scripts/verify-library-adversarial.mjs`) | PASS — 11/11 (C01–C11): anon 401, wrong-role 403, capability denial, tenant-scoped super_admin, waive + replay 409, zod 422, add-on gate, cross-tenant 404s, e2e report reads (2026-08-14) |
| Orphaned accounting test-tenant cleanup | PASS — 6 orphaned `ACC Test/ACC Other` tenants removed; 0 remaining |

## 2. Live vitest suite — 8 files / 40 tests

Command: `npx vitest run src/features/library/services/` (real Postgres, `describe.skipIf(!hasDb)`,
two-tenant fixtures, no mocks). Duration ~8 s. **All 40 tests pass.**

### `library-service.test.ts` (5)
| Test | Assertion |
|---|---|
| Returns real tenant-scoped catalog inventory | `listCatalog` returns records with edition copy counts (total/available via SQL) |
| Issues, renews, and idempotently returns a copy | loan created, copy `checked_out`, renew → `renewedCount 1`, double-return returns same `returnedAt`, copy → `available` |
| Rejects cross-tenant circulation references | foreign-tenant member/copy → `INVALID_MEMBER` / no stray row |
| Runs hold, transfer, stocktake, and charge lifecycle with tenant ownership | place/cancel hold; transfer request→dispatch→receive moves copy branch+state; stocktake open→observe→close; charge inserted→waived |
| Reconciles stocktake to missing, dedupes checkout, and allocates the next hold on return | adjustment applies `missing`; repeat checkout idempotent; return hands copy to first waiting hold (`on_hold_shelf`) |

### `library-catalog-service.test.ts` (7)
| Test | Assertion |
|---|---|
| Paginates the catalog with stable sort and query filter | paged `listCatalogPage`, title sort, query filter, stable across mutations |
| Returns record detail with editions, copies, contributors, and subjects | `getCatalogRecord` aggregates all taxonomy + holdings |
| Rejects invalid taxonomy references and duplicate taxonomy names | bad contributor/publisher/category/subject refs → error; duplicate names rejected |
| Rejects duplicate ISBN on edition update and duplicate copy identifiers | `DUPLICATE_ISBN` / `DUPLICATE_ACCESSION` / `DUPLICATE_BARCODE` (service-level codes after unwrap fix) |
| Restricts copy re-homing and withdrawal by state | transfer/withdraw blocked while copy `checked_out` / `in_transit` |
| Soft-deletes a free record and withdraws a free copy, all tenant-scoped | `deletedAt` set; tenant B record untouched |
| Keeps `listCatalogPage` stable after updating a record | no page drift after PUT |

### `library-policy-service.test.ts` (4)
| Test | Assertion |
|---|---|
| Creates, updates, deletes policies and rejects duplicates per branch | CRUD; duplicate `(tenant, patronCategory, branchId)` rejected |
| Resolves branch policy precedence over the generic policy | branch-specific policy wins over tenant-wide generic |
| Skips branch-scoped and tenant-wide closure days when computing due dates | closure calendar shifts due date past closed days |
| Isolates policies and closures across tenants | tenant A closures/policies never affect tenant B |

### `library-self-service.test.ts` (4)
| Test | Assertion |
|---|---|
| Resolves own member from the session user, never a client member id | self-service derives member from `userId`, ignores client-supplied id |
| Returns own loans and renews only own loans | `listOwnLoans` / renew rejects foreign loan |
| Surfaces only the caller's holds and charges | `me/holds`, `me/charges` scoped to caller |
| Grants a guardian child view only with active relationship + library right | parent sees child loans only when guardian relationship active AND explicit library right |

### `library-copies-csv.test.ts` (8)
| Test | Assertion |
|---|---|
| Exports the exact header template and sanitizes formula cells | CSV template; cells starting `= + - @` prefixed to prevent formula injection |
| Imports new copies and re-import is a no-op (idempotent) | create on import; identical re-import reports `replayed` with zero writes |
| Dry-run reports the same actions without writing | preview equals commit plan, no rows written |
| Rejects malformed CSV, missing headers, and row-level bad references | parse/validation errors with actionable messages |
| Blocks re-keying an existing copy and barcode reuse by another copy | accession/barcode uniqueness across import |
| Isolates by tenant: an edition from another tenant is not resolvable | cross-tenant edition reference → per-row error |
| Rejects files that exceed the row or field caps | bounded import (row cap + per-field length) |
| Exports then re-imports the export with zero changes | export→import round-trip parity |

### `library-accounting-adapter.test.ts` (4)
| Test | Assertion |
|---|---|
| Blocks posting with an actionable exception when a mapping is missing (no journal entry) | missing member receivable mapping → `blocked:true`, reason `MAPPING_MEMBER_RECEIVABLE_MISSING`, `accounting_adapter_exceptions` row created; 0 posting requests, 0 journal entries |
| Posts a balanced voucher once the member + reason mappings exist, then is idempotent | 2-line balanced voucher (debit receivable = credit revenue = `12.50`); `posting_request.status='succeeded'`; exception resolved; re-post returns same entry (`idempotent:true`) |
| Falls back to the module default mapping when no exact reason mapping exists | reason without exact row → NULL-default mapping credit used |
| Rejects posting a non-open charge and never uses another tenant mapping | `waived` charge → `CHARGE_NOT_OPEN`; tenant with no mappings blocked (isolation) |

### `library-guard.test.ts` (3)
| Test | Assertion |
|---|---|
| Denies with `ADDON_NOT_ACTIVATED` while disabled and passes when enabled, preserving accounts | no entitlement row / disabled row → 403 `ADDON_NOT_ACTIVATED` (identical deny); enabled → pass; user account untouched after toggling (identity preserved) |
| Gates capability: librarian denied sensitive keys, granted operational keys | librarian passes `library.circulation.operate` / `library.catalog.read`; denied `library.charge.waive`, `library.circulation.override`, `library.stocktake.approve` (all `FORBIDDEN`) |
| `school_admin` holds all library capabilities; a user override grants one key | `school_admin` passes `library.charge.waive` (default ALL); a `userPermissionOverrides` row grants the sensitive key to a librarian (positive override path) |

### `library-operations-service.test.ts` (3)
| Test | Assertion |
|---|---|
| `inventoryReport` pivots real copy states and conditions per branch | per-branch `total/available/checkedOut/withdrawn/active` + `conditions` from real copies; issuing moves available→checkedOut; withdrawing removes from `active`; foreign tenant → zeroed totals |
| `circulationReport` aggregates real loan/hold/charge activity and is tenant-scoped | issue/renew/return move `active`/`issued30`/`renewed30`/`returned30` by the expected deltas; hold `waiting`, charge `open` + `openAmount`; 30-day series gap-filled (30 buckets summing to aggregates); foreign tenant → zeroed |
| `getMemberDetail` returns member with branch and populated nested arrays; foreign tenant 404s | `branchName`/`name` + `activeLoans`/`openCharges`/`waitingHolds` populated from real rows; unknown tenant → `NOT_FOUND` (safe cross-tenant 404) |

## 3. Migration evidence

- **`migrations/0080_library_management.sql`** (base add-on): 23 `library_*` tables, `librarian`
  role enum value, 17 unique/partial-unique invariants (incl. `library_loans_copy_active_unique`,
  `library_holds_copy_member_waiting_unique`, ISBN/accession/barcode, policy key). Verified by
  `scripts/verify-library-0080.mjs` — PASS on first apply and idempotent re-apply.
- **`migrations/0104_library_accounting_mappings.sql`** (WA6): extends the existing
  `accounting_source_mappings_shape_check` to allow `('fee_category','payment_method','student',
  'library_member','library_charge_reason')`. Applied + idempotently re-applied via
  `scripts/apply-0104-library-accounting-mappings.mjs` — output `[pass1] applied 3 statement(s)
  [check] shape_check -> ok [pass2] applied 3 statement(s) [check] shape_check -> ok`.
- **Journal**: `migrations/meta/_journal.json` — `0104_library_accounting_mappings` at `idx 105`.

## 4. API route inventory — 52 route files under `src/app/api/addons/library/**`

Catalog & taxonomy: `catalog`, `catalog/[id]`, `catalog/contributors(+/[id])`,
`catalog/publishers(+/[id])`, `catalog/categories(+/[id])`, `catalog/subjects(+/[id])`,
`catalog/[id]/contributors`, `catalog/[id]/subjects`, `editions`, `editions/[id]`.

Copies & policies: `copies`, `copies/[id]`, `copies/export`, `copies/import`, `policies`,
`policies/[id]`, `closures`, `closures/[id]`.

Circulation & holds & transfers: `circulation/issue`, `circulation/renew`, `circulation/return`,
`holds`, `holds/[id]/cancel`, `transfers`, `transfers/[id]/transition`.

Charges: `charges`, `charges/[id]/waive`, `charges/[id]/post` (WA6 Accounting posting).

Stocktakes: `stocktakes`, `stocktakes/[id]/close`, `stocktakes/[id]/observations`,
`stocktakes/[id]/adjustments`, `stocktakes/[id]/adjustments/apply`.

Members & reports: `members`, `members/[id]`, `reports/overview`, `reports/overdue`,
`reports/inventory`, `reports/circulation`.

Self-service (session-derived identity, no client member id): `me/home`, `me/loans`, `me/history`,
`me/holds`, `me/charges`, `me/renew`, `me/children`, `me/children/[studentId]/loans`.

## 5. Services

`src/features/library/services/`: `library-service.ts`, `library-catalog-service.ts`,
`library-policy-service.ts`, `library-operations-service.ts`, `library-self-service.ts`,
`library-copies-csv.ts`, `library-accounting-adapter.ts` (+ 7 co-located `.test.ts` files).

## 6. Capabilities & role

11 `library.*` keys in `PERMISSIONS` (`permissions.ts:226-236`): `library.catalog.read`,
`library.catalog.manage`, `library.copy.manage`, `library.circulation.operate`,
`library.circulation.override`, `library.hold.manage`, `library.stocktake.manage`,
`library.stocktake.approve`, `library.policy.manage`, `library.report.read`, `library.charge.waive`.

`librarian` role default set (`permissions.ts:394-399`): `library.catalog.read`,
`library.copy.manage`, `library.circulation.operate`, `library.hold.manage`,
`library.stocktake.manage`, `library.report.read` — deliberately **without** `circulation.override`,
`stocktake.approve`, `policy.manage`, `charge.waive`, and none of the student/HR/finance keys.

Add-on registry (`src/addons/registry.ts`): library `enabled: true`; disabling it returns
`403 ADDON_NOT_ACTIVATED` without touching user accounts (librarian identity survives).

## 7. Known / pre-existing findings

- **Accounting posting preconditions**: posting requires an open fiscal period, an active
  `accounting_journals` row, an active voucher type whose `sourceModule` matches, active chart
  accounts, and account mappings. Missing mapping blocks with a durable
  `accounting_adapter_exceptions` row (never a silent no-op). This is by design (WA6 contract).
- **Trigger discipline in tests**: the ledger is guarded by immutability + DEFERRED balance
  triggers, so accounting test cleanup disables triggers → deletes → re-enables in separate
  transactions (`55006` Postgres rule).
- **Tenant isolation check** reports 6 pre-existing failures outside the library scope
  (`guard/kiosk-sessions/[id]/close|lock`, `guard/me/gate`, `guard/me/shift`,
  `guardian/me/children/[relationshipId]`, `leadership/me/home`) — none in `addons/library/**`.
- **`tsc` vs the live dev server**: `next dev` rewrites `.next/dev/types/*.d.ts` (included by
  `tsconfig.json:93`) on route changes. A `tsc --noEmit` running during a rewrite can momentarily
  read a truncated generated file and report `TS1109/TS1002` there. Re-running after the dev server
  settles gives **exit 0, 0 errors** (verified twice); `next build` (its own full type-check) also
  exits 0. The library scope has never shown a tsc error.
- **Out of V1 (per plan)**: RFID/SIP2, barcode printing, full acquisitions, digital-asset hosting,
  self-checkout kiosks. Notifications are in-app intents only (no SMS/email wiring).
