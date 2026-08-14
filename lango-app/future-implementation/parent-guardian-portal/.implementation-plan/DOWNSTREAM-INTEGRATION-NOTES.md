# Parent / Guardian Portal — Downstream Integration Notes

> Required by `role-portals-accounting-workforce-wave.md`. This file documents
> how the Parent Portal conforms to the Role Portals Foundation's published
> downstream contract, the remaining coordination gaps, and what this workstream
> provides **without** modifying Foundation-owned authorization primitives.

## 1. Contract status

The Foundation's downstream integration contract **is published** at the repo
root: `DOWNSTREAM-INTEGRATION-CONTRACT.md`. It covers the server-owned context
model, the `/api/portal/*` surface, capability/scope primitives, "Building a new
role portal" (§4), and a verification baseline (§5).

The Parent Portal builds **against this contract as published**. This resolves
the earlier dependency in the wave plan ("do not treat the active-role/branch
contract as finalized until the Foundation agent publishes the corrected
downstream contract") — the contract now exists and this workstream conforms to
it.

## 2. Verified Foundation state the Parent Portal relies on (direct code read)

The Foundation implementation in the current tree already satisfies the
contract's §1 claims:

- `resolveActiveContext` re-binds the stored context to the authenticated user
  (`row.userId !== principal.id` → forged/stale row deleted) — **verified in
  `src/features/portal/services/active-context.ts`**.
- `activeBranchId` is revalidated against `principal.branchId` and tenant-owned
  branch rows before being returned — verified.
- Role assignability is re-checked on every read (`isRoleAssignable`); a revoked
  guardian link degrades the session to the base role with no cache to fall back
  to — verified.
- `getServerUserContext` + `requireServerPage` mirror the API-context guarantees
  for server components — verified in `src/libs/auth/server-context.ts` and
  `src/libs/api/page-guard.ts`.

**Consequence:** the Parent Portal does NOT need the Foundation to change the
active-role/branch behavior. It consumes it as-is.

## 3. Coordination gaps this workstream documents (NOT fixed in Foundation code)

Per the wave rule *"Do not modify Foundation-owned authorization primitives to
work around missing behavior. Document the required contract and coordinate
integration"*:

**Gap 1 — Relationship authorization has no effective-state/rights model.**
`hasGuardianIdentity`, `isGuardianOfStudent`, `portal-home.parentHome` and
`portal-search` authorize any `guardians.userId → guardian_students.studentId`
row. They ignore relationship `status`, `effective_from`/`effective_to`,
per-relationship rights (`academic`, `attendance`, `finance`, `pickup`,
`medical`, `communication`), custody restrictions, and financial responsibility.

**Gap 2 — The portal manifest has no parent navigation.**
`portal-manifest.ts` `FULL_NAVIGATION` contains no "Espace Parent" group, so a
`parent` effective role gets near-empty navigation. **Closed via the sidebar's
role-gated self-service section** (`src/components/shared/sidebar.tsx`
`selfServiceNavItems`, the same pattern already used for the parent's
hostel/live-class links) — not by adding a manifest group, because a
permission-free manifest group would leak the portal to every role.

**Gap 3 — The `parent` role's default capabilities are read-only and not
self-service-specific.**
Parent defaults: `students.read, attendance.read, grading.read, finance.read,
communication.read, events.read, live.join`. There is no distinct
guardian-self-service capability key, and `guardians.read`/`guardians.manage`
are deliberately withheld from the parent role.

**How the Parent Portal closes these gaps without touching Foundation code:**

- **New feature-local resolver** `src/features/parent/services/relationship-resolver.ts`
  enforces effective state + rights + custody + financial responsibility. Every
  `/api/guardian/**` route goes through it. The Foundation primitives remain the
  coarse "is linked" check; the Parent Portal adds the precise "is effectively
  authorized" check on top.
- **Own permissions** are added to `src/libs/api/permissions.ts` only if a
  distinct key is actually needed (e.g. `guardian.selfservice.access`); the
  parent defaults are otherwise sufficient because the portal is identity- and
  relationship-gated rather than capability-gated.
- **Own nav group** is added to `portal-manifest.ts` `FULL_NAVIGATION`
  (permission-gated, e.g. on the parent role), following the contract's §4 rule
  that a nav item is included only when the effective role holds the permission.

**Coordination request to the Foundation owner:** when the Foundation next
audits relationship authz, consider whether `isGuardianOfStudent` should also
accept an effective-state predicate. This workstream does NOT block on it — the
feature-local resolver is the enforcement point and is kept in sync.

## 4. Contracts the Parent Portal expects from the Foundation

1. `GET /api/portal/me` returns `role='parent'` (effective), `baseRole`,
   `availableRoles` incl. `parent`, and granted permission keys — consumed to
   drive the parent shell.
2. `GET /api/portal/manifest` returns the parent nav group once added; a parent
   role sees only its own group + addon-gated items.
3. `POST /api/portal/role` / `DELETE /api/portal/role` continue to be the only
   way the effective role changes; the Parent Portal never writes
   `portal_active_contexts`.
4. `GET /api/portal/home` `parentHome` widget data is consumed for the household
   home; it may be superseded by `/api/guardian/me/home` (relationship-scoped).
5. `resolveActiveContext` continues to drop stale contexts on revocation so that
   "revocation without relogin" holds for parent data (relies on the verified
   behavior in §2).

## 5. What the Parent Portal provides (feature-local)

- `guardian_students` lifecycle/rights columns via migration `0088`
  (`0088_parent_guardian_portal`); the parent request inbox via migration `0105`
  (`0105_parent_requests`, feature-local `src/features/parent/models/parent-schema.ts`).
- `relationship-resolver.ts` — the single authorization gate.
- `/api/guardian/**` — relationship-scoped projections for home, children,
  overview, results, homework, attendance, excuses, finance, announcements,
  meetings, requests, documents, consents, preferences.
- Guardian self-service account link flow (hashed one-time token; no password
  exposure).
- Narrow addon adapters reusing existing link-gated surfaces (transport,
  hostel, meetings, live-class) with `requireAddon` degradation.
- `src/features/parent/**` UI in FR + Arabic/RTL, mobile-first, WCAG 2.2 AA.

## 6. Explicit non-changes (preservation)

| Foundation-owned file | Change made by Parent Portal |
|---|---|
| `src/features/portal/services/active-context.ts` | **none** |
| `src/libs/api/portal-scope.ts` | **none** (uses `requireTenantId`, `assertBranchScope`, `denyUnless` as consumers) |
| `src/features/portal/services/portal-home.ts` | coordinate-only; any change is proposed to the owner, applied conservatively |
| `src/features/portal/services/portal-search.ts` | none (already link-scoped for parent) |
| `src/app/api/portal/*` | none |
| `migrations/0083_role_portals_foundation.sql` | none |
| `scripts/verify-portal-foundation.mjs` | none (must stay 40/40) |

## 7. Release gate linkage

Before merge, the §5 baseline in the contract is re-run: `npx tsc --noEmit`,
`npx vitest run .../role-portals.test.ts .../portal-security.test.ts`,
`node scripts/verify-portal-foundation.mjs`, `npx tsx scripts/check-tenant-isolation.ts`,
`npx next build` — plus the Parent Portal's own §5 gates in `PLAN.md`.
