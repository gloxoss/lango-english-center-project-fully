# Branch scope everywhere (plan BRANCH-SCOPE-01)

Owner request (2026-09-25): "why does the branch logic only work on the dashboard? Make a full plan over all pages and modules so they all sync with the branch selector, with no problems."
Plan author: claude-finance. Executors: other agents (AGENT-PROMPT.md). Separate from the post-audit plan (`.ultraplan/PLAN.md`) and the student portal plan (`.ultraplan/student-portal/`).

## 1. Why it only works on the dashboard (measured 2026-09-25)

1. The header selector (from ENH-ADMIN-DASH-01, not merged yet) saves the choice **in the browser** (localStorage) and fires a browser event. Only the dashboard and the search listen. They send `?branchId=` to their own APIs.
2. Every other route takes its branch from the **server** context: `libs/api/context.ts` and `libs/auth/server-context.ts` both call `resolveActiveContext` in `features/portal/services/active-context.ts`, which **only accepts the user's own assigned branch** (`user.branch_id`). A client-sent branch is refused on purpose.
3. So `ctx.branchId` means two things at once: "the branch to filter by" **and** "this user is locked to it". The selector reads "locked" from the same value (`/api/settings/branches` returns `branchScope: ctx.branchId ? 'pinned' : 'all'`). Feeding a choice into it as-is would lock the admin in with no way back.
4. Most APIs never filter by branch at all:

| Measure (scan: `inventory/scan.mjs`, result: `inventory/routes-2026-09-25.json`) | Count |
|---|---|
| API routes | 836 |
| use the server branch (`ctx.branchId`) somewhere | 123 |
| only a `?branchId` filter | 29 |
| no branch logic at all | 503 |
| write routes (POST/PUT/PATCH/DELETE) with no branch logic | 346 |

5. Consequence already live: in the Atlas demo school, the accountant, receptionist, guard, librarian and all 20 teachers are assigned a branch. Yet on the ~68 finance routes with no branch logic, **the accountant sees both campuses**. So branch locking is half-enforced today, not only a selector problem.

Facts the plan relies on:
- 41 tables carry `branch_id` (classes, applicants, events, exam_halls, fee_structures, fee_allocation_runs, files, departments, employee_profiles, guard_* (8), hostels, inventory_stores, library_* (5), reception_appointments, reception_handoffs, report_runs, report_schedules, scanner_devices, setting_drafts, setting_values, communication_* (4), transport_* (4), leadership_scope_assignments, user).
- Invoices, payments, receipts, refunds, attendance, grades and homework have **no** branch column. They belong to a branch through the **student** (`user.branch_id`), which is what the dashboard already uses. Today the student's branch equals their class's branch for all 202 placed students.
- A server-side, per-session store already exists: `portal_active_contexts.active_branch_id`, with an upsert and a resolver. Nothing new is needed to store the choice.
- No server caching (`unstable_cache` / `use cache`) exists, so no cache can serve one branch's data to another.
- Existing scope helper: `assertBranchScope(ctx, resourceBranchId)` in `libs/api/portal-scope.ts` (used in 2 files). `scripts/check-tenant-isolation.ts` is the model for a new branch ratchet.

## 2. Target behaviour (one sentence per role)

- **Whole-school staff** (no `user.branch_id`, e.g. the director): the selector offers "Tous les sites" plus each active branch. The choice is stored **in their login session on the server**, and every staff page filters by it.
- **Locked staff** (`user.branch_id` set): always their branch. The selector shows a fixed pill. Nothing they send can widen it.
- **Parents, students, alumni**: never filtered by branch. Their access follows relationships and self-ownership.
- **Super-admin**: unchanged (platform level, no branch).
- **Single-branch schools** (e.g. Lango): no selector, no visible change, identical numbers before and after.

## 3. Owner decisions (defaults applied; the owner can overturn any)

| ID | Decision | Default |
|---|---|---|
| DB1 | A staff member's assigned branch is a **hard lock**. To give someone all-campus access, clear their branch. | Yes (this is today's code meaning) |
| DB2 | At multi-branch schools, rows with no branch show only under "Tous les sites", flagged "non affecté", and are hidden from locked staff. B2 reports them so the school can assign them. | Yes |
| DB3 | The legal entity stays whole-school: chart of accounts, journals, accounting periods, bank reconciliation, payroll **runs**. The branch only filters lists and reports, never splits the books or a payroll run. | Yes |
| DB4 | Creating a branch-owned record while "Tous les sites" is selected: the form requires choosing the campus. It is never guessed. | Yes |
| DB5 | Switching branch reloads the page (simple and always consistent). The dashboard keeps its live update. | Yes |
| DB6 | Branch detail access to another campus returns 403 (matches `assertBranchScope`). | Yes |

