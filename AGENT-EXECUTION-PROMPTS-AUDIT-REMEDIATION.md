# Agent Execution Prompts — Audit Remediation (2026-08-26)

Source: `docs/audit/2026-08-26/11-DEFECT-AND-RISK-REGISTER.md`
Baseline commit: `b0c9124`

## Partition strategy — read before dispatching

Three agents run **in parallel**. The partition is by **file tree**, so no two
agents write the same file:

| Agent | Owns (exclusive write access) | Finding |
|---|---|---|
| **Agent 1** | `src/app/[locale]/(dashboard)/**/page.tsx`, `src/libs/api/page-guard.ts`, `src/libs/api/portal-manifest.ts`, `src/features/*/ui/page-guard.ts` | D-1 |
| **Agent 2** | `src/app/api/**/route.ts`, `src/features/*/services/**` | D-5 |
| **Agent 3** | `scripts/`, `vitest.config.ts`, `.github/`, `package.json` scripts block | D-2, D-3, D-4 |

**Hard rule for all three:** if your fix requires editing a file owned by
another agent, **do not edit it**. Write the required change into your final
report as a `HANDOFF:` line naming the exact file, line, and change. A human
merges those afterward. This prevents the parallel-write corruption that
silently loses work.

**Deferred to a later wave (do NOT dispatch now):**
- **D-6 (i18n, 0/354 components)** — XL, and it touches every component file,
  which would collide with Agents 1 and 2. Run alone, after this wave lands.
- **D-9 (VPS under-resourced)** and **D-8 residual (rotate secrets)** — infrastructure
  and credential operations. Not agent work; requires the owner.
- The five product decisions in `13-DECISIONS-CONTRADICTIONS-OPEN-QUESTIONS.md`
  — no agent can resolve these.

## Standing rules for every agent

1. **Verify, never assume.** A green check, a passing build, or a page rendering
   is not proof. Before reporting anything "done", prove it by running something
   that would fail if you were wrong. This codebase has already produced one
   false-confidence security check (D-2) and one green-looking-but-skipping test
   suite (D-3) — do not add a third.
2. **Report honestly.** If a task is partially done, say which part. If you could
   not verify something, say so explicitly. Do not round up.
3. Run `npx tsc --noEmit` before finishing. It must exit 0.
4. Run `npm run test` with Postgres **up** (`docker start schoolos-db`). Note:
   the suite currently exits 1 due to a worker crash (D-4) — that is pre-existing
   and is Agent 3's job. What matters for Agents 1 & 2: **0 assertion failures**,
   and the pass count must not drop below the 1772 baseline.
5. Do not reformat, refactor, or "improve" code outside your assigned change.
6. Every changed line must trace to your assigned finding.

## Codebase conventions (all agents)

**API route shape:**
```ts
requireRequestContext(req, [roles])   // authn + role allowlist
  → requireTenant(context)            // tenant from SESSION, never client input
  → requireCapability(context, 'x.y') // fine-grained permission
  → Zod .strict() validation
  → tenant-scoped Drizzle query
  → recordAudit()
  → apiErrorResponse() on throw
```

**Page guard — the target pattern:**
```ts
await requireServerPage(locale, { requiredCapability: 'students.read' });
```

Roles (10, in `src/libs/api/context.ts:9`): `super_admin`, `school_admin`,
`teacher`, `accountant`, `student`, `alumni`, `parent`, `receptionist`,
`guard`, `librarian`.

Permissions (196): `src/libs/api/permissions.ts`. Role defaults are in
`DEFAULT_ROLE_PERMISSIONS` (line ~296).

---

# AGENT 1 — Eliminate page-guard drift (D-1, P1)

## The problem

Page authorization is expressed two incompatible ways:

- **69 pages** gate on `requiredCapability` — tracks the permission system.
- **226 pages** gate on a hardcoded `allowedRoles: [...]` array — does **not**.

