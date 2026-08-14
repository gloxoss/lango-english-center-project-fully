# Role Portals Foundation — Implementation Plan

> Status: planned → approved for implementation. Built from the repository's **current real state**
> (not greenfield). Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` FIRST, then
> `role-portals-accounting-workforce-wave.md`, then `ROLE-PORTALS-MASTER-PLAN.md`. This plan is the
> result of the Phase 0 audit; the shared-file protocol in the wave doc governs every edit here.

---

## 0. TL;DR

Build the shared, secure Role Portals Foundation **as a layer over existing infrastructure**, not a
parallel architecture. A real multi-role/active-role context, six `/api/portal/*` routes, a
server-owned, addon-aware `PortalManifest`, a shared portal shell (role switcher + manifest-driven
nav for non-admin portals + scoped search + RTL/mobile/a11y states), and deny-by-default
authorization primitives — with the foundation's automated adversarial suite, live HTTP harness,
`tsc`, and `next build` all green before this plan is marked done.

Scope boundary: this is the **Foundation only**. Parent/Receptionist/Accountant/Workforce domain
features stay owned by their workstreams; this plan delivers the contracts they consume and the
guards they inherit. The full individual-portal feature builds are explicitly out of scope.

---

## 1. Baseline audit (what exists right now)

All findings verified against live files on 2026-08-08. The app is a shared worktree; the files
below are concurrently modified by other agents and must be preserved.

### 1.1 Roles and identity

- `user.role` is a **single** column, `pgEnum('role', [super_admin, school_admin, teacher,
  accountant, student, alumni, parent, receptionist, guard, librarian])` (`src/models/Schema.ts:27`).
- `AppRole` in `src/libs/api/context.ts:7` matches that enum exactly. **No `employee` role** — the
  source spec's own decision; employee identity is the `employeeProfiles` row
  (`resolveEmployeeContext`, `src/features/hr/services/employee-context.ts`). Secondary identities
  are therefore already modeled **outside** `user.role` (employee → `employeeProfiles`, parent →
  `guardianStudents`), not as extra enum values. The foundation must keep this shape.
- `src/models/userMapping.ts` maps French UI labels ↔ enum values; roles are unchanged.

### 1.2 Authorization core (reusable)

- `src/libs/api/context.ts` — `requireRequestContext(request, allowedRoles?)`: Better-Auth session →
  DB principal (active user + active tenant) → role allowlist → `x-tenant-id` header equality check →
  branch from `x-branch-id`/`?branchId`/`user.branchId`. **Single role from `user.role`.** This is the
  pattern every route uses; the foundation must extend it without changing its default behavior.
- `src/libs/api/permissions.ts` — `PERMISSIONS` const map (≈130 keys incl. guard/hostel/inventory/
  broadcast/library/live/transport), `DEFAULT_ROLE_PERMISSIONS` for all 10 roles,
  `hasCapability(userId, tenantId, role, key)` (super-admin short-circuit → user override →
  tenant role override → role default), `requireCapability(ctx, key)`,
  `getEffectivePermissions(...)`. **Solid and reusable as-is.**
- `src/app/api/me/permissions/route.ts` — returns `{ role, permissions: grantedKeys[] }`. Reusable.
- `src/libs/auth/server-context.ts` — `getServerUserContext()` (server-component twin of
  `requireRequestContext`, returns `null` on auth/tenant failure). Reusable.
- `src/libs/api/page-guard.ts` — `requireServerPage(locale, { allowedRoles, requiredCapability })`,
  redirect-based (already used; `page-guard.test.ts` exists). Reusable.
- `src/libs/api/entitlements.ts` — `hasAddon(tenantId, addonId)`, `requireAddon(...)`,
  `listEntitlements(...)` against `addon_entitlements`. **This is the gate the manifest's `addonId`
  field must call — the field is currently dead code (see §1.3).**

### 1.3 Portal manifest (reusable but incomplete)

- `src/libs/api/portal-manifest.ts` — `getPortalManifest(context)` builds `{ role, navigation,
  quickActions, homeWidgets }` from a `FULL_NAVIGATION` array + `QUICK_ACTIONS`, filtering each item
  by `hasCapability`. Existing gaps, verified:
  1. **`addonId` is declared on `NavItem` but never checked** (transport items are declared with
     `addonId: 'transport'` yet render regardless of entitlement).
  2. Single-role only; no `availableRoles`, no active-role awareness.
  3. `homeWidgets` is role-keyed but the widgets are strings with no server-side data backing and no
     scope check.
  4. `FULL_NAVIGATION` is admin-shaped; it does **not** fully describe the non-admin portals (the
     sidebar's own `schoolNavItems` has ~15 modules × dozens of subitems the manifest lacks).
- `src/app/api/portal/manifest/route.ts` — thin GET wrapper (requires tenant unless super_admin).
  Reusable.
- `src/app/api/portal/role-portals.test.ts` — 5 vitest cases asserting per-role home widgets
  (mocks `hasCapability` → true). Extend, don't replace.

### 1.4 Shared shell (reusable but admin-only today)

- `src/app/[locale]/(dashboard)/layout.tsx` — auth + alumni redirect, renders `<Sidebar>` + `<Header>`.
  No active-role context, no per-role shell.
- `src/components/shared/sidebar.tsx` — client; fetches `/api/me/permissions`; capability-gated
  `schoolNavItems`; **single `userRole` from session**; footer shows "Role Actif" badge but no
  switcher; no RTL/mobile menu (fixed `w-64`); hardcoded "active" open-state defaults.
- `src/components/shared/header.tsx` — global search hitting broad `/api/search`, announcements
  unread bell, locale switcher, campus switcher, profile dropdown. `/api/search`
  (`src/app/api/search/route.ts`) is **tenant-scoped but not role-scoped**: a parent/student can
  search the full student/teacher/invoice directory. This is a real privacy gap the foundation must
  close (portal search).

### 1.5 Existing role portals (pages + self-service APIs)

- Pages (all thin stubs reusing feature views): `dashboard/parent` → `ParentsGuardiansView`,
  `dashboard/receptionist` → `ReceptionistPortalView`, `dashboard/accountant` →
  `AccountantPortalView`, `dashboard/teacher` → `TeacherPortalView`, `dashboard/student` →
  `StudentPortalView`, `dashboard/hr/self-service` → `EmployeePortalView`.
- Self-service APIs already real and self-scoped: `/api/employee/me/{home,profile,leave,
  leave/[id]/cancel,time,payroll,payroll/[id]/download}` (gated by `resolveEmployeeContext`), and
  `/api/accountant/me/{home,cashier,office-accounting,receivables,approvals}` (gated by
  `finance.read`/`finance.approve`). `/api/workforce/punches`.
- **Downstream contract target**: these `/me` routes become the reference shape for relationship/
  ownership-scoped endpoints; the foundation does not rewrite them.

### 1.6 Schema / migration state

- Only `rolePermissions` and `userPermissionOverrides` exist from the master plan's shared-data list.
  **None of** `userRoleAssignments`, `assignmentScopes`, `delegations`, `portalPreferences`,
  `portalConsents`, `portalAnnouncements`, `portalActivityEvents` exist.
- Migration journal (`migrations/meta/_journal.json`) max = `0082_student_transport` (idx 83).
  Next = `0083_*`, idx 84, `when` > 1787200000000. Hand-written per APP-CONTEXT §4; never
  `drizzle-kit generate`.

---

## 2. Requirement classification (master plan → status)

| Master-plan requirement | Status | Foundation action |
|---|---|---|
| Roles + permissions (capability map, role defaults, tenant/user overrides) | **Already complete** | Reuse `permissions.ts` unchanged. |
| Server-owned `PortalManifest`, client consumes but APIs reauthorize | Reusable-but-incomplete | Extend manifest: active-role + `availableRoles`, real addon gating via `hasAddon`, per-role nav completeness, scope-aware widgets. |
| Multi-role user + active-context switch, no duplicated accounts | **Genuinely new** | `portal_active_contexts` table + `POST /api/portal/role` (server-validated) + active-role resolution in `requireRequestContext`/`getServerUserContext` (default = `user.role`, no behavior change when absent). |
| Access decision = tenant + user + role/capability + assignment scope + relationship + branch + period | Partially present | Add `src/libs/api/portal-scope.ts` deny-by-default primitives (`assertTenant`, `assertSelf`, `assertBranchScope`, `guardianRelationshipScope`, `employeeSelfScope`); wire into new portal routes. Relationship tables (`guardianStudents`, `employeeProfiles`) already exist. |
| `roles`/`rolePermissions`/`userPermissionOverrides` | Already complete | Reuse. |
| `userRoleAssignments`/`assignmentScopes`/`delegations` | **Deferred (reserved)** | Contract reserved for downstream workstreams (multi-assignment, delegation are their scoped features). Foundation models active role via derived identity, not a new assignment table. Documented, not silently dropped. |
| `portalPreferences` | New | Table + `GET/PATCH /api/portal/preferences`. |
| `portalActivityEvents` | New | Table + `GET /api/portal/activity` + writer helper used by role switches and privileged portal actions. |
| `portalConsents`/`portalAnnouncements` | **Deferred (reserved)** | Announcements already exist (`announcements`). Consents are a downstream privacy feature (Parent/Custody workstream). Noted. |
| `GET /api/portal/{me,manifest,home,search,activity,preferences}` | Only `manifest` exists | Build `me`, `home`, `search` (role-scoped replacement of `/api/search`), `activity`, `preferences`; extend `manifest`. |
| Cross-portal UX: role-scoped home, nav limited to role jobs, scoped global search | Partially present | Portal home aggregates real per-role data; manifest-driven nav for non-admin roles; portal search. |
| Consistent loading/error/empty/offline/permission-denied/relationship-expired/addon-unavailable states | **New (shared)** | `PortalState` helpers + a shared `PortalHomeShell`/skeleton used by the foundation home; states documented for downstream. |
| Notification center, context switcher, persistent visible active context | Notification exists (announcements); switcher **new** | Add role/context switcher (server-validated) to header/sidebar; active-context badge fed by `/api/portal/me`. |
| French + Arabic RTL, keyboard nav, focus, accessible labels | RTL locale infrastructure exists; portal shell **new** | Shell must support RTL (`dir="rtl"` via locale), keyboard traversal, `aria-*` labels. |
| Deny by default, row/field scoping, tenant/relationship tests per endpoint | Partially present | New routes deny-by-default; field redaction in `/me` + search; adversarial + live cross-tenant/role tests. |
| No passwords/hashes/provider secrets/unrestricted bulk exports in portal surfaces | Already complete | Maintained; asserted by the foundation's forbidden-key audit test. |
| Delegation/substitution effective-dated, least-privilege, revocable, audited | **Deferred (reserved)** | Downstream (Accountant/HR delegation). Audited role switches come now via `portal_activity_events` + `audit_log`. |
| Every portal uses one identity/session/notifications/preferences/file/search/activity/locale shell | Partially present | Foundation delivers the shell; file/preferences/activity/search become portal-owned now. |

---

## 3. Architecture decisions

1. **Active-role model (preserve existing roles).** `user.role` stays the authoritative *base* role.
   An additional active role is resolvable only from base role **or** a real derived identity:
   `employeeProfiles` row → `employee`-identity (self-service), `guardianStudents` row → `parent`.
   `POST /api/portal/role` accepts a role, validates it server-side against base+derived identities,
   writes the active context, and returns the new `/api/portal/me`. Forged/unassigned role switches
   are rejected with a generic `403 FORBIDDEN`. Switching to a role with **no** derived identity is
   only allowed if it equals `user.role`.
2. **Active context storage is server-owned.** New table `portal_active_contexts` keyed by
   `sessionId` (unique) — not a cookie, not localStorage, not a query param. `requireRequestContext`
   / `getServerUserContext` join it (fallback to `user.role` when absent) so a stale/absent row is
   safe by default. Row created lazily on first portal request, updated on switch, cleared on logout
   (best-effort; fallback is safe anyway).
3. **Manifest is the single nav source for non-admin portals; admin shell unchanged.**
   The existing `schoolNavItems` sidebar stays for `school_admin`/`super_admin` (it is already
   capability-filtered and richer than the manifest). For `teacher/student/parent/accountant/
   receptionist/guard/librarian/employee` the shell renders manifest nav, so hiding ⇔ authorization
   holds by construction **and** the admin experience doesn't regress. The manifest gains per-role
   nav sections and real `hasAddon` gating for `addonId` items.
4. **Portal search replaces the broad header search for non-admin roles.** `/api/portal/search`
   implements the master plan's "global search limited to authorized entities/fields": parents search
   only their linked children, students only self, employees only self (+ name), staff roles keep the
   existing student/teacher/invoice surface — all tenant-scoped, min-length, capped. `/api/search`
   stays for admin shell compat (or header switches to portal search for everyone; decision in P4).
5. **Migration 0083** (hand-written, idempotent, tenant-safe): `portal_preferences`,
   `portal_activity_events`, `portal_active_contexts`. No `drizzle-kit generate`. No enum changes.
   Journal entry appended (`0083_role_portals_foundation`, idx 84).
6. **Backward compatibility.** Every existing route keeps its current guard. `requireRequestContext`
   default (no active-context row) behaves exactly as today. The only behavior change is: when a
   portal active context exists, `ctx.role`/`ctx.branchId` reflect it — which is what downstream
   portals want.

---

## 4. Phased implementation (files, deps, gates)

Each phase ends with its acceptance gate green before the next phase starts.

### P1 — Active-role context + scope primitives (schema + libs)

**Migration `0083_role_portals_foundation.sql`** (create tables, `IF NOT EXISTS`, `tenantId` on all):
- `portal_preferences(id uuid pk, tenant_id text not null, user_id text not null, pref_key text not
  null, value jsonb not null, updated_at text not null, unique(tenant_id, user_id, pref_key))`
- `portal_activity_events(id uuid pk, tenant_id text not null, user_id text not null, role text not
  null, action text not null, entity_type text not null, entity_id text null, metadata jsonb null,
  created_at text not null, index(tenant_id, user_id, created_at))`
- `portal_active_contexts(id uuid pk, session_id text unique not null, user_id text not null,
  tenant_id text not null, active_role text not null, active_branch_id text null,
  updated_at text not null, index(user_id))`

**Files:**
- `src/features/portal/models/portal-schema.ts` — Drizzle definitions for the three tables.
- Barrel line in `src/models/Schema.ts` (shared — one line, review `git status` first).
- Journal entry in `migrations/meta/_journal.json` (shared — idx 84).
- Apply migration to live DB via a script (see P7 verification), **not** `drizzle-kit generate`.

**Libs:**
- `src/libs/api/portal-scope.ts` (NEW) — deny-by-default pure primitives + live helpers:
  `assertTenantId(ctx)`, `assertSelf(ctx, resourceUserId)`, `assertBranchScope(ctx, branchId)`,
  `guardianRelationshipScope(tenantId, guardianUserId, studentId)` (join `guardianStudents`),
  `employeeSelfScope(ctx)` (reuse `resolveEmployeeContext`), `denyUnless(pred, ...)`.
- `src/features/portal/services/active-context.ts` (NEW) —
  `resolvePortalContext(userId, sessionId)` (active row → base fallback),
  `listAvailableRoles(userRow, tenantId)` (base + derived identities),
  `assertRoleAssignable(...)`, `switchActiveRole(...)` (upsert row + `recordAudit` + activity event).
- `src/libs/api/context.ts` (shared — edit carefully): add optional active-role/branch resolution
  from `portal_active_contexts` keyed by `session.id`; **default unchanged**. Also expose
  `sessionId` on `RequestContext`.
- `src/libs/auth/server-context.ts` (shared): same optional resolution for `getServerUserContext`.

**Gate P1:** `npx tsc --noEmit` exit 0; migration applied; `scripts/check-tenant-isolation.ts` clean
(3-file baseline); a live check that a user with no active-context row gets the same role as before.

### P2 — Shared portal APIs

Files (all NEW under `src/app/api/portal/`):
- `me/route.ts` — `GET /api/portal/me` → `{ userId, name, email, tenantId, tenantName, branchId,
  activeRole, availableRoles[], permissions: grantedKeys[], locale }`. **Field-redacted** (no
  email-adjacent secrets, no tenant internal fields beyond name).
- `manifest/route.ts` — extend existing route to use active context + add `availableRoles`.
- `home/route.ts` — `GET /api/portal/home` → role-scoped widgets with real server data
  (`today/next actions`, unread announcements count, per-role aggregates reusing existing self-scoped
  queries; empty/degraded-safe). Response shape is the widget contract for downstream portals.
- `search/route.ts` — `GET /api/portal/search?q=` role-scoped (min 2 chars, capped, deny-by-default
  entity/field allowlist per role, relationship-scoped for parent/student).
- `activity/route.ts` — `GET /api/portal/activity?limit=` from `portal_activity_events` (own rows,
  role-aware).
- `preferences/route.ts` — `GET` (all keys) / `PATCH` (subset write, validated schema, tenant+user
  scoped).
- `role/route.ts` — `POST /api/portal/role { role, branchId? }` server-validated switch; returns
  fresh `/api/portal/me`; generic `403 FORBIDDEN` on unassignable role; audits.

**Gate P2:** focused vitest for pure logic (`assertRoleAssignable`, scope helpers); live curl matrix
(anonymous 401, base-role user switch to derived role ok, forge to unassigned role 403, cross-tenant
denied).

### P3 — Server-owned PortalManifest

- `src/libs/api/portal-manifest.ts` (shared — integration owner): 
  - Real `addonId` gating via `hasAddon(tenantId, addonId)` inside `filterByPermission`.
  - `availableRoles` on `PortalManifest`.
  - Per-role nav completeness for non-admin roles so manifest-driven nav is a real replacement
    (map the master-plan portal inventory to nav sections: teacher/student/parent/accountant/
    receptionist/guard/librarian/employee).
  - Widget contract: `homeWidgets` entries correspond to `/api/portal/home` keys (agreement test).
- `src/app/api/portal/manifest/route.ts` — wire active context + `availableRoles`.
- **Manifest/API agreement:** vitest that for each role+capability state, a nav item's `href` that
  fails `hasCapability` is excluded AND (live) the corresponding route returns 403 for a caller with
  that role. Add to the foundation adversarial script.

**Gate P3:** agreement test green; addon-gated items hidden when entitlement absent; `tsc` clean.

### P4 — Shared portal shell

- `src/components/shared/portal-role-switcher.tsx` (NEW) — context switcher fed by `/api/portal/me`;
  server-validated via `POST /api/portal/role`; visible only when `availableRoles.length > 1`;
  keyboard + `aria-*`; clears client caches (permissions, search, nav) on switch.
- `src/components/shared/sidebar.tsx` (shared — edit carefully, preserve concurrent work): for
  non-admin active roles render manifest nav (fetched from `/api/portal/manifest`); keep existing
  `schoolNavItems` for admin roles; role badge from `/api/portal/me`; active-context switcher in
  footer.
- `src/components/shared/header.tsx` (shared): search hits `/api/portal/search` (role-scoped);
  notifications bell stays (announcements); role badge shows active context.
- `src/app/[locale]/(dashboard)/layout.tsx` (shared): render a `PortalShell` wrapper providing
  loading/error/empty/permission-denied/degraded states around `children`; `dir` set from locale
  (RTL for Arabic); skip-link + focus outline + mobile hamburger for non-admin portals.
- `src/components/shared/portal-state.tsx` (NEW) — shared `PortalStateView` (loading skeleton /
  empty / error / offline / permission-denied / addon-unavailable) used by home + downstream.

**Gate P4:** RTL renders for `ar`; keyboard tab-order + focus visible; mobile (narrow) hamburger nav
works; role switch clears stale nav/data; no browser-storage writes (adversarial T-check).

### P5 — Security & privacy hardening

- Field-redaction helpers in `src/libs/api/redact.ts` (NEW) + applied in `/me`, `/search`, `/home`.
- `recordAudit` + `portal_activity_events` on role switches and privileged portal actions.
- Forbidden-key audit (finance/hr/safeguarding/credential secrets) across all new portal routes
  (mirrors guard T14 pattern).
- Cross-tenant / cross-branch / cross-relationship negative tests in the adversarial script.

**Gate P5:** adversarial suite green.

### P6 — Foundation deliverables

- `future-implementation/role-portals-foundation/.implementation-plan/IMPLEMENTATION-REPORT.md`
- `future-implementation/role-portals-foundation/MANUAL-TESTING.md`
- `future-implementation/role-portals-foundation/DOWNSTREAM-INTEGRATION-CONTRACT.md`
  (Parent / Receptionist / Accountant / Workforce agents).
- `scripts/verify-portal-foundation.mjs` (live harness) + `scripts/verify-portal-adversarial.mjs`.

**Gate P6:** docs written; harness commands + exit codes recorded.

### P7 — Mandatory verification (recorded, no self-reporting)

1. `npx tsc --noEmit` → exit 0.
2. `npx tsx scripts/check-tenant-isolation.ts` → 3-file baseline only.
3. `npx next build` → exit 0.
4. Live HTTP matrix (two tenants, admin + per-role accounts, real sessions via login):
   anonymous 401 · wrong-role 403 · forged role-switch 403 · stale active-role falls back safely ·
   multi-role switch works (parent↔employee) · cross-tenant 404/403 · cross-branch denied ·
   relationship-scoped (parent→only linked children) · manifest/API agreement ·
   no stale data after switch · sensitive-field projection · FR + AR/RTL render · keyboard/mobile.
5. Automated: vitest focused suites + `verify-portal-adversarial.mjs` + `verify-portal-foundation.mjs`.
6. Migration applied + rerunnable; DB left tenant-safe (no cross-tenant rows).
7. Browser checks that can't be automated are listed as **pending** in the report — never claimed.

---

## 5. Migration 0083 detail

Hand-written, `CREATE TABLE IF NOT EXISTS`, `tenantId` present on every table, no FK enforcement at
schema layer (matches APP-CONTEXT §3). Journal entry:
`{ "version":"7", "when": <1787200000001>, "tag":"0083_role_portals_foundation", "breakpoints":true, "idx": 84 }`.
Apply via the repo's existing direct-apply script pattern; verify with a real `docker compose build
migrate && docker compose up migrate` **or** a direct psql apply with captured exit code.

## 6. Risks & concurrency

- **Shared files** (`context.ts`, `portal-manifest.ts`, `sidebar.tsx`, `header.tsx`, dashboard
  layout, `Schema.ts`, journal): integration-owner protocol — `git status --short` before every
  edit, preserve unrelated changes, never reset/reformat.
- **Sidebar is heavily edited by other agents**: the non-admin/manifest path is additive (new branch
  of rendering), the admin path is untouched.
- **`next build`/`tsc` can transiently fail on unrelated in-flight edits** (live-classrooms,
  academics refactors seen this session): re-run against the settled tree; never "fix" unrelated
  code.
- **Migration numbering**: allocate `0083` immediately before integration; if another agent lands a
  migration first, take the new max+1.

## 7. Acceptance gates (summary)

- [ ] P1: migration applied + rerunnable; context default unchanged; `tsc` clean.
- [ ] P2: six portal routes live; role-switch authz matrix green.
- [ ] P3: manifest addon-gated + agreement test green.
- [ ] P4: RTL/mobile/keyboard shell; role-switch clears stale state.
- [ ] P5: adversarial security suite green.
- [ ] P6: report + manual-testing guide + downstream contract written.
- [ ] P7: tsc · check-tenant-isolation · next build · live two-tenant matrix all recorded with exit
      codes; pending browser items listed explicitly.