## 4. Invariants (every section must keep these)

1. The branch comes only from the server context. The browser never sends a branch that the server trusts. `?branchId=` becomes an optional **narrowing** filter validated against the context, never a widening one.
2. Tenant filter first, branch filter second: `eq(table.tenantId, ctx.tenantId)` stays in every query.
3. For every scoped list or total: sum over each branch + unassigned = "Tous les sites". Tested.
4. Single-branch tenants: every page returns the same data as before the change. Proven by the B0 baseline.
5. Reads, writes, exports (CSV/PDF), counts and dashboards use the **same** scope helper, so a list and its export can never disagree.

## 5. Route modes (the vocabulary for the whole plan)

| Mode | Meaning | Filter |
|---|---|---|
| `own` | The row has its own `branch_id` | `branchWhere(ctx, table.branchId)` |
| `student` | The row belongs to a student (finance, attendance, grades, homework, cards, documents) | join the student and use `branchWhere(ctx, user.branchId)` |
| `employee` | The row belongs to an employee (HR, leave, punches, advances, awards, payslip lists) | via `employee_profiles.branch_id` or the employee's `user.branch_id`; pick one per module and write it in the registry |
| `shared` | Tenant-wide configuration or legal books (subjects, years, fee types, chart of accounts, journals, periods, templates, roles, catalog) | none; the UI says "Commun à tous les sites" |
| `personal` | Self or relationship data (`student/me`, `guardian/me`, `employee/me`, `teacher/me`, `portal/*`, `auth`, `me`, `notifications`, `*/me`) | none |
| `platform` | `super-admin`, `public`, `health`, `webhooks`, `tenant`, `platform`, `waitlist`, `support` | none |

## 6. Sections

```
B0 prerequisite ─► B1 foundation ─► B2 data readiness ─┐
                                   B3 registry+ratchet ┴─► B4 waves W1..W6 (parallel) ─► B5 UI ─► B6 verification gate
```

---

### B0: Prerequisite and baseline (owner / claude-finance)

<task id="B0-01">
  <name>Land the base</name>
  <action>ENH-ADMIN-DASH-01 (commits cdf0dcc9, 4c9632a8, 8115a73f, f1db14e8), the attendance integration and the post-audit branches are merged by claude-finance (post-audit plan S13). Do not start B1 before that merge is on the working branch.</action>
  <verify>`git log` on the working branch shows those commits; `npm run check:types` is 0 errors.</verify>
</task>

<task id="B0-02">
  <name>Capture a before-baseline</name>
  <files>.ultraplan/branch-scope/evidence/baseline-before.json</files>
  <action>With a read-only script, record the key totals as seen today: students, classes, applicants, invoices (count + sum), payments (sum), attendance marks this month, employees, library copies, hostel beds, transport routes. Record them for Lango (single branch), for Atlas "all", and for each Atlas branch where a branch column exists. This file is the proof for invariant 4.</action>
  <verify>The file exists with the numbers and the SQL used.</verify>
</task>

### B1: Foundation (red: auth and context)

<task id="B1-01">
  <name>Separate "chosen" from "locked" in the context</name>
  <files>lango-app/src/features/portal/services/active-context.ts, lango-app/src/libs/api/context.ts, lango-app/src/libs/auth/server-context.ts</files>
  <action>
    - `RequestContext` / server context get `branchLocked: boolean` = `principal.branchId !== null` for staff roles.
    - In `resolveActiveContext`: keep today's rule for locked users (only their own branch). For a staff principal with no branch (roles: school_admin, accountant, receptionist, librarian, guard, teacher, hr roles), accept a stored `activeBranchId` when it is an **active** branch of the same tenant. Otherwise drop it (existing self-heal update).
    - Parent, student and alumni roles: `branchId` is always null in the context (their pin never filters them).
    - Super-admin: unchanged.
  </action>
  <verify>Unit/DB tests on schoolos_audit: a locked user storing another branch → context keeps their own; a whole-school admin storing branch X of their tenant → context.branchId = X, branchLocked=false; a branch of another tenant → dropped; an inactive branch → dropped; a parent with user.branch_id set → context.branchId null.</verify>
</task>

<task id="B1-02">
  <name>Set the branch on the server</name>
  <files>lango-app/src/app/api/portal/branch/route.ts (new)</files>
  <action>POST `{ branchId: uuid | null }` (zod strict). Locked users get 403 unless it equals their own branch. Store it with the existing `persistActiveRole(sessionId, principal, currentActiveRole, branchId)` from `active-context.ts` (already used by `/api/portal/role`), keeping the current active role unchanged. Write an audit entry. Return `{ branchId, locked }`. No GET needed: `/api/settings/branches` already lists the branches. Change its `branchScope` to read `ctx.branchLocked` instead of `ctx.branchId`.</action>
  <verify>Route tests for all the cases in B1-01, through the route.</verify>
