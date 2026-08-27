# Agent Wave 1 — Independent Verification Report

Audited: 2026-08-26 · Baseline commit `b0c9124` · 293 uncommitted files
Method: **verified against live code and executed commands**, not agent self-reports.

## Verdict

| Agent | Finding | Verdict |
|---|---|---|
| **Agent 1** | D-1 page-guard drift | **Substantially complete** — migration correct; regression test is hollow |
| **Agent 2** | D-5 API field leaks | **Quality good, coverage inadequate** — ~1.5% of surface; a leak found in 15 min |
| **Agent 3** | D-2 isolation checker | **Improved but gate left RED** |
| **Agent 3** | D-3 DB precondition | **Complete** ✅ |
| **Agent 3** | D-4 suite exit 0 | **Not achieved** — still exit 1, and destabilised security tests |

**Wave-level exit criteria: NOT met.** 3 of 5 tasks pass.

## Baseline facts (measured, not claimed)

```
npx tsc --noEmit                → exit 0  ✅
npm run test                    → exit 1  ❌  (D-4 target was exit 0)
  Test Files  1 failed | 123 passed (124)
  Tests       5 failed | 1781 passed (1786)
npx tsx scripts/check-tenant-isolation.ts → exit 1  ❌ (fails on clean tree)
```

Pass count **1781 vs 1772 baseline (+9)** — no regressions; the 9 are Agent 2's
new tests. Types are clean across 278 modified page files.

---

## Agent 1 — D-1 page-guard drift

### What is genuinely fixed ✅

| Metric | Before | After |
|---|---|---|
| Pages with `requiredCapability` | 69 | **272** |
| Pages on hardcoded roles only | 226 | **23** |

**203 pages migrated.** The 23 remaining are correct judgment, not omissions:
`parent/*`, `student/*`, `teacher/*`, `hostel/me`, `hostel/guardian`,
`transport/student`, `transport/guardian` (self-service portals, role-scoped by
nature) and `super-admin/*` (which holds `ALL_PERMISSIONS`, so a capability gate
would be meaningless).

**Capability choices verified correct** on the highest-risk pages:

| Page | Capability | Held by teacher/accountant? |
|---|---|---|
| `settings/users` | `users.manage` | No ✅ |
| `settings/permissions` | `users.permissions.manage` | No ✅ |
| `settings/security` | `settings.security.manage` | No ✅ |
| `hr/employees` | `hr.manage` | No ✅ |
| `settings/subscription` | `settings.organization.manage` | No ✅ |
| `finance/payments` | `finance.read` | accountant — correct ✅ |

No over-exposure introduced. This is the single largest and best-executed piece
of work in the wave.

### The real gap ❌ — the regression test does not test for drift

`src/libs/api/__tests__/nav-page-guard-parity.test.ts` **never imports
`portal-manifest.ts`**. Verified:

```
$ grep -n "portal-manifest\|FULL_NAVIGATION\|import" nav-page-guard-parity.test.ts
1:import { describe, expect, it } from 'vitest';
2:import fs from 'fs';
3:import path from 'path';
```

It asserts two things:
1. pages using `allowedRoles` *also* mention `requiredCapability`;
2. >95% of non-portal pages are capability-only.

Neither compares the page's capability to the nav's `permission`. **A page
declaring `requiredCapability: 'settings.read'` while nav declares
`permission: 'finance.read'` passes this test** — and that mismatch is precisely
the D-1 failure mode that sent teachers to dead links.

This is the same defect class as D-2: a check that appears to guard something it
does not. The migration is done; **the mechanism that stops it regressing is
not.**

---

## Agent 2 — D-5 API field leaks

### Fix quality: good ✅

5 files changed, and the reasoning is sound. Example — `cards/issued`:

```ts
// teacher/receptionist can issue cards but must not read the render
// snapshot (DOB/NID/blood group/guardian) or the token hash off the
// list — those are admin-only PII.
if (context.role === 'teacher' || context.role === 'receptionist') {
  const { renderDataSnapshot: _s, publicTokenHash: _t, ...safe } = doc;
  return safe;
}
```

The test is a **genuine integration test** — seeds real rows, mocks the session,
invokes real route handlers, asserts per-role shape, and confirms `school_admin`
keeps the full payload. Not hollow.

### Coverage: inadequate ❌

| Measure | Value |
|---|---|
| Multi-role `requireRequestContext` call sites | **334** |
| Files with role allowlists | 379 |
| Files Agent 2 modified | **5** |
| Routes covered by the new test | **2** |

The brief was to sweep the multi-role surface. ~1.5% was touched. A low fix count
would be a fine outcome *if* the rest had been reviewed and found clean — but
that claim is disproved below.

### 🔴 NEW FINDING — D-12: `/api/search` is unauthorised (P1, arguably P0)

Found by sampling untouched routes for ~15 minutes.

`src/app/api/search/route.ts:10` —
```ts
const context = await requireRequestContext(request);   // NO role allowlist
const tenantId = requireTenant(context);                // NO requireCapability
```

