# SchoolOS — Audit Findings & Remediation Plan (2026-08-13)

Consolidated output of: 4 parallel Playwright audit agents (super-admin/school-admin core, finance/HR/payroll, self-service portals, addon modules + public site) plus direct findings from the orchestrating session. Written so any agent can pick up a numbered item and execute it standalone.

**Standing conventions for every fix below** (already established this session, don't reinvent):
- Route pattern: `requireRequestContext(req, [roles])` → `requireTenant(context)` → `requireCapability` → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` on mutations → `apiErrorResponse()` catch-all.
- Page guard pattern: `import { requireServerPage } from '@/libs/api/page-guard'` → `await requireServerPage(locale, { allowedRoles: [...], requiredCapability?: '...' })` as the first line of the page component body. Reference files already correct: `src/app/[locale]/(dashboard)/dashboard/teacher/page.tsx`, `.../super-admin/page.tsx`, `.../homework/page.tsx`.
- Migrations: hand-written SQL only, idempotent `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$;`, re-read `migrations/meta/_journal.json` FRESH immediately before picking a number (concurrent-agent collisions have happened this session), append the journal entry yourself.
- Verify with `npx tsc --noEmit` (must be clean) and a real `npx next build` (must exit 0) before calling anything done. `next.config.ts` needs `turbopack: { root: path.join(__dirname) }` for the build to succeed at all on this machine/path — don't touch or remove that line.

---

## Part 0 — Do this first, before anything else

The app was being served by a **3-day-stale Docker image** (built Aug 10, just restarted not rebuilt) during all 4 audits below. A rebuild (`docker compose build app`) is done; the restart (`docker compose up -d migrate app`) is still pending — it was blocked by a permission prompt and needs to run before any of today's fixes (or the findings below) can be trusted against the live app. **Run this first, then re-smoke-test the items marked "RE-VERIFY AFTER REBUILD" below before trusting them.**

---

## Part 1 — The big one: systemic missing page-level role guards

**214 of 308 dashboard pages (`src/app/[locale]/(dashboard)/dashboard/**/page.tsx`) have zero server-side role gate.** Confirmed via `grep -L "requireServerPage\|requireLibraryPage\|requireLeadershipPage"` across every `page.tsx` under that tree. `src/middleware.ts` does not check roles either (tenant/hostname resolution only) — so for these 214 pages, the *only* thing standing between an unauthorized role and the page is whatever the underlying API routes enforce.

**Two already-confirmed exploitable cases from this gap, both fixed tonight:**
- `super-admin/*` (11 pages) + `portals/guard/*` (7 pages) — rendered fully for any logged-in role. Fixed.
- `homework/page.tsx` + `homework/submissions/page.tsx` — a **student** saw the full teacher grading UI, including other real students' submitted files, real grades, and a working "publish grades" button (write endpoint was properly capability-gated server-side, so this was a read-side leak, not a write exploit — still serious). Fixed.

**Why most of the other 212 didn't leak in testing**: the audit agents mostly found correct, role-scoped data on the pages they hit, meaning the *API layer* (`requireCapability`/`requireRequestContext` inside each route) is carrying the real security weight for most of these — and it mostly works. But it's not guaranteed per-page, and homework proves it can have gaps. **Do not assume "no page guard" == "no protection" — verify each page's actual API dependency before deciding it needs a guard, an API fix, or both.**

### Execution plan

**Step 1 — Inventory (one agent, ~30 min).** Re-run this exact command and diff against the list below to catch any drift from other concurrent work:
```bash
for f in $(find "src/app/[locale]/(dashboard)/dashboard" -name "page.tsx"); do
  grep -qL "requireServerPage\|requireLibraryPage\|requireLeadershipPage" "$f" 2>/dev/null || \
  grep -q "requireServerPage\|requireLibraryPage\|requireLeadershipPage" "$f" || echo "$f"
done
```
(Simplify to `grep -L` over the file list; the two-pass form above is defensive against `grep -L` semantics differing by shell — test it once and use whichever actually returns the un-guarded set.)

**Step 2 — Batch by module, one agent per batch, in parallel.** Use the role→page mapping already compiled in `edu.docs/FULL-APP-MANUAL-AUDIT-WORKFLOW.md` §2 to assign the correct `allowedRoles` per page — don't guess role ownership from the URL alone, cross-check against that doc and against sibling pages in the same directory that might already be correctly guarded (e.g., if `finance/invoices/page.tsx` is unguarded but the finance module is understood to be `accountant + school_admin`, use that).

Suggested batches (roughly balanced, ~25-30 pages each):
1. `academics/**` (34 pages)
2. `attendance/**`, `students/**` (8 + 20 pages)
3. `finance/**` (22 pages)
4. `hr/**`, `hostel/**` (13 + 16 pages)
5. `inventory/**`, `transport/**` (13 + 13 pages)
6. `cards/**`, `certificates/**` (8 + 13 pages)
7. `broadcast/**`, `communication/**` (7 + 12 pages)
8. `settings/**` (remaining ~20 unguarded ones), `reports/**`, `content/**`, `documents/**`, `library/**`

**Step 3 — Per page, each agent must:**
1. Open the page and identify which API route(s) its view component actually calls (grep the `'use client'` component for `fetch(`).
2. Open those API routes and confirm they call `requireCapability`/role-check correctly. **If an API route is ALSO missing proper role/capability enforcement (not just relying on `requireTenant`), fix that first** — the homework leak happened because a data-fetching endpoint wasn't properly scoped, not just because the page lacked a guard. A page guard alone doesn't fix a broken API.
3. Add the page guard with the correct `allowedRoles` (and `requiredCapability` if the sibling pattern for that module uses one — check a working sibling like `receptionist/page.tsx` or `portals/librarian/page.tsx` first).
4. Do not touch view components or layouts — page-component-only fix, matching the established pattern.

**Step 4 — Verification per batch:** `npx tsc --noEmit` clean, then a manual smoke test (or Playwright) logging in as (a) the correct role — confirm the page still works, and (b) one wrong role — confirm redirect, not render. Do NOT all run `npx next build` concurrently — pick one agent to own the final build check after all batches land, or you'll get the exact `.next` directory collision that happened tonight (empty build log, apparent random failures).

**Step 5 — Final full-app build + tsc check**, one agent, sequential, after every batch reports done.

---

## Part 2 — Other confirmed real bugs (independent of Part 1, fix in any order)

| # | Finding | Where | Fix |
|---|---|---|---|
| 1 | `finance/collection-desk` "Encaisser le paiement" is **fully hardcoded mock UI** — the success banner, receipt list, and receipt preview are static JSX, not wired to any API. Looks like a working cash-collection feature; isn't. | `src/features/finance/ui/payment-entry-view.tsx` lines 35-39, 99, 386 | Wire to the real `/api/finance/payments` POST endpoint (already exists and is used correctly elsewhere, e.g. `finance/payments/new`) — reuse that pattern rather than inventing a new one. |
| 2 | RSC prefetch 404 loop to a nonexistent `/dashboard/guardians` route, fires repeatedly on nearly every finance page (and others) for multiple roles. | Some shared nav/sidebar component links to `/dashboard/guardians`, which doesn't exist (`students/parents` is the real route). | Find the stale link (grep for `dashboard/guardians` across `src/components/shared/`, `src/libs/api/portal-manifest.ts`) and repoint it to `students/parents`, or remove it if dead. |
| 3 | `transport/student` (student role) hard-crashes: `TypeError: Cannot read properties of undefined (reading 'length')`. | Client component under `src/features/transport/` — find via the crash's error boundary / stack. | Null-guard the array access; likely an API response shape mismatch (empty/undefined array not handled). |
| 4 | `transport/allocations` crashes: `Cannot read properties of undefined (reading 'toLowerCase')`. `library/catalog` crashes: `x.reduce is not a function`. | Respective client views. | Same class as #3 — null/shape guards on data that can legitimately be empty. |
| 5 | `transport/guardian`: `POST /api/transport/self-service/guardian` returns 500. `hostel/guardian`: `GET /api/addons/hostel/guardian/me` returns 404 (route may not exist). | `src/app/api/transport/self-service/guardian/route.ts`, hostel guardian API. | Investigate server logs for the 500's real cause; confirm whether the hostel guardian route was ever built (may be a genuine gap, not a regression — check `future-implementation/hostel-management/`). |
| 6 | `hostel/reports` (500 on `GET /api/addons/hostel/reports/allocations?state=all`), `transport/drivers` (500 on `GET /api/transport/drivers`), `documents/generator` (500 on `GET /api/students/report-card?studentId=...`, fires on page load). | Respective API routes. | Each needs its own server-log investigation — these are 3 independent 500s, not one root cause. |
| 7 | Entire `broadcast/*` module returns 403 for Atlas school_admin (UI degrades gracefully with a retry button, not a crash). Likely an addon-entitlement gap for that tenant rather than a code bug. | `addon_entitlements` table / `requireAddon` check for `broadcast-messaging`. | Confirm whether Atlas is supposed to have this addon entitled; if yes, grant it; if the registry says it should be default-on, check why entitlement wasn't seeded. |
| 8 | `hr/self-service` redirects logged-in `school_admin` to the public marketing homepage instead of rendering or showing access-denied. | `src/app/[locale]/(dashboard)/dashboard/hr/self-service/page.tsx` | Investigate the redirect condition — likely falls through an unhandled case in its guard logic. |
| 9 | React hydration error (`Minified React error #418`) on `finance/online-payments`, `finance/approvals`, `finance/journal`, `finance/accounting/periods`, `dashboard/accountant`. Pages still render correctly. | Respective client components. | Server/client markup mismatch — likely a `Date`/locale-formatted value or conditional rendering that differs between SSR and client hydration. Decode the real error via `NODE_ENV=development` locally (minified error codes need the dev build to get the real message). |
| 10 | `/api/settings/branches` returns 403 for the accountant role on every finance page (cosmetic today — header falls back to a default label), but it's a real authorization gap on that endpoint. | `src/app/api/settings/branches/route.ts` | Decide: should accountant be able to read branch names (read-only, for display)? If yes, extend its capability; if intentional, leave as-is and remove the header's attempt to call it for this role. |
| 11 | `workforce` hub page fires 8 failed prefetch requests (404s missing the `/workforce` segment) even though the visible links themselves work correctly. | `src/app/[locale]/(dashboard)/dashboard/workforce/page.tsx` or its nav config | Find the malformed link/prefetch source generating `href`s without the `/workforce` prefix. |
| 12 | Guard portal soft-blocks wrong roles with an in-page "no permissions" banner (all-zero widgets, 403'd APIs) instead of the hard redirect used by receptionist/librarian for the same scenario. Not a data leak (verified empty), just inconsistent. | `src/features/guard/ui/guard-home-view.tsx` (or wherever the soft block lives) | Low priority — align with the redirect pattern for consistency, or leave as an acceptable alternate pattern; your call. |
| 13 | Docker logs show recurring `EACCES: permission denied, mkdir '/app/.next/cache'` — breaks Next.js image-optimization caching inside the container. | `Dockerfile` / container filesystem permissions for the `nextjs` user | Fix the `uploads`/`cache` directory ownership in the Dockerfile's runner stage (same pattern already used for `/app/uploads`, extend to `.next/cache`). |
| 14 | Possible IP-based (not session-based) rate limiting on `/api/auth/*` — a login attempt got a "Too many requests" banner while a *different* login was running concurrently from the same machine/IP. Could affect a school office with several staff on one network. | Rate-limit config for `/api/auth/*` (Better Auth or a wrapping middleware) | Investigate whether the limiter keys on IP or session/account; if IP, consider a higher threshold or per-account keying. |
| 15 | Settings rollback branch-scoping test failure (`setting-value-concurrency.test.ts`, describe block "POST /api/settings/values/[key] rollback scoping (P1-5)", test "a version that exists in the request scope rolls back correctly") — root-caused but not fixed. | `src/app/api/settings/values/[key]/route.ts` line ~114 area, `src/libs/settings/setting-value-concurrency.test.ts` | The route derives `context.branchId` from the authenticated user's own DB row, not from the request's `branchId` query param the test sets — by design (never trust client-supplied scope for security). The test's `beforeAll` never assigns the admin user a `branchId`, so the "should succeed" case can never resolve correctly through the HTTP route as currently written. Fix is in the **test fixture**, not the route: either give the admin user a real `branchId` before the branch-scoped assertions, or call `setSettingValue` directly (service-layer, like the earlier tests in the same file do via the `ctx()` helper) instead of going through the HTTP route for this specific case. Verify the route's design intent (session-derived branch, not client-supplied) is correct before touching anything — it looks like the right security posture, just not what this one test's fixture accounts for. |

---

## Part 3 — RE-VERIFY AFTER REBUILD (do not trust these as confirmed bugs yet)

These were found against the stale 3-day-old build and may already be fixed by today's work, or may be entirely different once the container is serving current code:

- **Public school website returns 404 on every single URL** (`/fr/atlas`, `/fr/atlas/about`, etc.) — the school-website-cms addon was built and verified working *today*, after the container's last real build. Almost certainly a staleness artifact, not a real bug — re-test after rebuild before investigating further.
- **`settings/website/*` admin pages (4 pages) return 404** — same likely explanation.
- Any other finding above that touches code built or changed today (event-management routes, live-classrooms pages) should be spot-checked again post-rebuild even though none were explicitly flagged broken.

---

## Part 4 — Verified safe, no action needed

- `migrations/0117_retire_dead_online_exam_addon.sql` (drops 5 unused tables from the dead `OnlineExamService`) — independently verified: all 5 tables currently empty except one confirmed-throwaway row, the live `online_exam_attempts` table (different physical table, same name collision) was correctly left untouched. Safe, no revert needed.
- Cross-tenant isolation: every audit agent's spot-checks (finance, core academics, addons) found zero cross-tenant leakage. IDOR/tampering probes on finance invoice/payment IDs were correctly rejected server-side.
- `hostel/finance-adapter.ts` naming-series `ON CONFLICT` bug (found and fixed earlier tonight, unrelated to the 4 audits) — confirmed fixed, test passes.