The sidebar (`src/libs/api/portal-manifest.ts`) computes visibility purely from
**capability**. So for those 226 pages, "can I see the link" and "can I open the
page" come from two sources nothing keeps in sync. On 2026-08-26 this produced a
batch of live failures: teacher and accountant saw nav links to Students,
Guardians, Attendance, Academics and Transport that immediately redirected home.

You are removing the defect *generator*, not individual defects.

## Enumerate your work

```bash
cd lango-app
D='src/app/[locale]/(dashboard)'
# the 226 pages needing migration:
for f in $(grep -rl "requireServerPage" "$D" --include="page.tsx"); do
  grep -q "requiredCapability" "$f" || echo "$f"
done
```

## Your task

For each of the 226 pages, replace the hardcoded role list with the capability
the navigation already uses for that route.

**Method — do this per page, do not batch blindly:**

1. Find the page's route (e.g. `/dashboard/students/promotions`).
2. Find the matching nav entry in `portal-manifest.ts` and read its `permission`.
3. Set that same key as `requiredCapability` on the page.
4. **If no nav entry exists** for that route (deep/detail pages like
   `students/[id]`, `finance/invoices/[id]`), use the capability of its **parent
   section**, and add a one-line comment saying which parent it inherited from.
5. Delete the now-redundant `allowedRoles` **only when** the capability fully
   expresses the intent. Keep both where a page is legitimately role-restricted
   beyond capability (e.g. self-service portals like `/dashboard/teacher`,
   `/dashboard/student`, `/dashboard/parent` which are role-scoped by nature,
   not capability-scoped). `page-guard.ts` supports either or both.

**Critical judgment call — do not get this wrong.** Before opening a page to a
broader set of roles, check what the page actually *does*:

- If it is a **read-only browsing view** → use the `.read` capability.
- If it is a **CRUD console** with create/edit/delete controls → use `.manage`.

Getting this backwards shows a role live-looking buttons that 403. This already
happened once: the Classes page looked read-only from its outer wrapper file but
`classes-client.tsx` had inline homeroom-teacher/substitute/room dropdowns wired
to PUT/DELETE. **Always read the actual client component, not just the page
wrapper.**

## Also fix

The 4 module-specific guard wrappers duplicate `requireServerPage` logic:
`src/features/{library,leadership,transport}/ui/page-guard.ts` (+ any others).
They are **not** broken — they correctly delegate and add addon checks. Leave
their behaviour alone. Just make sure any page you migrate that uses one of them
passes `capability`/`requiredCapability` through rather than roles alone.

## Verification (required — a diff is not proof)

1. `npx tsc --noEmit` → exit 0.
2. Write **one new test file** (you own it):
   `src/libs/api/__tests__/nav-page-guard-parity.test.ts`
   For every nav item in `FULL_NAVIGATION` that has a `permission`, assert that
   the corresponding page file gates on that same capability. This is the
   regression test that stops D-1 returning. It must fail if someone adds a new
   `allowedRoles`-only page for a nav-visible route.
3. Run the suite; 0 assertion failures, pass count ≥ 1772.
4. Spot-check by hand: start the app, log in as `prof.01@atlas.ma` /
   `Admin123!`, and confirm every sidebar link opens rather than redirecting.
   Repeat for `accountant@atlas.ma`. **Report what you actually clicked.**

## Report

