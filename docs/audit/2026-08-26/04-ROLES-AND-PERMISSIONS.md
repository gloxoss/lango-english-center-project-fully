# Roles, Permissions, and Access Enforcement (2026-08-26)

## 1. The role model — contradiction resolved

The audit prompt asserts v1 has four roles (`super_admin`, `school_admin`,
`teacher`, `accountant`) and that "parent, student, receptionist, guard" are
**not** v1 login roles.

**That assertion is false against the current codebase.** Verified:

- `src/libs/api/context.ts:9` — `APP_ROLES` contains **10** roles.
- `src/models/Schema.ts:28` — the Postgres `role` enum contains the **same 10**.

```
super_admin, school_admin, teacher, accountant, student,
alumni, parent, receptionist, guard, librarian
```

Code and database agree exactly — no drift between them.

Further, all 10 are *login-capable*: each has a working credential account in
the seeded demo tenant, and dedicated portal surfaces exist for
`student`, `parent`, `teacher`, `guard`, `receptionist`, `librarian`, and
`alumni` (`src/app/[locale]/(dashboard)/dashboard/{student,parent,teacher,portals/*,receptionist}`).

**Per the user's instruction at audit start, the 10-role model is treated as
current product truth and the prompt's 4-role claim as stale.**

## 2. Permission system architecture

| Element | Location | Notes |
|---|---|---|
| Permission catalogue | `src/libs/api/permissions.ts` | 196 keys, `module.action` format |
| Role defaults | `DEFAULT_ROLE_PERMISSIONS` | Static per-role grants |
| Tenant overrides | `rolePermissions` table | Per-tenant, per-role, grant **or revoke** |
| User overrides | `userPermissionOverrides` table | Most specific; grant or revoke |
| Resolution order | user override → tenant role override → hardcoded default | `hasCapability()` |
| API guard | `requireCapability(context, key)` | Throws 403 |
| Page guard | `requireServerPage(locale, opts)` | Redirects |

`super_admin` short-circuits to `true` for every permission (`permissions.ts:441`).

This is a genuinely well-designed capability system — three-tier resolution with
both additive and subtractive overrides is more sophisticated than most products
at this stage.

## 3. Verified enforcement controls (positive findings)

| Control | Verified? | Evidence |
|---|---|---|
| Session/principal resolved server-side, never from client | Yes | `getServerUserContext()` reads better-auth session then re-queries `user` table |
| Disabled accounts blocked | Yes | `server-context.ts:49` — `eq(user.userStatus, 'active')` in the principal query |
| Inactive tenants blocked | Yes | `server-context.ts:55` — non-super_admin with `!tenantActive` returns null |
| All 21 super-admin API routes enforce super-admin | Yes | 17 via `requireSuperAdmin`, 4 via `requireRequestContext(req,['super_admin'])`; zero unguarded |
| `tenantId` never accepted from client (except super-admin) | Yes | Only `super-admin/entitlements` and `super-admin/sms` accept `tenantId` in a Zod schema, and both enforce super-admin first |
| Dashboard pages carry a server guard | Yes | 295/318 use `requireServerPage`; the other 23 use module wrappers that delegate to it |
| Module guard wrappers are not weaker | Yes | `requireLibraryPage` calls `requireServerPage` **and** adds `requireAddon` |

### A false positive I initially recorded, then disproved

An early pass flagged "23 dashboard pages with no server guard" as a potential
P0. Direct inspection disproved it: those pages use module-specific wrappers
(`requireLibraryPage`, `requireLeadershipPage`, `requireTransportPage`) which
delegate to `requireServerPage` and *add* addon-entitlement checks. Recorded
here because the prompt requires findings be reproducible — this one was not.

## 4. Structural weakness: guard-style fragmentation

Page authorization is expressed in **two incompatible styles**:

| Style | Count | Risk |
|---|---|---|
| `requiredCapability` (capability-driven) | 69 pages | Tracks the permission system; cannot drift from nav |
| `allowedRoles` hardcoded list | 226 pages | Independent of the permission system; **drifts silently** |

The nav/sidebar (`src/libs/api/portal-manifest.ts`) decides visibility purely by
**capability**. So for the 226 `allowedRoles` pages, "can I see the link" and
"can I open the page" are computed from two different sources that nothing keeps
in sync.

This is not theoretical. On 2026-08-26 (same day, pre-audit) this exact drift
produced a batch of live user-visible defects: teacher and accountant saw nav
links to Students, Guardians, Attendance, Academics and Transport pages that
immediately redirected them home. Each was fixed individually by converting the
page to `requiredCapability`. **226 pages remain on the drift-prone pattern.**

Severity: **P1** (D-1). It is a defect *generator*, not a single defect.

## 5. Financial-data isolation between roles

Two real cross-role data leaks were found and fixed the same day (pre-audit),
both of the same shape — a shared API returning finance fields to a role without
`finance.read`:

| Route | Leak | Fix |
|---|---|---|
| `GET /api/students?id=` | Returned `payments[]` + `balanceDue` to `teacher` | Role-conditional field stripping |
| `GET /api/academics/classes/roster` | Returned per-student `balanceDue` to `teacher` | `canSeeFinance` gate; returns `null` |
| `GET /api/students/parents/[id]/payments` | Gated on `guardians.read` (teacher has it) | Re-gated to `finance.read` |

**The pattern matters more than the instances.** These are shared endpoints whose
response shape was designed for the most-privileged caller, then reused by
lesser-privileged roles. The audit did **not** sweep the remaining 788 routes for
the same shape. Recorded as D-5.

## 6. Intended vs. actual RBAC matrix

The prompt requires both matrices. The **intended** matrix cannot be produced:
no product-truth document defining intended per-role permissions exists in the
repository (see `13-DECISIONS-CONTRADICTIONS-OPEN-QUESTIONS.md`).

The **actual** matrix is fully specified in code at
`src/libs/api/permissions.ts:296-421` (`DEFAULT_ROLE_PERMISSIONS`) and is
reproduced there rather than duplicated here, since any copy would immediately
drift. Summary of default grants:

| Role | Default permissions | Character |
|---|---|---|
| `super_admin` | All 196 | Platform operator |
| `school_admin` | All 196 | Tenant owner |
| `teacher` | ~22 | Students read, attendance, grading, live classes, own events |
| `accountant` | ~22 | Finance + accounting + payroll **review only**; explicitly no `hr.manage` |
| `receptionist` | ~25 | Front desk; deliberately excludes admissions conversion & bulk messaging |
| `guard` | 8 | Gate/visitor/incident only; deliberately excludes `students.read` |
| `librarian` | 6 | Circulation ops; excludes catalog.manage, policy, waive |
| `parent` | 7 | Own child's data via shared endpoints |
| `student` | 6 | Own data |
| `alumni` | 0 | Self-scoped by `role` + `userId` only, by design |

The in-code comments documenting *why* certain permissions are withheld
(e.g. guard excluding `students.read` to avoid dead sidebar links; accountant
excluding `hr.manage` for scope discipline) are unusually good practice and
should be preserved.

## 7. Not verified

- **No runtime role-by-role testing was performed.** Every conclusion above is
  from static analysis of source. The prompt's three-level test (nav visibility /
  direct route access / direct API invocation) was **not** executed as live tests.
- **No IDOR probing.** No object IDs were manipulated against a running server.
- **No cross-tenant runtime attack testing** beyond the existing 42-route
  automated suite (which passed).
- **No session expiry / logout / password-reset / account-disabled runtime testing.**
