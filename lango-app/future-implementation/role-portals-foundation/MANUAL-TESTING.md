# Role Portals Foundation — Manual Testing Guide

This guide walks through every verification the foundation requires, from
automated suites to live HTTP and browser-level checks. Run the automated
layers first; the browser section is the final human acceptance gate.

## 0. Prerequisites

- Dev server running: `npm run dev` (this document assumes `http://localhost:3002`).
- Local Postgres with the `schoolos` DB seeded (tenant A "Atlas" admin
  `y.elamrani@atlas.ma` / `Admin123!`, tenant B "Lango" admin
  `admin@lango.ma` / `Admin123!`).
- Migration `0083_role_portals_foundation` applied and idempotent (see §2.6).

## 1. Automated checks (run in order)

### 1.1 TypeScript
```
npx tsc --noEmit
```
Expect exit 0. The only remaining errors, if any, belong to other agents'
in-flight files (`scripts/test-transport-live-acceptance.ts`,
`src/features/live-classrooms/providers/dev-provider.test.ts`) — not part of
the foundation.

### 1.2 Focused authorization unit suites
```
npx vitest run src/app/api/portal/role-portals.test.ts src/app/api/portal/portal-security.test.ts
```
Expect `2 passed`, `41 tests passed`. These pin:
- base role always assignable; `super_admin` can switch into nothing; `parent`
  requires a live guardian identity; arbitrary targets refused;
- `listAvailableRoles` returns base (+ parent when a guardian identity exists),
  and the base role alone for a tenantless principal;
- `resolveActiveContext` returns null with no row, null for `super_admin`,
  refuses a stored role that is no longer assignable (and drops the stale
  row), refuses a context bound to another tenant, **refuses a context bound to
  another user (P0)**, **clears a stored active branch that is not the
  principal's authoritative branch or no longer exists in the tenant (P1)**,
  and keeps a branch that matches the authoritative assignment;
- portal-scope primitives fail closed (`requireTenantId`, `assertSelf`,
  `assertBranchScope`, `denyUnless`);
- `searchPortal` parent → linked children only with the exact
  `{id, name, email, matricule}` projection (no finance/HR/sensitive keys),
  student → self only, no cross-student match;
- the portal preference key allowlist rejects unknown keys (400
  `INVALID_PREFERENCE_KEY`).

### 1.3 Tenant isolation static check
```
npx tsx scripts/check-tenant-isolation.ts
```
The portal routes (`/api/portal/me`, `/api/portal/search`) are tenant-scoped
by construction (session-derived tenant, applied in the service layer) and pass.
The script still fails on `src/app/api/guard/*` and `src/app/api/guardian/me/children/*`
routes that belong to the concurrent guard/guardian workstreams — those are not
part of this feature.

### 1.4 Live authenticated HTTP matrix (repeatable script)
```
node scripts/verify-portal-foundation.mjs
```
Expect `SUMMARY: 47/47 checks passed` and no leftover rows afterwards. The
script uses **disposable fixtures only** — it creates and deletes two throwaway
tenant-A users (a `school_admin` and a `student` actor with a guardian
identity), each with a known password. It never signs in as a shared
administrator, so no shared account's lockout/session state is touched. It
verifies, live:
1. Anonymous requests to `/api/portal/{me,manifest,home,search,preferences}`
   and `POST /api/portal/role` all return **401**.
2. Disposable tenant-A school_admin: `me.tenantId === T1`,
   `role === baseRole === school_admin`, `availableRoles === [school_admin]`,
   non-empty permissions; manifest navigation well-formed with `baseRole` +
   `availableRoles`; home returns role + widgets.
3. Search returns tenant students with the exact redacted projection and no
   finance/HR/sensitive keys.
4. Role gates: forging `librarian` → **403**; switching to the own base role →
   200; `x-tenant-id: <T2>` on a T1 session → **403**; role switch carrying an
   unassigned `branchId` → **403**.
5. Derived switch: a student holding a live guardian identity can switch to
   `parent` (200), keeps `baseRole === student`, and the active context row is
   persisted server-side. Forging `teacher` → **403**.
6. Preferences: allowed key persists (PATCH 200 / GET returns it); unknown key
   → **400**.
7. Stale degradation: after the guardian identity is revoked, the same session
   degrades back to `student` and the stale context row is dropped.
8. Context tampering: a context row whose `user_id` is switched to another real
   user is refused and dropped (**P0**); a context row whose `active_branch_id`
   is tampered to a non-authoritative branch is cleared on read (**P1**).
   (Pointing the row at a *non-existent* user is separately impossible — the
   `0086` FK rejects it, which the script observes as a live FK violation.)