- Count migrated, count intentionally left with `allowedRoles` (and why).
- Any page where you could not determine the right capability — list it, do not guess.
- `HANDOFF:` lines for anything needing an API change (Agent 2's tree).

---

# AGENT 2 — Sweep shared endpoints for per-role field leaks (D-5, P1)

## The problem

Endpoints were designed around `school_admin`'s response shape, then opened to
narrower roles by adding the role to the allowlist — **without trimming the
payload**. Authorization was applied at the route level, never at the field level.

Three confirmed leaks were found and fixed on 2026-08-26 — **all three found by a
human clicking around, not by review**:

| Route | Leaked to | Field |
|---|---|---|
| `GET /api/students?id=` | `teacher` | `payments[]`, `balanceDue` |
| `GET /api/academics/classes/roster` | `teacher` | per-student `balanceDue` |
| `GET /api/students/parents/[id]/payments` | `teacher` (via `guardians.read`) | full household payment history |

**~780 routes have never been checked.** That is your job.

## Enumerate your work

Priority order — start with the highest-risk set:

```bash
cd lango-app
# routes whose allowlist has MORE THAN ONE role = the risk surface
grep -rn "requireRequestContext(request, \[" src/app/api --include="route.ts" \
  | grep -E "\[.*,.*\]"
```

A single-role route cannot leak *across* roles, so deprioritise those.

## Your task

For each multi-role route, for **each role** in its allowlist, ask:

1. What does this endpoint return?
2. Does every returned field fall inside what that role is permitted to see?

Check field categories against the role's capabilities in
`DEFAULT_ROLE_PERMISSIONS`:

| Field category | Gate |
|---|---|
| payments, invoices, balances, amounts, salary | `finance.read` |
| grades, assessments, averages | `grading.read` |
| attendance records | `attendance.read` |
| medical, blood group, national ID, address | sensitive PII — admin-only |
| guardian contact details | `guardians.read` |
| HR/payroll figures | `hr.read` / `payroll.sensitive.read` |

**Fix pattern** — follow the one already established in
`src/app/api/students/route.ts` (read it first):

```ts
if (context.role === 'teacher') {
  const { payments: _p, balanceDue: _b, ...safe } = detail;
  return NextResponse.json({ success: true, data: safe });
}
```

For routes with several roles, prefer an explicit per-role projection over a
chain of `if`s.

## Critical: stripping a field can crash the UI

When you remove a field, the client may consume it unconditionally. This exact
bug shipped on 2026-08-26: `student.payments.reduce(...)` produced a white-screen
`Cannot read properties of undefined` for `teacher` after the API correctly
stripped `payments`.

So for **every** field you strip:
1. `grep` the codebase for consumers of that field.
2. Make the type optional (`payments?: Payment[]`).
3. Guard the consumer (`(student.payments ?? [])`) and give it an honest empty
   state (the codebase uses e.g. *"Données financières non disponibles pour ce rôle."*).

The UI files are **not** in your tree if they are page files — but
`src/features/*/ui/*.tsx` view components **are** shared. Coordinate: if the file
is a `page.tsx`, emit a `HANDOFF:`; if it is a feature view component, you may
edit it, but state clearly in your report that you did.

## Verification (required)

1. `npx tsc --noEmit` → exit 0.
2. Write per-role response-shape tests (you own these):
   `src/app/api/__tests__/role-response-shape.test.ts`
   For each route you fixed, assert the response for the narrower role does
   **not** contain the privileged keys, and that the admin response still does.
3. Run the suite; 0 assertion failures, pass count ≥ 1772.
4. Manually exercise at least the 3 known-fixed routes as `teacher` to confirm
   no regression and no crash.

## Report

- Routes reviewed / routes fixed / routes found already-correct.
- **Every leak found, with route, role, and field** — this is the deliverable
  that matters most.
- Any route you could not assess and why.
- `HANDOFF:` lines for page-file changes.

---

# AGENT 3 — Restore trustworthy test & security tooling (D-2, D-3, D-4)

You own tooling only. **Do not change product code.** If a tooling fix reveals a
product bug, report it — do not fix it.

## Task 3A — Fix the tenant-isolation checker (D-2, P1)

`scripts/check-tenant-isolation.ts` prints
`✅ All API queries reference tenantId` and exits 0. It does not establish that.
Verified blind spots:

1. **`db.insert` is never scanned** — line 62 matches only `select|update|delete`.
   An insert writing a client-supplied `tenantId` passes silently.
2. It only checks the *token* `tenantId` appears within a ~50-line lookback —
   not that the query is filtered by it, nor that it came from the session.
3. Three route trees allowlisted with zero checking: `super-admin`, `auth`,
   `waitlist` (lines 6–10).
4. Five more bypass via `SELF_SCOPED` (lines 15–21).

**Fix:**
- Extend scanning to `db.insert` / `tx.insert`.
- Assert the tenant value is bound from `requireTenant(...)`/session context, not
  from `body`/`searchParams`/`params`. (A targeted heuristic is acceptable if
  documented; full dataflow analysis is not expected.)
- Narrow `ALLOWLIST`: `super-admin` legitimately crosses tenants, but it should
  still be asserted to call `requireSuperAdmin` or
  `requireRequestContext(req, ['super_admin'])`. Currently 21/21 do — encode that
  as a check so it stays true.
- Make the success message state precisely what was verified. No more blanket
  "all queries" claims.

**Verify:** deliberately introduce a violation of each class (insert with
`tenantId: body.tenantId`; a select missing tenant scoping), confirm the checker
**fails**, then revert. A checker that has never been seen to fail is not a
checker. Report the exact violations you injected.

## Task 3B — Stop 75% silent coverage loss (D-3, P2)

With Postgres down: `1332 of 1775 tests skip` (75%), including the entire
cross-tenant isolation suite, the security regression suite, and financial
arithmetic tests.

**Fix:** make database availability an explicit **hard precondition** rather than
a per-test skip. Preferred: a global setup that probes the DB once and **fails
the run immediately** with a clear message if unreachable, instead of letting
1332 tests quietly no-op.

Keep the `describe.skipIf(!dbReachable)` pattern working for genuine local
convenience if you wish, but it must be opt-in (e.g. `ALLOW_DB_SKIP=1`) and CI
must not set it.

**Note the known trap:** `describe.skipIf(cond)` evaluates its argument as a
**value**, not a callback. `skipIf(() => !dbReachable)` is always truthy and skips
forever. This bug has already occurred in this repo. If you touch these call
sites, ensure a plain boolean.

**Verify:** run with DB down → run fails fast with a clear message, not 1332
skips. Run with DB up → 1772 pass. Report both.

## Task 3C — Make the suite able to exit 0 (D-4, P2)

All 1772 executing tests pass, yet `npm run test` exits 1:
```
[vitest-pool]: Worker forks emitted error.
Caused by: Error: Worker exited unexpectedly
```
No CI gate can be built on this today.

**Suspected but unproven:** resource exhaustion — the same machine had a thermal
shutdown and a Docker daemon hang under parallel Node load the same day. It could
equally be a specific test leaking a handle. **Determine which; do not guess.**

Approach: `--reporter=verbose` to identify the crashing file; try
`--pool=threads` and reduced `maxWorkers`/`poolOptions.forks.maxForks`; check for
tests leaving open DB pools or timers.

Prefer fixing the root cause. If it is genuinely environmental, cap concurrency
in `vitest.config.ts` and **document why** in a comment.

**Verify:** `npm run test` exits **0** with DB up, repeatably (run it 3 times;
report all 3 exit codes). If you cannot reach exit 0, say so plainly and report
what you isolated — a truthful partial result is worth more than a masked one.

## Report

- Per task: what changed, what you injected/observed to prove it works.
- 3C: the 3 exit codes, and root cause vs. mitigation.
- Any product bug discovered — reported, not fixed.

---

## Merge order

1. **Agent 3 first** — it makes the test suite trustworthy, which is how you
   validate the other two.
2. **Agent 2** — API/response-shape changes.
3. **Agent 1** — page guards, plus the parity test.
4. Then merge all `HANDOFF:` items by hand and re-run the full suite.

## Definition of done for the wave

- `npx tsc --noEmit` exits 0.
- `npm run test` exits **0** with 0 assertion failures (D-4 fixed).
- `npm run check:isolation` has been **observed failing** on injected violations.
- Running with DB down fails fast instead of skipping 1332 tests.
- The nav↔page parity test exists and passes.
- Per-role response-shape tests exist for every route Agent 2 touched.
- Every leak Agent 2 found is written down, even the ones already fixed.
