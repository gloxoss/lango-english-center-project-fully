# Receptionist Portal — Verification Evidence

Date: **2026-08-09**. Live environment: own `next dev` on `:3002` (the :3000 process is a stale
container without reception routes). DB: `schoolos` PostgreSQL 17. All checks repeatable — seed →
verify runs green back-to-back.

## 1. Result summary

| Gate | Result |
|---|---|
| Migration `0092` apply | PASS — 5 reception tables created |
| Migration `0092` idempotent rerun | PASS — re-applies with exit 0, no duplicate |
| Live security battery (`verify-reception-security.mjs`) | **27/27 checks PASS** (T01–T25) |
| Seed script idempotence | PASS — full seed→verify cycle run twice, clean both times |
| `tsc --noEmit` (reception scope) | PASS — 0 errors across `features/reception`, `dashboard/receptionist`, sidebar, portal-manifest, seed script |
| Tenant isolation (`check-tenant-isolation.ts`) | PASS — all `/api/reception/**` routes green |
| `next build` | PARTIAL — Turbopack compiled in 5.0 min; type-check blocked by **pre-existing** `src/features/workforce/services/payroll-runs.ts:562` (concurrent-agent scope, untouched) |

## 2. Live security battery — 27/27

`VERIFY_BASE=http://localhost:3002 node scripts/verify-reception-security.mjs`

| Check | Assertion | Result |
|---|---|---|
| T01 | Anonymous → 401 on every `/api/reception/**` route | PASS |
| T02 | Wrong-role teacher → 403 on reception routes | PASS |
| T03 | Home aggregate `me/home` 200 for receptionist | PASS |
| T04 | Lookup `?q=Re` (short) → 422 `VALIDATION` | PASS |
| T05 | Lookup `?q=REC-001` → masked phone (`****`), raw `+212610000010` absent; `?q=Guardian` → `+21****06` | PASS |
| T05b | Lookup no-match → 404 `NO_MATCH`; cap ≤ 20 enforced | PASS |
| T06 | Inquiry dedup: same phone → 201 then 409 `DUPLICATE_INQUIRY`, exactly 1 row | PASS |
| T07 | Inquiry idempotent replay → `created:false`, rows still 1 | PASS |
| T08 | Notification allowlist: non-allowlisted template → 422 `VALIDATION_ERROR`; `appointment_scheduled` → 1 `sms_messages` row containing "Rendez-vous confirmé" | PASS |
| T09 | Appointment happy path: check-in → complete; `data.appointment.status === 'completed'`, `version === 2`, history `scheduled, checked_in, completed` | PASS |
| T10 | Appointment transition: reschedule non-scheduled → 409 `NOT_SCHEDULED` | PASS |
| T11 | Appointment invalid transition → 409 `INVALID_TRANSITION` | PASS |
| T12 | Appointment concurrency race (Promise.allSettled): one 200, one 409 — no double transition | PASS |
| T13 | Visitor pass → check-in → check-out; repeats → `replayed:true`, single transition | PASS |
| T14 | Pickup release default-deny: receptionist w/o override → 403 (release + authorizations) | PASS |
| T15 | Pickup release override positive: single release; same replay key + fresh key both → 409; `guard_release_events` count === 1 | PASS |
| T16 | Unlinked guardian → 422 `PICKUP_PERSON_NOT_LINKED` | PASS |
| T17 | Handoff lifecycle + transitions + history; replay-safe create | PASS |
| T18 | Handoff concurrency race → one wins, one 409 | PASS |
| T19 | Handoff create = intent only (no voucher/invoice/finance row) | PASS |
| T20 | Static scan: no finance/admissions imports under `features/reception` or `app/api/reception` | PASS |
| T21 | Finance denial: `/api/finance/expenses` → 403 for receptionist | PASS |
| T22 | Cross-tenant (SchoolOS receptionist) + wrong-branch (branch-B receptionist) → uniform 404 | PASS |
| T23 | Schema: 5 tables + 2 partial-unique idempotency indexes | PASS |
| T24 | Manifest: `reception` group + 6 permission-gated children | PASS |
| T25 | Routes guard ctx/tenant/capability; pages guard `requireServerPage` | PASS |

