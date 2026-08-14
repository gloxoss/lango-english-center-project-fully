# Receptionist Portal — Implementation Report

**Status:** COMPLETE (R1–R5 implemented & verified; R6 docs). Date: 2026-08-09.
Controlling spec: [`RECEPTIONIST-PORTAL-PLAN.md`](../RECEPTIONIST-PORTAL-PLAN.md).
Execution plan: [`EXECUTION-PLAN.md`](./EXECUTION-PLAN.md). Verification evidence:
[`VERIFICATION-EVIDENCE.md`](../VERIFICATION-EVIDENCE.md). Manual guide: [`MANUAL-TESTING.md`](../MANUAL-TESTING.md).

## What was built

A guarded, tenant+branch-scoped front-desk workspace covering inquiries, appointments, visitor/pickup
desk and coordination handoffs — without any implicit finance, admissions-conversion, bulk-messaging or
raw-contact-export authority.

- **Schema (5 tables):** `reception_appointments`, `reception_appointment_status_history`,
  `reception_identity_verifications`, `reception_handoffs`, `reception_handoff_status_history`
  (`src/features/reception/models/reception-schema.ts`). Status history immutable append-only; partial
  unique `idempotency_key` on appointments + handoffs; `version` bump per transition; `FOR UPDATE` +
  status-guard concurrency.
- **Services:** `lookup-service` (masked purpose-limited search), `appointments-service` (lifecycle,
  concurrency, history, allowlisted notifications), `handoffs-service` (lifecycle, history), `home-service`
  (degradable aggregate), `identity-service` (method+outcome only), `notifications-service` (template
  allowlist).
- **APIs (27 route files):** `me/home`, `lookup`, `inquiries(+follow-ups)`, `appointments(+reschedule/
  cancel/check-in/complete/no-show)`, `visitors(+pass/check-in/check-out)`, `gates`, `pickups/students`,
  `pickups/authorizations(+cancel)`, `pickups/release`, `verifications`, `handoffs(+acknowledge/resolve/
  cancel)`, `staff`. Every route: `requireRequestContext` → `requireTenant` → `requireCapability`.
- **Pages (6):** `/dashboard/receptionist` (home, `page.tsx`), `inquiries`, `appointments`, `visitors`,
  `pickups`, `handoffs` — each `requireServerPage`-guarded; 8 UI views in `src/features/reception/ui/`.
- **Capabilities (8):** `reception.portal.use`, `reception.lookup`, `reception.inquiry.create`,
  `reception.inquiry.manage`, `reception.appointment.manage`, `reception.handoff.manage`,
  `reception.visitor.manage`, `reception.pickup.release`. 7 granted by default to `receptionist`;
  **`reception.pickup.release` is not default** (guard-owned, granted via `userPermissionOverrides` for
  the positive-path fixture, denied-by-default asserted). Role trim: `admissions.manage`,
  `communication.send`, `crm.manage` removed from receptionist defaults per spec.
- **Shared edits (merge-safe):** `permissions.ts` (+8 keys, role trim), `portal-manifest.ts` (reception
  group, 6 children), `sidebar.tsx` (new manifest icons), `Schema.ts` (one barrel line).

## Security properties delivered (spec §"Do not implicitly grant")

- No finance routes, no cash collection, no admissions conversion (`convertInquiryToApplicant` is never
  imported; a finance handoff creates intent only, never a voucher/invoice), no bulk messaging, no raw
  contact export.
- Lookup returns only id, name, masked contact, person type, branch/class routing context, guardian
  status — **never** national ID, salary, bank, medical, credentials, notes, grades, finance balances.
- Pickup release requires an explicit effective `guard_pickup_authorizations` row; never inferred from
  primary-contact status; single-release; replay-safe.
- Inquiry intake dedups (duplicate candidate surfaced, 409 `DUPLICATE_INQUIRY`) and is idempotent
  (partial-unique key, `created:false` on replay).
- Deny-by-default uniform 404 for wrong-tenant / wrong-branch / unknown id (no existence oracle).

## Verification (repeatable)

1. Migration `0092_receptionist_portal.sql` applied + idempotent rerun → **PASS**.
2. `npx tsx scripts/seed-reception-fixtures.ts` → `VERIFY_BASE=http://localhost:3002 node
   scripts/verify-reception-security.mjs` → **27/27 checks PASS** (T01–T25); full seed→verify cycle run
   twice back-to-back, clean.
3. `tsc --noEmit` reception scope → **0 errors**.
4. `npx tsx scripts/check-tenant-isolation.ts` → all `/api/reception/**` **PASS**.
5. `npx next build` → Turbopack **compiled in 5.0 min**; type-check blocked by **pre-existing**
   `src/features/workforce/services/payroll-runs.ts:562` (concurrent-agent scope, left untouched per
   concurrent-worktree rules).

## Capability usage across routes

`reception.appointment.manage` ×9, `reception.visitor.manage` ×6, `reception.pickup.release` ×6,
`reception.handoff.manage` ×5, `reception.lookup` ×2, `reception.inquiry.manage` ×2,
`reception.portal.use` ×1, `reception.inquiry.create` ×1.

## Pending manual steps

- Browser walkthrough of the happy-path sweep and security surfaces — see
  [`MANUAL-TESTING.md`](../MANUAL-TESTING.md).
- Visual/UX + a11y pass in FR/EN/AR (incl. RTL).
- Tune lookup rate-limit threshold to operational expectations (boundary asserted at 429).
- Real SMS provider wiring (notifications are log-only `sms_messages` by design).
- Confirm handoff surfacing in each destination module's own UI (Admissions/Finance/Teacher inboxes).
- Re-run the full battery after the concurrent `workforce` type-check errors are resolved so the
  repo-wide `next build` gate goes green.
