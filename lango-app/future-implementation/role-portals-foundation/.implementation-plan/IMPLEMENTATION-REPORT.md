# Role Portals Foundation — Implementation Report

Date: 2026-08-08 · Scope: shared portal foundation for every role portal
(Parent, Receptionist, Accountant, Workforce, Librarian, Guard, Alumni) built
on the existing auth + capability model. No business feature was shipped in
this change — the foundation is the plumbing those portals consume.

## 1. What was implemented

### 1.1 Server-owned active-role context
- `user.role` stays the authoritative **base role**. An *effective* role is
  stored server-side in `portal_active_contexts` keyed by the Better-Auth
  session id — **never** in browser storage, cookies, query params or client
  state.
- `requireRequestContext` (in `src/libs/api/context.ts`) now resolves the
  active role on every request, re-validating it: a stored role that is no
  longer assignable (e.g. a revoked guardian link) is dropped and the session
  degrades to the base role.
- New `src/features/portal/services/active-context.ts`:
  `isRoleAssignable`, `listAvailableRoles`, `resolveActiveContext`,
  `persistActiveRole`, `clearActiveContext`, `hasGuardianIdentity`. The only
  derived role today is `parent` (from a live `guardians`→`guardian_students`
  identity). `super_admin` can never switch into another role.

**Post-audit hardening (2026-08-08):**
- **User binding (P0).** `resolveActiveContext` now selects and compares the
  stored `user_id` against the authenticated user on every read. A row whose
  `user_id`, tenant, or role does not match the session's principal is refused
  and dropped — a tampered/foreign row can never be honored, only fallen back
  to the base role.
- **Authoritative branch revalidation (P1).** A stored `active_branch_id` is
  honored only when it equals `user.branchId` **and** still resolves to a
  branch owned by the tenant; otherwise it is cleared in place on read. The
  branch in `RequestContext`/`ServerUserContext` is now derived solely from
  the revalidated context or `user.branchId` — client-supplied `x-branch-id` /
  `?branchId=` headers are never honored (with no multi-assignment table,
  `user.branchId` is the only branch a principal may reference, so any other
  value is a forgery by definition). This closes the previously circular
  branch validation.
- **Effective guardian state (P1).** `hasGuardianIdentity` requires the linked
  student row to be `active`; a guardian of a deactivated child loses the
  derived `parent` role. (The model has no soft-revoke/effective-date fields on
  the relationship, so `user.userStatus` is the strongest enforceable binding.)
- **Referential integrity (P1).** Migration `0086` adds `ON DELETE CASCADE`
  FKs from the portal tables to `"user"` and `"session"` (orphans purged first)
  so a deleted session or user can never strand a context row (see §2).
- `RequestContext` and `ServerUserContext` both expose `baseRole` so `/me` and
  `/role` can compute the true available-role set after a switch.

### 1.2 Capability + scope authorization (deny by default)
- Existing `hasCapability` / `getEffectivePermissions` remain the capability
  source. New `src/libs/api/portal-scope.ts` primitives
  (`requireTenantId`, `assertSelf`, `assertBranchScope`, `denyUnless`) fail
  closed.
- The same effective access is enforced in page guards (`requireRequestContext`
  with `allowedRoles`) and API handlers — "hiding navigation is not
  authorization."
- Cross-tenant `x-tenant-id` mismatch → 403; cross-branch role switches → 403.

### 1.3 Shared portal APIs (server-derived, role/scope-filtered)
All under `/api/portal/*`, all session-required (anonymous → 401), all return
`{ success, data }`:
- `GET /me` — actor + tenant + effective role + baseRole + availableRoles +
  granted permission keys.
- `GET /manifest` — server-filtered navigation, quick actions, home widgets,
  baseRole, availableRoles.
- `GET /home` — role-specific dashboard widgets; per-widget `{degraded:true}`
  on failure instead of a hard error.
- `GET /search?q=` — role- and relationship-scoped, min 2 chars. Projection
  strictly `{id,name,email,matricule}` / `{id,invoiceNumber,netAmount,status}`.
  Parent → linked children only; student/alumni → self only; staff →
  capability-gated.
- `GET /activity` — recent portal activity for the current user.
- `GET|PATCH /preferences` — allowlisted keys only
  (`locale, theme, navCollapsed, notificationsEnabled`); unknown key → 400
  `INVALID_PREFERENCE_KEY`.
- `POST|DELETE /role` — server-validated switch / reset. Forged or unassigned
  target → generic 403; foreign `branchId` → 403; audits every change and
  records a `role_switch` activity event.

### 1.4 Server-owned PortalManifest
- `src/libs/api/portal-manifest.ts` now filters nav by capability **and**
  addon (`hasAddon`), and includes `baseRole`/`availableRoles`. The widget
  contract is pinned by the manifest/home agreement test in
  `role-portals.test.ts` for all ten roles.

