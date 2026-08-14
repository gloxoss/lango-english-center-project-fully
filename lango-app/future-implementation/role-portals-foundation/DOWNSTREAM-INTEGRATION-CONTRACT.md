# Role Portals Foundation — Downstream Integration Contract

This document is the contract for the Parent, Receptionist, Accountant and
Workforce portal workstreams (and any future role portal) that build on the
Role Portals Foundation. Follow it exactly — the foundation's authorization
properties only hold if downstream code does not bypass it.

## 0. The one rule

> **Never trust browser storage, query parameters, or client state as
> authorization.**

Tenant id, base role, active role and branch id are **server-owned**: they come
from the authenticated Better-Auth session inside `requireRequestContext`.
Client code may render whatever it wants, but every server read must be
authorized server-side.

## 1. Server-owned context model

| Concept | Owner | Stored | Notes |
|---|---|---|---|
| Base role | `user.role` | DB | authoritative, never changes per-session |
| Active role | `portal_active_contexts` | DB, keyed by `sessionId` | created by `POST /api/portal/role`, re-validated on every read |
| Derived roles | `guardians`/`guardian_students` join | DB | today only `parent` ← guardian identity |
| Branch scope | principal (`user.branchId`) | DB | authoritative-only; client `x-branch-id` / `?branchId=` is **never** honored |
| Tenant | session | DB | cross-tenant `x-tenant-id` mismatch → 403 |

`resolveActiveContext` refuses stale contexts: if the stored active role is no
longer assignable (e.g. a guardian link was revoked), the row is dropped and the
session falls back to the base role. **Every read is bound to the authenticated
user** — a stored context whose `user_id` or tenant does not match the session
principal is refused and dropped. **The stored active branch is revalidated on
every read** — it is honored only when it equals `user.branchId` **and** still
resolves to a tenant-owned branch; otherwise it is cleared in place. Never cache
an active role or branch client-side.

> **Branch rule for downstream agents:** read the effective branch from
> `context.branchId` (server-derived). Do not send `x-branch-id` / `?branchId=`
> expecting it to switch scope — it is ignored. A role-switch body may carry a
> `branchId`, but only one equal to the current authoritative `context.branchId`
> is accepted (else generic 403).

## 2. Portal API surface

All endpoints require a session (anonymous → **401**) and return
`{ success: boolean, data }` or a `{ error }` envelope.

### `GET /api/portal/me`
Server-derived actor context. Shape:
```jsonc
{
  "userId": "USR-001",
  "name": "…",
  "email": "…",
  "tenantId": "uuid|null",      // null only for super_admin
  "tenantName": "…",
  "branchId": "uuid|null",
  "role": "school_admin",       // effective role (may differ from baseRole)
  "baseRole": "school_admin",   // the session's authoritative role
  "availableRoles": ["school_admin"],
  "permissions": ["students.read", "…"]   // granted permission keys
}
```

### `GET /api/portal/manifest`
Server-filtered navigation + widgets for the effective role. Shape:
```jsonc
{
  "role": "…", "baseRole": "…",
  "availableRoles": ["…"],
  "navigation": [ { "label": "…", "href": "…", "icon": "…", "addonId": "…?" } ],
  "quickActions": [ "…" ],
  "homeWidgets": [ "…" ]        // must equal HOME_WIDGETS[role] (pinned by test)
}
```
**Contract:** a nav item is included only when the effective role holds the
required permission **and** the tenant has the required addon enabled. Do not
add a nav item manually in a page — extend the manifest and let it filter.

### `GET /api/portal/home`
Role-specific dashboard widgets + aggregate data. `data` may be
`{ degraded: true }` for a widget that failed — render the degraded state, do
not fail the page.

### `GET /api/portal/search?q=<term>`
Role- and relationship-scoped search, **min 2 chars** (shorter → empty result).
Projection is strictly `{ id, name, email, matricule }` for students/teachers and
`{ id, invoiceNumber, netAmount, status }` for invoices. Parent → linked
children only; student/alumni → self only; staff → capability-gated
(`students.read`/`teachers.read`/`finance.read`). Never extend the projection
without a privacy review.

### `GET /api/portal/activity?limit=<1..100>`
Recent portal activity for the current user (role switches etc.).

### `GET/PATCH /api/portal/preferences`
Tenant+user scoped preferences. Keys are allowlisted
(`locale`, `theme`, `navCollapsed`, `notificationsEnabled`); any other key →
**400 `INVALID_PREFERENCE_KEY`**. Do not invent new keys server-side without
adding them to `PORTAL_PREFERENCE_KEYS`.

### `POST /api/portal/role`
Server-validated active-role switch. Body `{ "role": "…", "branchId"?: "uuid|null" }`.
- Unknown role → 400; unassignable role or foreign `branchId` → generic **403**.
- Requires a session (`SESSION_REQUIRED` otherwise).
- On success returns a fresh `/api/portal/me`; audits the change and records a
  `role_switch` portal activity event.

### `DELETE /api/portal/role`
Resets the active role to the base role.

## 3. Capability + scope primitives

- `hasCapability(userId, tenantId, role, permission)` and
  `getEffectivePermissions(userId, tenantId, role)` — from `@/libs/api/permissions`.
- `requireRequestContext(request, allowedRoles?)` — builds the server-owned
  context and optionally enforces the effective role (403 if not allowed).
- `requireTenant(context)` / `requireTenantId(context)` — fail closed without a
  tenant (super_admin routes are the deliberate exception).
- `assertSelf(context, targetId)` — ownership.
- `assertBranchScope(context, branchId)` — cross-branch denial when a branch is
  active.

**Deny by default.** If a role/scope is not explicitly granted, the request is
403. "Hiding navigation is not authorization": a page guard and its API handler
must enforce the same effective access.

## 4. Building a new role portal

1. Add/confirm the role in `APP_ROLES` and its capabilities in `permissions.ts`.
2. Add the role's nav + widgets to `portal-manifest.ts` (`getPortalManifest`)
   and `HOME_WIDGETS` in `portal-home.ts`, gating any addon behind `hasAddon`.
3. Keep the widget contract pinned by the manifest/home agreement test in
   `src/app/api/portal/role-portals.test.ts`.
4. Every API route: build context with `requireRequestContext`, then filter
   every DB query by `context.tenantId` (and `context.branchId` where branch-
   scoped). Add an explicit tenant reference in the route so the static
   isolation check (`scripts/check-tenant-isolation.ts`) stays green.
5. Use `PortalStateView` for loading/empty/error/forbidden/offline/addon-
   unavailable states; dispatch `portal:role-changed` on any role switch and
   listen in client components to drop stale scoped data.
6. Sensitive fields (finance, HR/salary, medical, safeguarding, family,
   national-id) must never appear on a non-privileged projection.

## 5. Verification baseline for a downstream portal

Before merging any downstream portal, re-run:
1. `npx tsc --noEmit` (exit 0).
2. `npx vitest run src/app/api/portal/role-portals.test.ts src/app/api/portal/portal-security.test.ts` (41 tests).
3. `node scripts/verify-portal-foundation.mjs` (47/47, no leftover rows).
4. `npx tsx scripts/check-tenant-isolation.ts` (no new portal failures).
5. `npx next build`.
6. Confirm migrations `0083` and `0086` are applied and idempotent.

Then the §2 browser checks in `MANUAL-TESTING.md`.