### 1.5 Production build
```
npx next build
```
Expect a successful build with no TypeScript errors. (Note: do not run while a
dev server is mid-hydration; stop the dev server first if the build reports
`.next` contention.)

### 1.6 Migration idempotency
The migration files `migrations/0083_role_portals_foundation.sql` and
`migrations/0086_role_portals_referential_integrity.sql` are hand-written and
idempotent. Re-run each against the live DB and expect **0 failing statements**;
the tables `portal_active_contexts`, `portal_preferences`,
`portal_activity_events` must exist, and the `0086` FKs
(`portal_active_contexts.{user_id,session_id}` and both
`portal_preferences.user_id` / `portal_activity_events.user_id` → `"user"` /
`"session"`) must be present. Never regenerate them with `drizzle-kit generate`.

## 2. Browser-level acceptance (human gate)

These are the checks that static inspection and automated tests cannot prove.
They are **pending** until a human (or a browser-automation agent) performs
them against the dev server.

### 2.1 Login and role badge
1. Open `http://localhost:3002/<locale>/login` (French `fr`, Arabic `ar`).
2. Sign in as `y.elamrani@atlas.ma` / `Admin123!`.
3. Header shows the avatar with the **effective role** badge "school_admin".
4. Open `/api/portal/me` in a second tab: the `role` matches the badge.

### 2.2 Role switcher (only when authorized)
1. A user who can switch roles must see the switcher in the sidebar footer
   (native `<select>`, keyboard-accessible).
2. A `school_admin` with no derived identity must **not** see a switcher.
3. Switching must dispatch a server round-trip (`POST /api/portal/role`), not
   a client-side variable change. Inspect the Network tab.
4. After switching, the sidebar navigation and header search results must
   refresh to the new role (no stale data).

### 2.3 Search scoping
1. As a school_admin, search a student name → result row shows only name /
   email / matricule; no salary, guardian, medical, national-id or finance
   fields.
2. As a student account (create one with a known password, see the throwaway
   user pattern in `scripts/verify-portal-foundation.mjs`), search another
   student's name → **no result**.

### 2.4 Cross-tenant / cross-branch (developer console)
1. With a tenant-A session, issue
   `fetch('/api/portal/me', { headers: { 'x-tenant-id': '<tenant-B-id>' } })`
   → expect 403.
2. Attempt a role switch with a foreign `branchId` → expect 403.

### 2.5 Privacy / no leaked data after role switch
1. As a student→parent actor, switch to parent and open search; results are
   scoped to linked children.
2. Switch back / logout and log back in: the previous role's cached search
   results must be cleared (the `portal:role-changed` listener clears them).

### 2.6 RTL, keyboard and mobile
1. Arabic locale renders the dashboard with `dir="rtl"` and mirrored layout;
   French renders LTR.
2. Tab order reaches the skip-link ("Aller au contenu principal") first; the
   active element shows a visible focus ring.
3. Narrow the viewport (DevTools responsive mode): the hamburger/sidebar
   navigation remains usable, and no horizontal overflow on the portal pages.
4. All interactive controls (search, notifications, role switcher, dropdowns)
   are reachable by keyboard and announce themselves to a screen reader.

### 2.7 Degraded states
1. With the network throttled (DevTools → Network → Slow 3G), the header's
   `/api/portal/me` fetch fails silently and the badge falls back to the
   session role — the page must not crash.
2. With the server stopped, portal pages render the offline/error state via
   `PortalStateView` (loading / empty / error / forbidden / addon-unavailable)
   rather than a blank screen.

## 3. Checklist for sign-off

- [ ] §1.1 `npx tsc --noEmit` exit 0
- [ ] §1.2 both portal vitest suites green (41 tests)
- [ ] §1.3 tenant-isolation script shows no portal failures
- [ ] §1.4 `verify-portal-foundation.mjs` → 47/47, no leftover rows
- [ ] §1.5 `npx next build` succeeds
- [ ] §1.6 migrations 0083 + 0086 rerun → 0 failed statements
- [ ] §2.1 login + role badge
- [ ] §2.2 role switcher visibility and server round-trip
- [ ] §2.3 search scoping + redaction (admin vs student)
- [ ] §2.4 cross-tenant / cross-branch denial
- [ ] §2.5 no stale data after role switch
- [ ] §2.6 French + Arabic/RTL + keyboard + mobile
- [ ] §2.7 degraded states

Only the §1 items are automated today. §2 is the remaining human/browser gate.
