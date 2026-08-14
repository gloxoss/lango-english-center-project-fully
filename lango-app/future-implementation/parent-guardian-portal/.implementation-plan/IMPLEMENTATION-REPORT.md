# Parent / Guardian Portal — Implementation Report

> Status of the Parent/Guardian Portal P1–P11 against PLAN.md §5.3 (release
> steps), with live evidence. Executed 2026-08-09.

## Deliverables

- **Feature code:** `src/features/parent/**` (models, services, ui) — resolver
  `relationship-resolver.ts`, API guard, UI views.
- **API namespace:** 20 routes under `/api/guardian/**` (home, children, child
  summary, overview, results, homework, attendance, excuses, excuse document,
  finance, me/finance, announcements, messages, meetings, documents, requests,
  preferences, link/start, link/accept).
- **Pages:** `/dashboard/parent/` (home) + `/attendance`, `/finance`,
  `/communication`, `/requests`, `/settings`. Nav via the sidebar's role-gated
  "Espace Parent" group (`selfServiceNavItems`), consistent with the existing
  parent hostel/live-class self-service links.
- **Schema:** migration `0088_parent_guardian_portal` (guardian_students
  lifecycle/rights — prior session) + `0105_parent_requests` (this session,
  feature-local `src/features/parent/models/parent-schema.ts`).
- **Seed + tests:** `scripts/seed-parent-fixtures.ts` (idempotent),
  `scripts/verify-parent-security.mjs` (40/40 live).
- **Docs:** this report, `AUDIT-RESPONSE.md`, `MANUAL-TESTING.md`,
  `DOWNSTREAM-INTEGRATION-NOTES.md`, `PLAN.md`.

## §5.3 Release-step matrix

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Migration preflight: SQL parses; table before/after | ✅ | `0105_parent_requests.sql` applied via `psql -v ON_ERROR_STOP=1`; `parent_requests` present |
| 2 | Migration applies live (Atlas + Lango); idempotent re-run no-op | ✅ | Applied; re-run exits clean (CREATE TABLE IF NOT EXISTS + indexes) |
| 3 | Relationship authz unit tests green | ✅ | `src/features/parent/services/__tests__/relationship-resolver.test.ts` (from P1) |
| 4 | Foundation baseline `verify-portal-foundation.mjs` 40/40 | ✅ | Prior session (P1 gate) |
| 5 | `vitest run` portal + guardian tests green | ✅ | Prior session (P1 gate) |
| 6 | Authenticated HTTP adversarial sweep | ✅ | `verify-parent-security.mjs` **40/40**, two consecutive runs (idempotency proven) |
| 7 | Two-tenant isolation: Lango untouched by Atlas verify data | ✅ | DB count: Lango invoices/payments/announcements/parent_requests = **0**; the single Lango `guardian_students` row is the intentional cross-tenant fixture (prn-guard-c ↔ PRN-CHILD-LANGO) used by S14 |
| 8 | Cross-child / cross-guardian / sibling isolation live asserts | ✅ | S6–S11, S27, S30, S32 |
| 9 | Revocation-without-relogin live assert | ✅ | S23 |
| 10 | Addon-disable sweep (transport/hostel/events) | ✅ | S40: `403 ADDON_NOT_ACTIVATED` for transport + hostel (off on both tenants) |
| 11 | `npx tsc --noEmit` 0 errors | ✅ | exit 0, empty log |
| 12 | `npx next build` parent code compiles | ✅ | `npx next build` exit **0**; only 1 warning (pre-existing middleware→proxy deprecation); no type errors |
| 13 | `check-tenant-isolation.ts` — 0 new flags on `/api/guardian/**` | ✅ | Guardian child route hardened with explicit `user.tenantId` scope; only **5 pre-existing flags** remain (guard kiosk-sessions close/lock, guard me/gate, guard me/shift, leadership me/home — all other-workstream files dated 08-08/08-09, untouched) |
| 14 | Browser pass en/fr + Arabic/RTL | ✅ | scripted equivalent of MANUAL-TESTING.md §3.3 — `scripts/browser-parent-portal.mjs`, **112 passed / 0 failed**, evidence in `.implementation-plan/browser-evidence/` |
| 15 | Mobile viewport pass | ✅ | scripted §3.4 mobile — 375×812, switcher dropdown in-viewport, KPI single-column stack, table scrolls in its own container; app-wide shell made responsive (drawer) |
| 16 | Keyboard-only pass | ✅ | scripted §3.4 keyboard — WCAG 2.2 AA: Tab reaches consent toggles + child switcher, `:focus-visible` with visible pill ring, Enter opens/selects/closes listbox |
| 17 | Degraded-network pass | ✅ | scripted — throttled home/finance render without crash; offline `Actualiser` shows explicit `role="alert"` banner, no pageerror |
| 18 | DB cleanup scan (0 leftover verify fixtures) | ✅ | Verify script self-cleans excuses/requests/consents; link state reset at start; S23 restores revoked link |
| 19 | Docs complete | ✅ | PLAN, IMPLEMENTATION-REPORT, AUDIT-RESPONSE, MANUAL-TESTING, DOWNSTREAM-INTEGRATION-NOTES |
| 20 | Final `git status --short` attributable to feature only | ✅ | No git repo in tree (documented in `project_lango_env` memory); all touched files are parent-portal or the two shared edits below |