## 3. Migration

`migrations/0092_receptionist_portal.sql` (idempotent `CREATE TABLE IF NOT EXISTS`), journal `idx` 93.
Tables: `reception_appointments`, `reception_appointment_status_history`, `reception_identity_verifications`,
`reception_handoffs`, `reception_handoff_status_history`. Applied once, re-applied idempotently.

## 4. Route inventory (27 route files under `src/app/api/reception/`)

- `me/home` GET
- `lookup` GET
- `inquiries` GET/POST; `inquiries/[id]/follow-ups` POST
- `appointments` GET/POST; `appointments/[id]` GET; `[id]/reschedule`, `[id]/cancel`, `[id]/check-in`,
  `[id]/complete`, `[id]/no-show` POST
- `visitors` GET/POST; `visitors/[id]/pass`, `visitors/[id]/check-in`, `visitors/[id]/check-out` POST
- `gates` GET
- `pickups/students` GET; `pickups/students/[id]/pickups` GET; `pickups/authorizations` POST;
  `pickups/authorizations/[id]/cancel` POST; `pickups/release` POST
- `verifications` POST
- `handoffs` GET/POST; `handoffs/[id]/acknowledge`, `[id]/resolve`, `[id]/cancel` POST
- `staff` GET

Capability gates across routes: 9 `reception.appointment.manage`, 6 `reception.visitor.manage`,
6 `reception.pickup.release`, 5 `reception.handoff.manage`, 2 `reception.lookup`, 2 `reception.inquiry.manage`,
1 `reception.portal.use`, 1 `reception.inquiry.create`.

## 5. Pages (6, under `[locale]/(dashboard)/dashboard/receptionist/`)

`page.tsx` (home), `inquiries`, `appointments`, `visitors`, `pickups`, `handoffs` — each calls
`requireServerPage(locale, { allowedRoles:['receptionist'], requiredCapability:'reception.portal.use' })`.

UI views in `src/features/reception/ui/`: `reception-home-view`, `reception-inquiries-view`,
`reception-appointments-view`, `reception-visitors-view`, `reception-pickups-view`,
`reception-handoffs-view`, `reception-inquiry-dialog`, `reception-lookup-panel`.

## 6. Capabilities

8 keys in `PERMISSIONS` (`permissions.ts:188-195`): `reception.portal.use`, `reception.lookup`,
`reception.inquiry.create`, `reception.inquiry.manage`, `reception.appointment.manage`,
`reception.handoff.manage`, `reception.visitor.manage`, `reception.pickup.release`.

7 of 8 granted by default to the `receptionist` role (`permissions.ts:363-368`). **`reception.pickup.release`
is deliberately NOT default** — release stays guard-owned; the positive path is exercised only via a
`userPermissionOverrides` row on `REC-PICKUP-USER`, and the default-deny path (403) is asserted on
`REC-USER`. Role trim applied per spec: `admissions.manage`, `communication.send`, `crm.manage` removed
from receptionist defaults; read-only `admissions.view` / `communication.read` retained.

Sidebar/manifest (`portal-manifest.ts:164-178`): `Accueil & Réception` group, icon `ConciergeBell`,
6 permission-gated children.

## 7. Known / pre-existing findings

- `tsc` leaves 2 errors in `src/features/workforce/services/payroll-runs.ts:562` and
  `payroll-engine.test.ts` — **pre-existing concurrent-agent work, untouched** per concurrent-worktree rules.
- `check-tenant-isolation.ts` reports 6 pre-existing failures outside reception
  (`guard/kiosk-sessions/[id]/close|lock`, `guard/me/gate`, `guard/me/shift`,
  `guardian/me/children/[relationshipId]`, `leadership/me/home`) — none in this module.
- `next build` type-check blocked by the same pre-existing `payroll-runs.ts:562` error; Turbopack
  compilation itself completed (5.0 min).
