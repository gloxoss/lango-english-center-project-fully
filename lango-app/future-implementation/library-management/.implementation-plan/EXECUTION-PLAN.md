# Library Management + Librarian Portal — Coordinated Execution Plan

Single coordinated plan for implementing the **Library Management add-on** and the
**Librarian Portal** together, per the user's brief. Source plans (read, authoritative):
- `future-implementation/library-management/LIBRARY-MANAGEMENT-ADDON-PLAN.md`
- `future-implementation/librarian-portal/LIBRARIAN-PORTAL-PLAN.md`
- `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md`
- `future-implementation/library-management/.implementation-plan/PLAN.md` (earlier high-level draft — superseded by this file)
- Coordination: `future-implementation/_coordination/CRM-LIBRARY-LIVECLASS-WAVE.md`

**Deliverable of this plan**: dependency-ordered implementation (11 phases), full table set,
permission keys + librarian-role decision, add-on/sidebar wiring, migration 0079 + journal,
shared-file collision list, portal integration, DB-backed evidence suite mapping each mandated
scenario, verification commands, manual-guide and final-report structure, and an honest
merge-readiness gate.

---

## 1. Current state (verified by inspection, 2026-08-08)

| Area | State |
|---|---|
| Library placeholder | `src/features/library/{data/library-catalog-config.ts, ui/library-catalog-{client,page,view}.tsx}` — static mock, **no API/schema behind it**. Rendered by `src/app/[locale]/(dashboard)/dashboard/library/catalog/page.tsx` |
| Add-on registry | `src/addons/registry.ts` — library entry present, `enabled: false`, description says "Not built." |
| Permissions | `src/libs/api/permissions.ts` — ends at `'inventory.export'` (line 162); **no `library.*` keys**; `DEFAULT_ROLE_PERMISSIONS` has no librarian |
| Roles | `role` pgEnum in `src/models/Schema.ts:27` = `[..., 'guard']` — **no `librarian`**; `APP_ROLES` in `src/libs/api/context.ts:7` matches; `ROLE_LABELS` in `src/components/shared/sidebar.tsx:38`; `ROLE_TO_DB/ROLE_TO_UI` in `src/models/userMapping.ts` |
| Migrations | Highest = `0078_guard_security_portal.sql`; journal idx 79, `when` 1786800000000. A parallel CRM/broadcast agent claimed `0079_lead_crm_broadcast` (idx 80) first, so **this workstream takes `0080_library_management.sql`, idx 81** |
| Portal precedent | `dashboard/portals/guard/*` (8 pages) — role-gated, capability-driven; guard portal API pattern in `src/app/api/addons/hostel/**` |
| Test precedent | `src/features/hostel/__tests__/hostel-audit.test.ts` — 16 DB-backed vitest tests against real Postgres (`describe.skipIf(!hasDb)`), no mocks |
| CRM mock conflict | `src/features/crm/ui/librarian-portal-view.tsx` — hardcoded borrow data. **Owned by CRM workstream; do not edit.** Ensure no nav points to it |
| Baseline counts | 414 API `route.ts` files, 222 dashboard pages. Tenant-isolation script `scripts/check-tenant-isolation.ts` (3 pre-existing flagged files, all non-library) |

## 2. Scope & boundaries (V1)

**In scope**: bibliographic catalog (records → editions → copies), contributors/publishers/
categories/subjects taxonomy, ISBN + accession duplicate handling, branch/location/shelf,
copy condition + lifecycle, member eligibility projected from authoritative students/employees,
issue/return/renew with policy-based due dates, holds/FIFO queue, lost/damaged finalization,
overdue detection, fine calc + waiver/adjustment with capability controls, idempotent Finance
adapter (no competing accounting tables), stocktake reconciliation, inventory/circulation/
overdue reports, CSV exports, immutable audit events, Librarian Portal (home/desk/catalog/
copies/members/holds/reports), member self-service (own loans/holds), French + English,
responsive desk, empty/loading/error/success states.

**Out of scope (V1)**: RFID/SIP2, full acquisitions/accounting, digital-asset hosting (Library
links to Attachments Book for URLs only), self-checkout kiosks, barcode printing.