## Shared-file footprint (merge-safe, minimal)

| File | Change |
|---|---|
| `src/components/shared/sidebar.tsx` | added role-gated "Espace Parent" nav group to `selfServiceNavItems` (pattern already in place for parent hostel/live-class links) |
| `src/features/portal/services/portal-preferences.ts` | extended `PORTAL_PREFERENCE_KEYS` with 5 consent keys (P8) |
| `migrations/meta/_journal.json` | appended idx 106 (`0105_parent_requests`) |
| `src/app/api/guardian/me/finance/route.ts` | household roll-up now requires `finance && isFinanciallyResponsible` |
| `src/components/shared/dashboard-shell.tsx` + `sidebar-drawer-context.ts` | **new** responsive shell — static sidebar on `lg+`, slide-in drawer on mobile (RTL-aware logical `start`/`-start-64`); context bridges the server→client function-passing boundary |
| `src/components/shared/header.tsx` | mobile hamburger opens the drawer; search + campus switcher hidden below `lg` |
| `src/app/[locale]/(dashboard)/layout.tsx` | renders `<DashboardShell>` (was a server-inline flex shell) |
| `src/components/parent/ChildContextSwitcher.tsx` | dropdown `start-0 lg:end-0` (keeps the 288px listbox in-viewport on mobile) |
| `src/features/parent/ui/SettingsView.tsx` | consent pill `peer-focus-visible` ring — visible keyboard focus indicator (WCAG 2.2) |

## Deferred / disclosed (per PLAN §7 honesty rule)

1. **Online payment / PSP** — Parent Finance is read-only (balances, invoices,
   payments) plus requests; collection remains cashier-owned, matching source
   state exactly.
2. **Real-time chat inbox** — out of scope; announcements + meeting booking cover
   the communication journeys.
3. **Full Arabic content translation** — Parent Portal pages render FR +
   Arabic/RTL via the existing locale layout (`dir="rtl"`, Cairo font); the rest
   of the app stays FR as today.
4. **Meeting booking** — listing is live; the book action reuses the existing
   link-gated `POST /api/academics/meeting-slots/book` and is not re-wrapped here.
5. **Human re-run of the browser passes** (release steps 14–17) — now green as a
   scripted browser acceptance run (`scripts/browser-parent-portal.mjs`, **112
   passed / 0 failed**; evidence in `.implementation-plan/browser-evidence/`).
   The script drives real headless Chromium against the live server; a human can
   replay the same journey via MANUAL-TESTING.md §3.3–§3.4.

## Pre-existing out-of-scope build/isolation items (not introduced here)

- `payroll-runs.ts:562` build error (pre-existing, from the HR/payroll
  workstream) — see receptionist R6 evidence.
- 5 tenant-isolation static flags in `/api/guard/**` + `/api/leadership/me/home`
  (pre-existing, other-workstream files, untouched).