### 1.5 Shared portal shell
- `src/components/shared/portal-role-switcher.tsx` — native `<select>`, only
  visible when `availableRoles.length > 1`; on change does a server round-trip
  then dispatches `portal:role-changed` and refreshes.
- `src/components/shared/portal-state.tsx` — one degraded-state view
  (loading/empty/error/offline/forbidden/addon-unavailable).
- `sidebar.tsx` — manifest-driven nav for non-admin roles, admin nav preserved,
  role badge, role switcher in the footer, role-changed listener.
- `header.tsx` — `/api/portal/search` with a role-changed listener that drops
  stale scoped results, and the effective-role badge from `/api/portal/me`.
- Dashboard `layout.tsx` — skip-link, `dir` set from locale (rtl for `ar`),
  focusable `#main-content`.

### 1.6 Security & privacy hardening
- `src/app/api/portal/portal-security.test.ts` — 25 adversarial unit tests
  (role assignability, stale/cross-tenant context refusal, **cross-user context
  refusal**, **stale-branch clear on read**, fail-closed scope primitives,
  search relationship/self scoping, projection redaction, pref-key allowlist).
  Runs with clean stderr (the auth `trustedOrigins` init is mocked).
- Field redaction confirmed in tests and live (no finance/HR/medical/
  safeguarding/family/national-id fields on non-privileged projections).
- Stale context rows are deleted, and role switches are audited
  (`permission_change` on `portal_active_contexts`) plus recorded as portal
  activity.
- Context rows are bound to the authenticated user and to a real session/user
  row (§1.1, migration `0086`); the live verifier proves a tampered `user_id`
  degrades the session and drops the row, and a tampered `active_branch_id` is
  cleared.

## 2. Migration

`migrations/0083_role_portals_foundation.sql` (hand-written, never
`drizzle-kit generate`; journal `idx 84`). Tables: `portal_active_contexts`,
`portal_preferences`, `portal_activity_events` — all tenant-scoped with cascade
FKs, `IF NOT EXISTS` / `duplicate_object` guards. **Re-run against the live DB:
11 statements, 0 failures** (idempotency verified).

`migrations/0086_role_portals_referential_integrity.sql` (hand-written, journal
`idx 87`, assigned after the concurrent agent claimed `0085_office_accounting`).
Purges existing orphans (rows whose `user_id`/`session_id` point at nothing),
then adds `ON DELETE CASCADE` FKs:
`portal_active_contexts.{user_id, session_id}` → `"user"` / `"session"`, and
`portal_preferences.user_id`, `portal_activity_events.user_id` → `"user"`.
**Applied and re-run against the live DB: 0 failed statements, 0 failure on
rerun; all 7 portal FKs present** (idempotency verified).

## 3. Verification results

| # | Check | Command | Result | Evidence |
|---|-------|---------|--------|----------|
| 1 | TypeScript | `npx tsc --noEmit` | Foundation clean | 0 errors in any foundation file; remaining errors are other agents' in-flight files |
| 2 | Focused auth unit suites | `npx vitest run src/app/api/portal/role-portals.test.ts src/app/api/portal/portal-security.test.ts` | ✅ 41/41 | 2 files passed; clean stderr (domains-service mocked) |
| 3 | Tenant-isolation static | `npx tsx scripts/check-tenant-isolation.ts` | Portal clean | no portal route flagged; 4 `src/app/api/guard/*` + `src/app/api/guardian/me/children/*` remain (concurrent guard/guardian workstreams) |
| 4 | Live authenticated HTTP matrix | `node scripts/verify-portal-foundation.mjs` | ✅ 47/47 | anonymous 401s; disposable school_admin context; manifest/home; search projection; forged switch 403; cross-tenant 403; unassigned-branch switch 403; derived student→parent switch 200; stale degrade on revoke; pref allowlist; **P0 tampered user_id → degrade + row dropped; P1 tampered active_branch_id → cleared on read**; zero leftover rows |
| 5 | Production build | `npx next build` | Compiles; type-check gate blocked | "✓ Compiled successfully in 3.4min"; the `Running TypeScript` step fails **only** on a concurrent guardian-portal file (`src/app/api/guardian/me/home/route.ts`) — transport files are clean again |
| 6 | Migration idempotency | re-run `0083` + `0086` SQL | ✅ 0 failed statements | tables present; all 7 portal FKs present |
| 7 | Browser / UI checks | §2 of `MANUAL-TESTING.md` | **PENDING** | requires a human or browser-automation agent; see below |

## 4. Honest status separation

**Automated checks completed (repeatable):** items 1–4 and 6 above.

