# Phase H Certification + Remaining Work Plan

Status: **Pending** (2026-08-24). Phases A–H are implemented and live-verified (finance **69/69**, live script **15/15**). This plan covers the items that remain *after* the code: gateway/ERP certification and two cross-tracked gaps.

> The analytics route (empty `analytics/route.ts` stub from 2026-08-23) is **restored and deployed** (authz 3/3, tenant-isolation clean, live 200 with `igpLatest: 95.8`). Not part of this plan.

## Classification

| # | Item | Blocker | Actionable now? |
|---|---|---|---|
| I | Stripe gateway (real) | none — public API + `fetch`/`crypto` | ✅ DONE (2026-08-24) |
| J | Sage export adapter (real) | target format (Sage 100 / Business Cloud) | ✅ yes (needs spec choice) — scaffold added 2026-08-24 |
| K | CMI NAPS live | merchant creds + CMI sandbox approval | ❌ external — scaffold added 2026-08-24 |
| L | DAMANCOM / INP export | Moroccan filing-format spec | ❌ external — scaffold added 2026-08-24 |
| M | Morocco tax/statutory mappings | accountant certification | ❌ external — certification scaffold added 2026-08-24 |
| N | `payroll-posting.ts` (office-accounting #13) | depends on #16 payroll | ✅ DONE — already implemented (prior "unbuilt" note was stale) |

## Phase I — Stripe gateway ✅ DONE (2026-08-24)

`src/libs/payments/stripe-provider.ts` is now a real provider (no SDK — plain `fetch` + `crypto`, consistent with CMI):

- `createSession` — sandbox mirrors the CMI offline simulator (`redirectUrl: null`); live POSTs a Stripe Checkout Session (`line_items[0][price_data]` from the invoice amount in tenant currency, `metadata` = `{ tenantId, invoiceId, externalReference }`, `mode: payment`) and returns the hosted `session.url`.
- `verifyCallback` — sandbox parses the simulator body; live HMAC-SHA256-verifies the `Stripe-Signature` header over the exact raw body (time-tolerant ±5 min), maps `checkout.session.completed` → `{ externalReference, status, amount (minor→decimal), currency }`.
- Added `rawPayload` to `VerifyCallbackInput` + the callback route now preserves the raw body and the `Stripe-Signature` header (previously dropped).
- Added `finance.stripeSecretKey` / `finance.stripeWebhookSecret` secret definitions to the settings registry (live credentials).

**Verified:** `tsc` exit 0; `stripe-provider.test.ts` 4/4 (sandbox + valid signature + tampered/wrong-secret/missing-signature rejection). Live end-to-end pending a real `sk_test_…` key + a Stripe test-mode run.

## Phase J — Sage export adapter

Current: `SageAdapter` throws `501 ERP_NOT_IMPLEMENTED`.

1. Confirm the Sage target (Sage 100 / Sage Business Cloud / local Sage Compta) and its import format or API.
2. Implement `SageAdapter.exportJournal(tenantId, rows)` to emit the mapped journal (account code → Sage chart, currency = tenant currency).
3. **Acceptance:** produced file/API payload matches the target's import spec; validated against a Sage sample.

## Phase K — CMI NAPS live (needs credentials)

Current: sandbox is end-to-end testable; live throws `501 GATEWAY_LIVE_PENDING`.

1. **Inputs required:** CMI merchant ID, store key/secret, production endpoint URL(s), and the callback/HMAC signing spec.
2. Implement live `createSession` (signed checkout request to the CMI gateway) and `verifyCallback` (HMAC-verify the `oid`/amount/status response).
3. **Acceptance:** pass CMI sandbox certification, then a live transaction; HMAC verification rejects forged callbacks.

## Phase L — DAMANCOM / INP export (needs spec)

Current: `DammancomAdapter` throws `501 ERP_NOT_IMPLEMENTED`.

1. **Input required:** the exact DAMANCOM and/or INP filing format (field layout, encoding, file naming).
2. Implement the adapter(s) to emit a compliant file.
3. **Acceptance:** file accepted by the DGI/INP tooling (or a validated sample).

## Phase M — Morocco tax/statutory mappings (needs accountant)

Current: `accounting_source_mappings` exist but tax/statutory rates are uncertified (deliberate non-certification).

1. Enumerate the mappings to certify (TVA rates, IR/salaire, CNSS, DGI form codes, currency).
2. Get an accountant sign-off; record the certification in the plan + code.
3. **Acceptance:** signed-off mapping table committed as the source of truth.

## Phase N — `payroll-posting.ts` ✅ DONE (already implemented)

The prior "unbuilt" note was stale: `src/features/workforce/services/payroll-posting.ts` is fully implemented (Payroll-owned, WA6 contract):

- `buildPayrollAccrual` builds a balanced accrual (debit charges salariales = gross + employer costs; credit CNSS/AMO/IR/net payable/advance recovery) from posted run lines.
- `postRunAccounting` resolves accounts via `accounting_source_mappings` (`payroll` module), posts through Accounting's `postAccountingVoucher` (idempotent by `sourceModule/sourceDocumentId/sourceVersion`), records `payroll_postings`, and queues an `accounting_adapter_exception` (blocked) when a mapping is missing.
- `reverseRunAccounting` reuses `reverseAccountingVoucher` against the recorded accrual.

**Remaining (not a gap in this adapter):** wiring it to an actual approved payroll run UI/trigger once #16 payroll runs are live-verified.

## Verification gates (per phase)

- `tsc --noEmit` — no new source errors.
- `vitest run src/features/finance/` — existing 69 stay green; new suites for any implemented adapter.
- `check-tenant-isolation.ts` — no new flags.
- Live script or curl for anything with a testable path (Stripe test-mode, Sage sample).

## Decision needed

1. **Start with Phase I (Stripe)?** It is the only item buildable end-to-end today without external inputs.
2. **Do you have** CMI merchant creds / DAMANCOM-INP specs / a Sage target in mind? Those unblock K, L, J.
3. **Priority** — Stripe is international/secondary to CMI for a Morocco-first product; confirm it is worth building before CMI goes live.
