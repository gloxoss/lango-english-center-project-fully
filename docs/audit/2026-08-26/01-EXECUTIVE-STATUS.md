# Executive Status (2026-08-26)

## Where the application is today

SchoolOS is a large, genuinely substantial multi-tenant school management
platform — 342 pages, 788 API endpoints, 432 database tables, 138 migrations,
10 roles, 196 permissions, 1775 automated tests. This is not a prototype. The
core architectural decisions are sound and, in several places, better than
typical for this stage: the three-tier permission system (role default → tenant
override → user override, with both grants and revokes) is well designed, the
in-code reasoning about *why* specific permissions are withheld is unusually
disciplined, and there is a real runtime cross-tenant isolation test suite.

It is also not ready for unsupervised production use. The problems found are
not scattered bugs — they are two or three systemic patterns that keep
generating bugs.

**Overall status: `Partially functional`.**

Suitable for supervised partner testing (which is what it is currently deployed
for). Not suitable for real student, financial, or guardian data.

## What is verified working

- All 1772 executing automated tests pass with a database available.
- Server-side authentication resolves the principal from the session and
  re-validates against the database; disabled accounts and inactive tenants are
  correctly rejected.
- All 21 super-admin API routes enforce super-admin. No unguarded route found.
- `tenantId` is never accepted from client input outside super-admin routes.
- Every one of 318 dashboard pages carries a server-side guard.
- 42 API routes have passing runtime cross-tenant isolation tests.
- The full 138-migration chain now applies cleanly to an empty database
  (verified by execution during this audit).
- HTTPS, HSTS, X-Frame-Options, and X-Content-Type-Options are live on the
  deployed instance.

## What is unsafe or broken

Ranked by how much risk each carries:

1. **Page authorization has two competing sources of truth** (D-1, P1).
   226 of 295 guarded pages gate on hardcoded role lists while the navigation
   gates on capabilities. Nothing keeps them in sync. This pattern produced a
   batch of live access failures the same day and will keep producing them.

2. **Shared API endpoints leak privileged fields to lesser-privileged roles**
   (D-5, P1). Three confirmed financial-data leaks to `teacher` were found and
   fixed — all found by a human clicking around, not by review. ~780 routes have
   not been swept for the same shape.

3. **The tenant-isolation checker reports false confidence** (D-2, P1). It prints
   a green "all queries reference tenantId" but never scans `db.insert`, only
   checks token proximity rather than actual filtering, and skips three route
   trees entirely. No live exploit was found, but future regressions will pass
   unnoticed.

4. **The trilingual product is French-only** (D-6, P1). 0 of 354 feature
   components use the translation system; 51 translation keys exist total.
   `/ar` renders RTL-mirrored French. For the Moroccan market this is a
   product-level gap, not a polish item.

5. **The test suite cannot exit 0** (D-4, P2) and 75% of it is inert without a
   database (D-3, P2). Together these mean no trustworthy CI gate exists today.

6. **The production host is under-resourced** (D-9, P2). Deploying SchoolOS made
   a shared VPS running four other production apps completely unreachable,
   requiring an out-of-band reboot.

## What was fixed during the audit window

- **P0:** the migration chain was unrunnable on a clean database — 19 migrations
  were silently skipped and one was invalid. Any fresh deployment produced a
  structurally incomplete database. Repaired and verified by execution (D-7).
- **P1:** the production `.env` holding the DB password and auth secret was
  world-readable on a shared multi-tenant host (D-8).

## Roadmap

### Now — before real data touches the system

| Item | Outcome | Effort |
|---|---|---|
| Sweep shared endpoints for per-role field leaks (D-5) | Closes the highest-likelihood privacy class | **L** |
| Migrate 226 pages to `requiredCapability` (D-1) | Removes the defect generator | **L** |
| Fix the isolation checker (D-2) | Restores meaning to a security gate | **M** |
| Rotate VPS secrets (D-8 residual) | Removes any post-disclosure risk | **S** |

### Next — make quality measurable

| Item | Outcome | Effort |
|---|---|---|
| Fix vitest worker crash (D-4) | Enables a real CI gate | **M** |
| Make DB a hard CI precondition (D-3) | Stops 75% silent coverage loss | **S** |
| Expand runtime isolation tests beyond 42 routes | Real coverage of the top risk | **L** |
| Move SchoolOS off the shared VPS (D-9) | Stops risking other clients' uptime | **M** |

### Later — scope and polish

| Item | Outcome | Effort |
|---|---|---|
| i18n extraction across 354 components (D-6) | Makes AR/EN real | **XL** |
| Consolidate product truth into one dated document (C-1/C-5) | Makes future audits possible | **M** |
| Resolve brand, role scope, hosting/CNDP decisions | Unblocks several workstreams | **S** (decisions only) |
| Accessibility, responsive, and performance audit | Never performed | **L** |

## The honest caveat

This audit verified **structure and access control**. It did **not** verify that
the application *works*: no screen was opened, no workflow was executed, no
school-year lifecycle was run, no accessibility or responsive check was made.
A page having a correct guard says nothing about whether its feature functions.

Given that ~780 API routes and every user-facing workflow remain behaviourally
unverified, the realistic reading is that **more findings exist than were
found** — particularly in the "works end to end?" category, which is exactly
where partner feedback will land first.