**Boundaries**:
- Library **member** = tenant-scoped projection over existing `users` (students/employees/teachers/
  receptionists), never a duplicate identity table with fresh names.
- Circulation history is **immutable**; corrections append events.
- Library **charges** are an operational subledger; Finance posting is an idempotent side effect.
- Notifications are **intents** (`library_notifications`); published to Communication when available,
  otherwise honestly queued.
- The existing `/dashboard/content/library` resource library (Attachments) is **untouched**.

## 3. Key decisions

1. **Canonical librarian surface** = `/dashboard/portals/librarian` (mirrors guard-portal
   precedent). Full management surface = `/dashboard/library/*`. Both call the **same services**;
   portal pages never reimplement transaction logic.
2. **Dedicated `librarian` role** is introduced (spec: "Introduce a librarian role template/
   capabilities"). It holds **only** curated `library.*` capabilities. The portal and APIs gate by
   **capability**, not role string, so school admins with `library.*` grants also work and the role
   alone grants nothing without the add-on. ⚠️ **Requires user sign-off before touching shared role
   files** (§11, R1) — this is the one scope-expanding shared edit.
3. **Policy snapshot on loans** — `policySnapshot jsonb` captures the policy at issue time; later
   policy edits never silently change existing loans.
4. **Self-service** (`/dashboard/library/me`, `/dashboard/library/me/holds`) is role-gated
   (student/parent) + identity-match, mirroring hostel `resident/me` — no `library.self.*`
   capability needed.
5. **Finance adapter** reuses the existing invoice/ledger machinery (same helper family as
   `server/finance-adapter.ts::reserveInvoiceNumber`); the charge row is the source of truth and a
   finance-post failure does **not** roll back circulation (charge stays open, retryable).

## 4. The 11-phase dependency order

Each phase ends with a verify gate before the next starts.

| # | Phase | Verifies |
|---|---|---|
| 1 | Permissions + add-on entitlement | `library.*` keys in `PERMISSIONS`; `DEFAULT_ROLE_PERMISSIONS`; registry `enabled: true`; librarian role (enum/context/labels/mapping) |
| 2 | Schema + migration `0079` | Drizzle types compile; migration applies + reruns via verifier; journal entry |
| 3 | Catalog + copies (records/editions/contributors/publishers/categories/subjects/copies) | CRUD, ISBN + accession uniqueness, duplicate rejection |
| 4 | Members + eligibility projections | member lookup, eligibility rules, allowlisted fields |
| 5 | Circulation (issue/renew/return) | all circulation invariants (DB + service) |
| 6 | Holds/reservations | FIFO queue, hold-blocked issue, expiry |
| 7 | Fines + finance adapter | fine calc, waiver, idempotent posting, failure handling |
| 8 | Reports + exports | overview/overdue/inventory/circulation + CSV |
| 9 | Librarian Portal | desk + catalog/copies/members/holds/reports pages; capability gating; direct-URL protection |
| 10 | Self-service/member surfaces | own loans/holds; role gating; household/guardian projection |
| 11 | Verification + documentation | evidence suite, migration rerun, tsc, build, isolation checks, guide, final report |

## 5. Data model (23 tables, snake_case, all `tenantId`-scoped)

All tables: `id uuid pk`, `tenantId uuid notNull`. `library_*` prefix. FKs reference existing
identity tables (`users`, `branches`, `sessionYears`) — never duplicated.

| Table | Key columns / notes |
|---|---|
| `library_bibliographic_records` | `title`, `subtitle`, `language`, `publicationYear`, `summary`, `deletedAt` |
| `library_contributors` | `name` (authors/editors/illustrators) |
| `library_record_contributors` | `recordId`, `contributorId`, `role`, `sortOrder` |
| `library_publishers` | `name` |
| `library_categories` | `parentId` (hierarchical), `name`, `sortOrder` |
| `library_subjects` | `name` |
| `library_record_subjects` | `recordId`, `subjectId` |
| `library_editions` | `recordId`, `publisherId`, `isbn13`, `isbn10`, `publicationYear`, `pages`, `format`, `coverUrl` |
| `library_copies` | `editionId`, `branchId`, `accessionNumber`, `barcode`, `shelfLocation`, `condition`, `state`, `price`, `acquiredAt`, `withdrawnAt` |
| `library_members` | `userId` (FK `users`), `memberNumber`, `branchId`, `state` (active/blocked/inactive), `blockReason`, `blockUntil` |
| `library_loan_policies` | `name`, `patronCategory`, `branchId?`, `maxLoans`, `loanDurationDays`, `renewalLimit`, `renewalDurationDays`, `finePerDay`, `gracePeriodDays`, `maxHolds` |
| `library_loans` | `copyId`, `memberId`, `issuedById`, `issuedAt`, `dueDate`, `returnedAt?`, `returnState?`, `renewedCount`, `policySnapshot jsonb` |
| `library_loan_events` | `loanId`, `eventType`, `actorId`, `at`, `note` (immutable history) |
| `library_holds` | `copyId`, `memberId`, `placedById`, `placedAt`, `state` (waiting/fulfilled/cancelled/expired), `expiresAt`, `fulfilledLoanId?` |
| `library_hold_events` | `holdId`, `eventType`, `actorId`, `at`, `note` |
| `library_transfers` | `copyId`, `fromBranchId`, `toBranchId`, `state` (requested/dispatched/received/discrepancy/cancelled), `requestedById`, `dispatchedAt?`, `receivedAt?` |
| `library_transfer_events` | `transferId`, `eventType`, `actorId`, `at`, `note` |
| `library_stocktakes` | `branchId`, `state` (open/closed), `startedById`, `startedAt`, `closedAt?` |
| `library_stocktake_observations` | `stocktakeId`, `copyId`, `countedById`, `countedAt`, `found?`, `note` |
| `library_stocktake_adjustments` | `stocktakeId`, `observationId`, `copyId`, `fromState`, `toState`, `resolvedById`, `reason` |
| `library_charges` | `memberId`, `loanId?`, `amount`, `reason`, `state` (open/waived/paid), `waivedById?`, `waiverReason?`, `dedupeKey?` |
| `library_charge_adjustments` | `chargeId`, `adjustmentType`, `amount`, `actorId`, `reason`, `at` |
| `library_notifications` | `memberId`, `type`, `channel`, `state`, `at`, `payload` |

**DB-enforced invariants (in migration 0079, plus service checks)**:
- `UNIQUE (tenant_id, accession_number)` and `UNIQUE (tenant_id, barcode)` on copies (tenant-aware).
- `UNIQUE (tenant_id, isbn13) WHERE isbn13 IS NOT NULL` and same for isbn10 on editions (partial unique).
- **One active loan per copy**: partial unique index `ON library_loans (copy_id) WHERE returned_at IS NULL`.
- **One active hold per (copy, member)**: partial unique `ON library_holds (copy_id, member_id) WHERE state = 'waiting'`.
- **Fine retry idempotency**: unique `(tenant_id, loan_id, reason)` where non-null, plus `dedupeKey` for post-without-loan charges.
- Tenant-aware unique policy key: `UNIQUE (tenant_id, patron_category, branch_id)` on loan policies (branch null allowed → partial).
- All FKs via idempotent `DO ... duplicate_object THEN null` blocks; UNIQUE/EXCLUDE via **catalog-existence-check DO blocks** (hostel 0076 lesson — `WHEN duplicate_object` does NOT catch duplicate_table for UNIQUE).
- `CHECK (due_date > issued_at)`; `CHECK (effective dates)` as needed per table.
- Enums via guarded `ALTER TYPE ... ADD VALUE` (`librarian`) and library enums (`DO ... duplicate_object`).

## 6. Permissions & roles

**New permission keys** (added to `PERMISSIONS`, French labels):

| Key | Label (fr) |
|---|---|
| `library.catalog.read` | Consulter le catalogue |
| `library.catalog.manage` | Gérer le catalogue |
| `library.copy.manage` | Gérer les exemplaires |
| `library.circulation.operate` | Opérer le prêt/retour |
| `library.circulation.override` | Passer outre les blocages de prêt |
| `library.hold.manage` | Gérer les réservations |
| `library.stocktake.manage` | Gérer les inventaires |
| `library.stocktake.approve` | Approuver les ajustements d'inventaire |
| `library.policy.manage` | Gérer les politiques de prêt |
| `library.report.read` | Consulter les rapports bibliothèque |
| `library.charge.waive` | Annuler (remettre) des frais |

**DEFAULT_ROLE_PERMISSIONS updates**:
- `super_admin`, `school_admin`: already `ALL_PERMISSIONS` → new keys auto-included.
- `librarian` (new role): `library.catalog.read`, `library.copy.manage`, `library.circulation.operate`,
  `library.hold.manage`, `library.stocktake.manage`, `library.report.read`. **Deliberately no**
  `catalog.manage`, `circulation.override`, `stocktake.approve`, `policy.manage`, `charge.waive`,
  and none of the students/teachers/HR/finance/guardian/audit keys. ⚠️ `library.circulation.override`
  vs `operate`: override is separate so a plain desk operator cannot bypass blocks.
- `receptionist`: no library keys by default (front desk already has hostel/inventory). Grant per-tenant if a school wants desk duty.
- `student`, `parent`: no `library.*` keys; self-service gated by role + identity (mirrors hostel).

**Roles shared-file changes** (only in phase 1, after sign-off):
- `src/models/Schema.ts:27` — append `'librarian'` to `role` pgEnum; barrel re-export of library schema.
- `src/libs/api/context.ts:7` — append `'librarian'` to `APP_ROLES`.
- `src/components/shared/sidebar.tsx:38` — `librarian: 'Bibliothécaire'` in `ROLE_LABELS`.
- `src/models/userMapping.ts` — `ROLE_TO_DB['Bibliothécaire']='librarian'`; `ROLE_TO_UI['librarian']='Bibliothécaire'`.
- Migration 0079 — guarded `ALTER TYPE role ADD VALUE 'librarian'`.

## 7. Add-on entitlement + registry

- `src/addons/registry.ts` — flip library `enabled: true`; update description to reflect it is built.
- Every library API: `requireRequestContext(req, [roles]) → requireTenant → requireAddon(tenantId,'library') → requireCapability(ctx, key)`. Disabling the add-on returns `403 ADDON_NOT_ACTIVATED` **without touching user accounts** — librarian identity survives for reactivation (portal acceptance criterion).
- `requirePlanTier` only where the add-on plan tier matters (standard/premium) if tenants have tiered library access — otherwise omitted to avoid scope creep.

## 8. API surface (`src/app/api/addons/library/**`)

Every route: parseJson `.strict()`, every foreign id re-verified `WHERE id=? AND tenantId=?`, `recordAudit` (never awaited), `apiErrorResponse`.

- `catalog/` GET search/list (min query length, pagination cap), POST create record+editions.
- `catalog/[id]/` GET/PUT/DELETE (soft-delete records; DELETE blocked while copies exist unless cascade-withdrawn).
- `contributors/`, `publishers/`, `categories/`, `subjects/` GET/POST(/[id] PUT/DELETE).
- `editions/`, `editions/[id]/` CRUD.
- `copies/` GET list, POST create (accession/barcode uniqueness enforced). `copies/[id]/` PUT (condition, state via services only), DELETE.
- `members/` GET allowlisted search (identity + membership state + active loans count only), POST create. `members/[id]/` block/unblock/close.
- `circulation/issue/` POST. `circulation/renew/` POST. `circulation/return/` POST. — all idempotent, transactional.
- `holds/` GET queue, POST place. `holds/[id]/` cancel/fulfill.
- `charges/` GET (member filter). `charges/[id]/waive/` POST (`library.charge.waive` + reason required).
- `transfers/` GET/POST; `transfers/[id]/` dispatch/receive.
- `stocktakes/` GET/POST; `stocktakes/[id]/` close; `stocktakes/[id]/observations/` POST; `stocktakes/[id]/commit/` POST (`stocktake.approve`).
- `policies/` GET/POST; `policies/[id]/` PUT/DELETE.
- `reports/overview/`, `reports/overdue/`, `reports/inventory/`, `reports/circulation/` GET; `reports/export/` GET (CSV, `library.report.read`).
- `me/home/`, `me/loans/`, `me/holds/` — self-service; role-gated (student/parent/alumni) + identity match; allowlisted projections (never grades/attendance/finance/HR/guardian-directory/medical).

Estimated **~30 new API route files**.

## 9. UI surface & sidebar

**Dashboard pages** (server page → client view in `src/features/library/ui/`):
- `/dashboard/library` (dashboard overview) · `/dashboard/library/catalog` (replaces placeholder) ·
  `/dashboard/library/catalog/[id]` (record detail + editions + copies) · `/dashboard/library/copies` ·
  `/dashboard/library/members` + `/members/[id]` · `/dashboard/library/policies` · `/dashboard/library/holds` ·
  `/dashboard/library/transfers` · `/dashboard/library/stocktake` · `/dashboard/library/reports`.
- Self-service: `/dashboard/library/me` (+ `/me/holds`), role-gated.

**Librarian Portal pages** (`/dashboard/portals/librarian/**`):
- `/portals/librarian` (home: due/overdue, holds awaiting pickup, exceptions, recent circulation from real APIs) ·
  `/portals/librarian/desk` (member lookup, barcode checkout/renew/return, keyboard-first) ·
  `/portals/librarian/catalog` · `/portals/librarian/copies` · `/portals/librarian/members` ·
  `/portals/librarian/holds` (queue + transfers) · `/portals/librarian/reports`.

Estimated **~19 new pages**. UI per APP-CONTEXT: `#2487B8→#1B6C93` header gradient, `#16212B`
headings, `Badge` variants, `text-xs` dense tables, French copy, empty/loading/error/success states,
responsive desk, no member data persisted in browser storage.

**Sidebar additions** (`src/components/shared/sidebar.tsx`):
- `Bibliothèque` (Library Management): `/${locale}/dashboard/library`, permission `library.catalog.read`, subItems for catalog/copies/members/policies/holds/stocktake/reports (capability-gated per subitem).
- `Portail Bibliothèque`: `/${locale}/dashboard/portals/librarian`, permission `library.circulation.operate`, subItems for home/desk/catalog/copies/members/holds/reports.
- Self-service link block (role `student`/`parent` only, mirroring `hostelSelfServiceNavItems`) → `/dashboard/library/me`.

## 10. Migration 0080 + journal + verifier

- **File**: `migrations/0080_library_management.sql`. Header comment; `CREATE TABLE IF NOT EXISTS`
  for all 23 tables; `--> statement-breakpoint` between; FKs + enums in idempotent
  `DO ... duplicate_object` blocks; UNIQUE in catalog-check DO blocks; guarded
  `ALTER TYPE role ADD VALUE 'librarian'`; indexes on `(tenant_id, ...)` for every table; the
  partial-unique active-loan / active-hold / fine-dedupe / ISBN indexes.
- **Journal**: appended `{ "version":"7", "when":1787000000000, "tag":"0080_library_management",
  "breakpoints":true, "idx":81 }` — after the CRM agent's `0079_lead_crm_broadcast` (idx 80).
- **Verifier**: `scripts/verify-library-0080.mjs` — applies the migration **twice** against the live
  DB; PASS 1 asserts all 23 tables + 6 partial-unique indexes + 13 constraints + 10 enums +
  the `librarian` role value exist; PASS 2 proves idempotency; exits nonzero on any missing object.
  **Verified 2026-08-08: PASS on both applies (133 blocks each).**

## 11. Shared-file collision list (files outside `src/features/library/**`)

These are the only shared files the library workstream touches, plus the note on CRM.

| File | Change | Risk |
|---|---|---|
| `src/models/Schema.ts` | role enum line 27 append `'librarian'`; barrel re-export of `library-schema` | additive; existing rows unaffected |
| `src/libs/api/context.ts` | `APP_ROLES` append `'librarian'` | additive |
| `src/libs/api/permissions.ts` | 11 new `library.*` keys + `librarian` default set | additive; `school_admin` already ALL |
| `src/addons/registry.ts` | library `enabled: true` | flips a feature on |
| `src/components/shared/sidebar.tsx` | `ROLE_LABELS` + 2 nav items + self-service block | additive |
| `src/models/userMapping.ts` | librarian UI/DB role strings | additive |
| `migrations/0080_library_management.sql` + journal | new migration | sequential, next number (after CRM's 0079) |
| `src/app/[locale]/(dashboard)/dashboard/library/catalog/page.tsx` | replace placeholder | within library surface |
| `src/features/library/**` | replace mock config + UI | own workstream |
| `server/finance-adapter.ts` (or sibling helper) | add `postLibraryCharge` idempotent helper | reuses existing ledger; additive |
| ⛔ `src/features/crm/ui/librarian-portal-view.tsx` | **do not touch** (CRM workstream); ensure no nav points to it | avoid cross-workstream edit |

Concurrent-workstream note (per `_coordination` doc): only the integration owner (this agent, for the
library/librarian workstream) edits the shared journal/barrel/permissions/registry/sidebar. A parallel
Live Classes agent may be mid-flight; the role-enum append and journal entry are strictly additive and
the migration number is taken from the current highest (`0078`) at the moment of writing.

## 12. Portal integration section

The Librarian Portal is **not a separate backend**. Every portal route:
1. `requireRequestContext(req, ['librarian','school_admin','super_admin'])` (librarian + any admin with grants).
2. `requireTenant` → `requireAddon(tenantId, 'library')` → `requireCapability(ctx, key)`.
3. Calls the **same service functions** as admin APIs (`circulation-service`, `holds-service`, etc.).
   No duplicated transaction logic in portal routes.
4. Direct-URL protection: pages render server-side and also fetch capability/entitlement client-side;
   an unauthorized visit shows a 403 state, never mock data.

Cross-branch discipline: `x-branch-id` / `branchId` derive from session; circulation validates the
copy's branch against the operator's allowed branches unless `library.circulation.override`. Wrong
tenant/branch → safe 403/404.

## 13. Circulation invariants (service + DB, mirroring hostel lessons)

1. One active loan per copy → partial unique index + service check inside tx.
2. Member loan limit + eligibility/block → service check against policy snapshot; `library.circulation.override` bypasses blocks (audited).
3. Return closes once → atomic conditional claim `UPDATE ... WHERE returned_at IS NULL RETURNING` inside tx; duplicate/concurrent return is idempotent (no duplicate side effects/charges).
4. Renew capped by `renewalLimit` and blocked by active holds → service check + event.
5. Holds FIFO → order by `(placed_at, id)`; return assigns exactly **one** next eligible hold under a lock; loser reloads idempotently.
6. Copy reserved for another member cannot be issued to someone else.
7. Lost/damaged finalization idempotent (state transitions are conditional claims; one winner).
8. Fine creation idempotent (unique `(loan, reason)` + `dedupeKey`); finance-post failure does **not** corrupt circulation (charge open, retryable).
9. Every state transition inside `db.transaction` + immutable audit event.

## 14. Security requirements (applied everywhere)

- Derive tenant/branch/actor from session; filter every query by tenant.
- Re-verify every foreign id in request bodies `WHERE id=? AND tenantId=?` (422/404 on mismatch).
- `requireAddon` on all library APIs; granular `requireCapability`.
- Member projections **allowlisted** — never national IDs, medical, grades, salaries, guardian
  directory, auth data. Search min length + rate + pagination caps (anti-enumeration).
- No member manifest/sensitive lookup results in browser storage; direct URLs protected.
- Librarian role confined to its curated set (blast-radius test).

## 15. Evidence suite — mandated scenario → DB-backed test

`src/features/library/__tests__/library-audit.test.ts` (vitest, `describe.skipIf(!hasDb)`, real
Postgres fixtures, two seeded tenants, never mocks — hostel precedent). Plus a live acceptance
harness `scripts/verify-library-adversarial.mjs` for curl-level coverage.

| # | Mandated scenario | Test |
|---|---|---|
| 1 | Catalog CRUD + duplicate rejection | create record/edition; duplicate ISBN → 409 |
| 2 | Accession uniqueness | same accession two tenants OK; same tenant → 409 |
| 3 | Cross-tenant reference rejection | edition/copy/member/policy from tenant B → 422/404 |
| 4 | Successful issue | happy path sets loan + copy state + event |
| 5 | Concurrent issue one winner | two parallel issues same copy → exactly 1 loan |
| 6 | Loan-limit rejection | member at `maxLoans` → 409 |
| 7 | Ineligible/blocked member rejection | inactive/blocked → 409 |
| 8 | Return idempotency/concurrency | double + parallel return → 1 closed loan, 1 event, 1 charge |
| 9 | Renewal limits | beyond `renewalLimit` rejected; active hold blocks renew |
| 10 | Hold queue order | FIFO by `(placed_at,id)`; exactly one fulfillment |
| 11 | Hold-blocked issue | copy waiting for member A cannot issue to B |
| 12 | Lost/damaged finalization idempotent | double finalize → one state change |
| 13 | Fine calc + retry idempotency | correct amount; repeated close → single charge |
| 14 | Finance failure handling | adapter throws → charge open, circulation intact |
| 15 | Search min length + pagination caps | short query 422; page cap enforced |
| 16 | Forbidden-field projections | member/self response has only allowlisted keys |
| 17 | Add-on disable regression | add-on off → 403 ADDON_NOT_ACTIVATED, user account unchanged |
| 18 | Two-tenant isolation | tenant A can never read/write tenant B rows |
| 19 | Librarian role blast radius | librarian token 403 on students/HR/finance/admin routes |
| 20 | Active-loan/copy-state reconciliation | DB invariant: no two active loans on one copy; copy state consistent |

## 16. Verification commands (run in `lango-app`)

**Executed 2026-08-09 — results recorded. Live evidence: `VERIFICATION-EVIDENCE.md`, `PLAN-STATUS.md`.**

1. `npx vitest run src/features/library/services/` → **6 files / 32 tests PASS** (suite lives
   co-located with services; the earlier `__tests__/library-audit.test.ts` layout was superseded).
2. `node scripts/verify-library-0080.mjs` (apply twice; PASS 1 + PASS 2) → **PASS both applies** (23 tables, `librarian` role).
3. `node scripts/apply-0104-library-accounting-mappings.mjs` → **PASS pass1 + pass2** (idempotent).
4. `npx tsc --noEmit` → **PASS exit 0, 0 errors project-wide** (the earlier pre-existing inventory
   errors have since been cleared; none remain).
5. `npx next build` → **PASS exit 0** (full route manifest).
6. `npx tsx scripts/check-tenant-isolation.ts` → **no library flags**; 6 pre-existing non-library
   flags only (guard/guardian/leadership).
7. Route count: **48 route files** under `src/app/api/addons/library/**`; every query tenant-scoped.
8. `git diff --check` → clean for library files.

## 17. Manual testing guide (`MANUAL-TESTING-GUIDE.md`)

Sections: catalog/copy setup · member lookup · issue/return/renew · holds/queue · overdue/fines ·
lost/damaged · reports/exports · librarian navigation + permissions · direct-URL protection ·
French/English · responsive desk · empty/loading/error states · tenant-isolation attacks ·
cleanup/reset · automated vs pending-manual sign-off checklist.

## 18. Final report (`FINAL-REPORT.md`)

Files changed · migration/table/constraint totals · API route/page totals · automated test totals +
exact commands · concurrency + idempotency evidence · tenant-isolation + forbidden-field evidence ·
role/capability matrix · build + tsc results · database cleanup state · remaining human/browser
tests · honest merge verdict.

## 19. Merge-readiness gate (completion standard)

> "Do not mark the project complete until the domain and portal work together against the real database."

All 20 evidence tests green on live Postgres; migration rerun idempotent; tsc + build clean; no new
isolation flags; portal desk drives real circulation end-to-end; add-on disable preserves librarian
identity; `git diff --check` clean. Only then is the merge verdict honest.

**Current status (2026-08-09):** automated gates all green — 32/32 live tests, migration `0080` +
`0104` applied and idempotent, `tsc` exit 0, `next build` exit 0, isolation scan clean for library
scope. Remaining for the final merge verdict: **manual/browser sign-off** (`MANUAL-TESTING.md` §0)
and the out-of-V1 items.

## 20. Sign-off record (2026-08-08)

- **R1**: ✅ **Add the `librarian` role** (enum + shared files, §11). Portal/APIs remain capability-gated.
- **R2**: ✅ **No plan-tier gate** — Library available to any active tenant with the add-on enabled (no `requirePlanTier`).
- **R3**: ✅ **In-app notification intents only** — `library_notifications` surfaced in librarian home + member self-service; no SMS/email wiring in V1.
