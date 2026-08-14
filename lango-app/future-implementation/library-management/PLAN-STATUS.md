# Library Management Add-on — Plan Status

Live tracker for the plan documents in this folder. Updated **2026-08-09**.

| Deliverable | Status | Evidence |
|---|---|---|
| Base add-on (schema `0080`, permissions, librarian role, registry) | ✅ Done | 23 tables, 17 unique/partial-unique indexes, 11 `library.*` keys, registry `enabled:true` |
| Catalog + taxonomy + copies (hardening) | ✅ Done | `library-catalog-service` (7 tests); duplicate ISBN/accession/barcode, soft-delete, state-restricted transfer/withdraw |
| Copy & policy management | ✅ Done | `library-policy-service` (4 tests); branch-precedence fix, closure calendar due dates |
| Circulation core (concurrency, idempotency, holds, transfers, stocktake) | ✅ Done | `library-service` (5 tests); double-loan prevention, return→hold allocation, stocktake reconcile, transfer lifecycle |
| Member self-service isolation | ✅ Done | `library-self-service` (4 tests); session-derived identity, own loans/holds/charges, guardian-gated child view |
| Safe CSV import/export | ✅ Done | `library-copies-csv` (8 tests); bounded, UTF-8, dry-run, formula-injection protection, idempotent, round-trip parity |
| Charges → Accounting posting contract | ✅ Done | `library-accounting-adapter` (4 tests); balanced idempotent voucher, missing-mapping blocks with durable exception |
| Entitlement + capability gates | ✅ Done | `library-guard` (3 tests); add-on disable → `403 ADDON_NOT_ACTIVATED` with account preserved, librarian capability denial/grant matrix |
| Verification evidence + docs | ✅ Done | `VERIFICATION-EVIDENCE.md`, `MANUAL-TESTING.md`, this file; 35/35 tests, `tsc --noEmit` exit 0, `next build` exit 0, tenant-isolation scan clean for library scope |
| Manual / browser sign-off | ⏳ Open | `MANUAL-TESTING.md` §0 checklist — repeatable, none blocking automated gates |

## Gates (2026-08-09)

| Gate | Command | Result |
|---|---|---|
| Migration `0080` apply + rerun | `node scripts/verify-library-0080.mjs` | PASS (both applies) |
| Migration `0104` apply + rerun | `node scripts/apply-0104-library-accounting-mappings.mjs` | PASS (pass1 + pass2) |
| Live vitest suite | `npx vitest run src/features/library/services/` | 7 files / 35 tests PASS |
| Type check | `npx tsc --noEmit` | PASS (exit 0) |
| Production build | `npx next build` | PASS (exit 0) |
| Tenant isolation | `npx tsx scripts/check-tenant-isolation.ts` | No library flags; 6 pre-existing non-library flags |
| Test-tenant cleanup | `node scripts/cleanup-accounting-test-tenants.mjs` | 6 orphans removed, 0 remaining |

## Out of V1 (deferred per plan sign-offs)

RFID/SIP2, barcode printing, full acquisitions, digital-asset hosting, self-checkout kiosks,
SMS/email notification delivery (in-app intents only). No plan-tier gate (sign-off R2).

## Sources

- Product plan: `LIBRARY-MANAGEMENT-ADDON-PLAN.md` (status line updated to match).
- Execution plan: `.implementation-plan/EXECUTION-PLAN.md` (11 phases; verification gates §16).
- Audit / current-state record: `.implementation-plan/IMPLEMENTATION-REPORT.md`.
- Evidence: `VERIFICATION-EVIDENCE.md`. Manual flows: `MANUAL-TESTING.md`.