</task>

<task id="B1-03">
  <name>Two helpers, nothing more</name>
  <files>lango-app/src/libs/api/portal-scope.ts</files>
  <action>
    Add `branchWhere(ctx, column)`: returns `eq(column, ctx.branchId)` when a branch is active, else `undefined` (drizzle's `and()` ignores undefined).
    Add `assertWritableBranch(ctx, branchId)`: the branch must be an active branch of ctx.tenantId, and must equal ctx.branchId when `branchLocked`.
    Keep `assertBranchScope` as is. Each helper gets one small test.
  </action>
  <verify>Helper tests pass.</verify>
</task>

<task id="B1-04">
  <name>Selector uses the server</name>
  <files>lango-app/src/components/shared/header-campus-switcher.tsx, lango-app/src/features/dashboard/ui/dashboard-view.tsx, lango-app/src/app/api/dashboard/summary/route.ts, lango-app/src/features/portal/services/portal-search.ts</files>
  <action>
    - The switcher POSTs to `/api/portal/branch`, then reloads (DB5). On the dashboard it keeps the live refresh.
    - Remove the localStorage key and the `?branchId=` plumbing from the dashboard summary and search: they read `ctx.branchId` like everything else.
  </action>
  <verify>Existing dashboard/search tests updated and passing; a manual check (switch to Maarif, open /dashboard/students) is recorded in the section's done note.</verify>
</task>

### B2: Data readiness (red: migration on real data)

<task id="B2-01">
  <name>Backfill single-branch tenants</name>
  <files>lango-app/migrations/NNNN_branch_backfill_single.sql (next free number), lango-app/migrations/meta/_journal.json</files>
  <action>For every tenant with exactly one active branch: set `branch_id` = that branch where it is NULL, on the 41 branch tables and on `user` rows with staff/student roles. Tenants with 0 or 2+ branches are not touched. Idempotent (`WHERE branch_id IS NULL`). No trigger bypass: if a guarded table refuses, stop and report.</action>
  <verify>Migration applies on schoolos_audit; running it twice changes nothing; a Lango total from B0-02 is unchanged.</verify>
</task>

<task id="B2-02">
  <name>Report what multi-branch schools still need to assign</name>
  <files>lango-app/scripts/check-branch-data.ts (new), package.json script `check:branch-data`</files>
  <action>Read-only. For each tenant with 2+ branches: NULL `branch_id` counts per table, and the number of students whose branch differs from their class's branch. Exit 0 always; print a table. The owner runs it on the VPS before deploy to decide DB2 cases.</action>
  <verify>Output for dev shows Atlas numbers; mismatches = 0 today.</verify>
</task>

### B3: Registry and ratchet (yellow: 836 routes to classify)

<task id="B3-01">
  <name>One registry of route modes</name>
  <files>lango-app/src/libs/api/branch-scope-registry.ts (new)</files>
  <action>A plain object: route path → mode (section 5). Prefill it by script from `inventory/routes-2026-09-25.json`, using the module and the tables each route touches. Every `own`/`student`/`employee` entry also names its filter column. Mark uncertain ones `// review`. Post the counts per mode in the hub for the owner.</action>
  <verify>All 836 routes present (script compares with the filesystem).</verify>
</task>

<task id="B3-02">
  <name>Ratchet: no route left behind</name>
  <files>lango-app/scripts/check-branch-scope.ts (new), lango-app/scripts/branch-scope-baseline.json (new), package.json script `check:branch-scope`</files>
  <action>Fail when: a route exists that is not in the registry; or an `own`/`student`/`employee` route (including the services it imports, as `inventory/scan.mjs` does) uses neither `branchWhere` nor `assertBranchScope`/`assertWritableBranch` and is not in the baseline. The baseline starts with every pending route and may only shrink. Same style as `check-tenant-isolation.ts`.</action>
  <verify>Passes on the baseline; fails when you add a fake scoped route without the helper.</verify>
</task>

### B4: Module waves (parallel after B1–B3; one agent per wave, one hub item per wave)

Each wave does, for every route of its modules that the registry marks `own`/`student`/`employee`:
- lists, counts, totals and exports: add `branchWhere`;
- detail reads and updates/deletes: load the row, then `assertBranchScope`;
- creates: `assertWritableBranch` on the branch in the body; default it to `ctx.branchId`; require it when none is chosen (DB4);
- remove the route from `branch-scope-baseline.json`.

Every wave ships tests on schoolos_audit with the same 4 cases: locked user sees only their branch; whole-school user with a chosen branch sees only it; "Tous les sites" sees all; the parity sum holds (invariant 3). Plus one write case: a locked user cannot create into another branch.

| Wave | Modules (API folders) | Mode | Risk |
|---|---|---|---|
| W1 | students (directory, admissions, transfers, promotions, photos, matricules, parents list), academics structure (classes, sections, rooms, timetable), attendance | student / own | red |
| W2 | finance: invoices, payments, receipts, refunds, credit notes, statements, reminders, fines, fee allocations, fee structures, cashier sessions, collection desk. Accounting books stay `shared` (DB3) | student / own | red |
| W3 | assessment and academics results: exam terms/halls/schedules, marksheets, grades, report cards, homework, online exams, live classrooms, cards, certificates, documents | student / own | yellow |
| W4 | hr, workforce, payroll lists, employee documents, leave, advances, awards | employee | yellow |
| W5 | add-ons with their own branch column: library, hostel, transport, inventory, guard, reception, broadcast, events, scanner devices | own | yellow |
| W6 | reporting, leadership, analytics, exports, dashboard, search, settings values (`setting_values.branch_id`) | mixed | yellow |

A route that does not fit its registry mode: change the registry with a one-line reason and tell the hub. Never skip it silently.

### B5: UI (yellow)

<task id="B5-01">
  <name>Say what the selector means on each page</name>
  <files>lango-app/src/libs/api/branch-page-modes.ts (new: page path prefix → mode, derived from the registry of each page's main API), lango-app/src/components/shared/header-campus-switcher.tsx</files>
  <action>On `shared` pages the selector shows a small "Commun à tous les sites" pill instead of the dropdown. On `personal` pages it is hidden. Locked users always see the fixed pill.</action>
  <verify>Screens: one scoped, one shared and one personal page, as the director and as the accountant.</verify>
</task>

<task id="B5-02">
  <name>Campus field on create forms</name>
  <files>the create forms of `own` entities touched in W1–W6 (listed by each wave in its done note)</files>
  <action>Prefilled with the chosen branch; required when "Tous les sites" is chosen (DB4); fixed for locked users. Reuse one small select component. Do not build a new one if the settings branch list component can be reused.</action>
  <verify>Create a class under "Tous les sites" without a campus: refused with a clear message.</verify>
</task>

<task id="B5-03">
  <name>Text</name>
  <files>lango-app/locales/fr.json, en.json, ar.json</files>
  <action>Keys for the new labels only (CRLF files: match \r?\n, check for nested or duplicate namespaces afterwards).</action>
  <verify>`npm run check:i18n:keys` 0 missing.</verify>
</task>

### B6: Verification gate (red: nothing ships without it)

<task id="B6-01">
  <name>Parity and no-regression script</name>
  <files>lango-app/scripts/check-branch-parity.ts (new)</files>
  <action>Recompute the B0 totals: for each multi-branch tenant, per branch + unassigned = all (invariant 3); for single-branch tenants, all = the B0 baseline (invariant 4). Exit 1 on any difference.</action>
  <verify>Exit 0 on dev and schoolos_audit.</verify>
</task>

<task id="B6-02">
  <name>Screen sweep as four users</name>
  <files>.ultraplan/branch-scope/evidence/sweep/</files>
  <action>Run `lango-app/scripts/visual-sweep.mjs` over every dashboard page as: Atlas director on "Tous les sites"; Atlas director on Annexe Maarif; the Atlas accountant (locked to Siège); the Lango admin. Log per page: HTTP status, the scope label shown, and whether its numbers match the parity script. Any page that 500s, shows another branch's data, or changes Lango's numbers blocks the release.</action>
  <verify>A sweep table with 0 blocking rows; `npm run check:branch-scope` passes with an empty baseline; check:types, check:isolation and the full unit suite pass.</verify>
</task>

## 7. Deploy notes (for the owner / claude-finance)

- Run `npm run check:branch-data` against the VPS database **before** deploying. Rows with no branch at a multi-branch school are hidden from locked staff (DB2), so they must be assigned first.
- The B2-01 migration only touches single-branch tenants. The deploy script runs migrations only with `-WithMigrate`.
- Roll back = redeploy the previous image. The migration only fills NULLs, so the old code still works on the new data.

## 8. Out of scope

Staff assigned to several branches (needs a new table; ask when a school needs it). Splitting accounting or payroll by branch. Per-branch permissions beyond the lock. Branch in audit-log metadata (add when someone needs to filter logs by branch).