**Any authenticated user in the tenant** — student, parent, alumni, guard,
librarian, receptionist, teacher — can call it and receive:

| Returned | Source |
|---|---|
| Every student's name, email, matricule | `route.ts:29-48` |
| Every teacher's name, email, matricule | `route.ts:51-70` |
| **Invoice number, `netAmount`, `status`** | `route.ts:73-87` |

It is the global header search, reachable from every page. This is **worse than
the three leaks already fixed**, which at least gated on `students.read` /
`guardians.read`. Here a *student* can enumerate the whole school roster and read
other families' invoice amounts.

Under Law 09-08 this is a personal-data exposure, not a UI defect.

**That this was found in 15 minutes of sampling is the finding about coverage.**
The sweep did not happen at the depth the brief required.

---

## Agent 3 — D-2, D-3, D-4

### D-2 isolation checker — improved, but gate left RED ⚠️

**Genuinely better, and proven so.** I injected the exact blind spot D-2 named
(client-supplied `tenantId` in an `insert`, previously never scanned):

```
$ # injected: await db.insert(subjects).values({ tenantId: body.tenantId, ... })
$ npx tsx scripts/check-tenant-isolation.ts
CHECKER_EXIT=1
  - academics/subjects/route.ts:62 - tenantId bound from client input:
    "await db.insert(subjects).values({ tenantId: body.tenantId, name: body.name });"
```

It catches the real thing. The rewrite also documents its own limits honestly
("NOT verified: … that the tenantId reference is in the WHERE clause …"), which
directly corrects D-2's original sin of overclaiming.

**But the gate now fails on clean code:**

```
$ npx tsx scripts/check-tenant-isolation.ts     # unmodified tree
EXIT=1
  - guardian/me/children/[relationshipId]/overview/route.ts
    - self-scoped route must establish a request context
```

This is a **false positive**. The route authenticates on line 22 via
`requireParentContext(request)` — a feature-level guard wrapper. The checker only
recognises the literal `requireRequestContext|requireTenant|requireTenantId`.

Agent 3 evidently never ran the checker against the clean tree, despite the brief
requiring exactly that. A gate that cries wolf gets disabled — which would undo
the whole D-2 fix.

### D-3 DB precondition — complete ✅

`vitest.global-setup.ts` is exactly as specified: probes once, fails the run
immediately, documents the `ALLOW_DB_SKIP=1` escape hatch and that CI must not
set it. Confirmed live in the run output:

```
✅ Database reachable — DB-backed suites will run.
```

The 75% silent-skip failure mode is closed.

### D-4 suite exit 0 — not achieved ❌, and it made things worse

Agent 3 switched `pool: 'forks'` → `'threads'` at full parallelism.

```
npm run test → REAL_EXIT=1
Tests  5 failed | 1781 passed (1786)
```

All 5 failures are in the **cross-tenant isolation suite** — the most
security-critical tests in the codebase:

```
× GET /api/addons/reporting/reports/[key]/preview   6092ms
× GET /api/gate/credentials/verify                  5062ms
× GET /api/me/permissions                           5016ms
× GET /api/portal/manifest                          5005ms
× GET /api/portal/me                                5003ms

Error: Test timed out in 5000ms.
```

**These are timeouts, not assertion failures** — isolation logic is not broken.
But the suite still exits 1, so no CI gate can be built on it, which was the
entire point of D-4.

### Cross-agent interaction

Agent 2's `role-response-shape.test.ts` **passed 9/9 in isolation** but **failed
1 in the full parallel run**. Same signature as the 5 isolation timeouts.

Agent 3 raised concurrency; Agent 2 added DB-seeding integration tests. Together
they produce contention neither would alone. **The old failure (one worker crash)
has been traded for a new one (widespread timeout flakiness in security tests)** —
which is harder to diagnose and easier to normalise as "just flaky."

---

## Required rework

| # | Task | Owner | Effort |
|---|---|---|---|
| R1 | **Fix `/api/search`** — add capability gate; strip invoice data for non-finance roles (D-12) | Agent 2 | S |
| R2 | **Actually sweep** the 334 multi-role sites; report every route reviewed, not just fixed | Agent 2 | L |
| R3 | **Rewrite the parity test** to import `FULL_NAVIGATION` and assert page capability **equals** nav permission | Agent 1 | S |
| R4 | **Teach the checker feature-level guards** (`requireParentContext` et al.); get clean tree to exit 0 | Agent 3 | S |
| R5 | **Fix D-4 properly** — cap DB-suite concurrency or isolate DB fixtures per worker; `npm run test` must exit 0 **three consecutive runs** | Agent 3 | M |

R1 is the urgent one — an unauthorised endpoint exposing roster and invoice data
to every authenticated user, live in production at `schoolos.epioso.com`.

## What this wave proves about method

Every one of the three gaps — hollow parity test, unswept surface, red gate —
would have been reported as "done" on a self-report basis. All three were found
by running things: `grep` for an import, sampling untouched routes, executing the
checker on a clean tree.

The pattern is consistent with D-2 and D-3 in the original audit. **Assume a
check does not work until it has been seen to fail.**