**Browser checks pending (not claimed):** role badge rendering, role-switcher
visibility + server round-trip in the UI, search redaction in a real browser,
cross-tenant/branch via devtools, RTL + keyboard + mobile navigation, and
degraded-network/error states. These are listed step-by-step in
`MANUAL-TESTING.md` §2 and are the remaining human/browser gate. They are
**not** covered by the automated suites and are **not** claimed as done.

**Unrelated concurrent failures (not caused by this feature):**
- `src/app/api/guardian/me/home/route.ts` — guardian-portal workstream; the sole
  remaining `npx tsc --noEmit` error (a `EffectiveChild | undefined` narrowing
  issue in that agent's file). It blocks the global `npx next build` type-check
  gate.
- `src/app/api/guard/kiosk-sessions/[id]/{close,lock}/route.ts`,
  `src/app/api/guard/me/{gate,shift}/route.ts` and
  `src/app/api/guardian/me/children/[relationshipId]/route.ts` — guard/guardian
  workstreams; these fail the tenant-isolation static check.
- These are in-flight files owned by other agents; per the shared-file protocol
  they were left untouched. Until they are resolved, `npx tsc --noEmit` and
  `npx next build` will not exit 0 overall.

## 5. Files changed / added (this feature)

**Modified**
- `src/libs/api/context.ts` — `baseRole`, exported `isAppRole`, active-role resolution, **authoritative-only branch derivation** (client branch header/query never honored)
- `src/libs/auth/server-context.ts` — `baseRole`, `branchId` passed to context resolution
- `src/app/api/portal/role/route.ts` — **`branchId` on the persisted principal** (branch equality now vs the authoritative `context.branchId`)
- `src/libs/api/portal-manifest.ts` — addon gating, availableRoles, baseRole, HOME_WIDGETS
- `src/components/shared/sidebar.tsx`, `header.tsx` — manifest nav, role badge, role-changed listener, portal search
- `src/app/[locale]/(dashboard)/layout.tsx` — skip-link, RTL dir, focusable main
- `src/app/api/portal/manifest/route.ts` — baseRole + availableRoles
- `src/app/api/portal/{search,me}/route.ts` — tenant guard / invariant comment
- Test fixtures + `baseRole` in: `role-portals.test.ts`, `tenant-isolation-comprehensive.test.ts`, `test-ssrf.test.ts`, `setting-value-concurrency.test.ts`, `migration-readiness-page.tsx`

**Added**
- `src/features/portal/services/{active-context,portal-me,portal-home,portal-search,portal-activity,portal-preferences}.ts` — `active-context.ts` carries the P0/P1 hardening
- `src/app/api/portal/{me,home,search,activity,preferences,role}/route.ts`
- `src/components/shared/{portal-role-switcher,portal-state}.tsx`
- `src/app/api/portal/portal-security.test.ts` (25 tests incl. cross-user binding + stale-branch)
- `migrations/0083_role_portals_foundation.sql`, `migrations/0086_role_portals_referential_integrity.sql`
- `scripts/verify-portal-foundation.mjs` (47 live checks, disposable fixtures, P0/P1 tamper paths)
- `MANUAL-TESTING.md`, `DOWNSTREAM-INTEGRATION-CONTRACT.md` (this report)

## 6. Unresolved risks

1. **Derived roles beyond `parent`** are not implemented yet — `availableRoles`
   is base role + `parent`. Adding e.g. a receptionist-cum-guard role requires
   a new identity join and an `isRoleAssignable` branch (and a test).
2. **Single active context per session** — a user switching role mid-session
   shares one `portal_active_contexts` row; concurrent tabs see the last switch.
3. **Browser gate pending** (§4) — RTL/keyboard/mobile and degraded-state
   rendering are unverified in a real browser.
4. **Search result counts are capped** (`.limit(5)` per entity) — acceptable for
   a header search, but a dedicated search page would need pagination.
5. **`next build` overall gate** is blocked by unrelated concurrent files (§4).
6. **Client-supplied branch headers are no longer honored** — a behavioral
   tightening (§1.1). Safe today because `user.branchId` is the only branch any
   principal may reference; revisit only when a multi-branch-assignment model
   (a staff↔branch join table) exists, at which point branch resolution must be
   extended with an authoritative assignments lookup.
7. **The P1 branch-clear path** is covered by unit tests and the live verifier;
   the "branch no longer exists in the tenant" variant is unit-tested but not
   exercised live (no branch row was deleted mid-run).

## 7. Contract

The stable surface for downstream portal agents is
`DOWNSTREAM-INTEGRATION-CONTRACT.md`. The human acceptance checklist is
`MANUAL-TESTING.md`.

> The plan listed a separate `verify-portal-adversarial.mjs`. It was
> consolidated into `verify-portal-foundation.mjs` (§4 sections and §7 stale
> degradation are the adversarial paths) so the throwaway-user DB setup is not
> duplicated across two scripts. The single script is the repeatable live
> verifier.
