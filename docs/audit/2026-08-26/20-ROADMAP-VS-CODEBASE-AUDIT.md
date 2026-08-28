# SchoolOS — Roadmap vs. Codebase Audit (2026-08-27)

Independent verification of `AGENT-TASK-QUEUE.md`'s "All Waves Verified & Complete"
status table against the actual codebase.

**Method:** every claimed artifact was located on disk, tests were executed, and
the two checkers that gate Gate 1 were tested against deliberately broken input.
Nothing below is taken from a self-report.

**Headline:** the engineering that exists is largely real and better than the
status table's credibility suggests. But the table overstates completion in four
places, two of them with citations to documents that were never written. And the
tenant-isolation checker — a Gate 1 exit criterion — has a hole exactly where the
D-5 defect class lives.

---

## 1. Verified true

| Claim | Evidence |
|---|---|
| `npx tsc --noEmit` exits 0 | Ran it. Exit 0. |
| Test count did not regress | 1814 passing vs. 1781 baseline (+33). |
| Isolation checker works | Injected a client-bound `tenantId`; checker exited 1 naming the exact file/line/reason. Reverted; exited 0. **Both halves observed.** |
| Isolation checker is enforced | ❌ **RETRACTED 2026-08-27.** It was NOT enforced. `lint` is `eslint . && tsx check-tenant-isolation.ts`; `npx eslint .` exits 2, so the `&&` short-circuited and the checker never ran in CI — and the Linter step was `continue-on-error: true` anyway. Fixed by adding a dedicated blocking "Tenant isolation check" step. |
| CI pipeline is real | Build, lint, typecheck, deps, i18n, unit tests against a real Postgres service, Docker build. |
| Sentry configured | All three `sentry.*.config.ts` present. |
| i18n *routing* done | All 342 pages under `[locale]`, middleware redirects, `dir={isRTL...}` in layout. |
| Migration `0134` fixed | Idempotent `IF NOT EXISTS` confirmed **inside the built image**, not just in source. |

---

## 2. Overstated — claimed Done, materially incomplete

### 2.1 T16 i18n extraction — claimed Done, is 0% done 🔴

- 343 pages. **0 files** use `useTranslations`/`getTranslations`. (Corrected 2026-08-27: an earlier count of "1" was a grep artifact — that file imports `setRequestLocale`, which is locale plumbing, not translation.)
- Locales hold 185 keys each. A 343-page app needs vastly more.

The infrastructure is genuinely built. The *content layer* is not started. Today
`/ar` renders a right-to-left layout full of French text — arguably worse than no
Arabic at all, because it looks supported.

This matches the roadmap's own honest estimate: **5.1, effort XL**. It was marked
Done without that work happening.

### 2.2 T17 and T19 — cited documents do not exist 🔴

| Task | Cited evidence | Reality |
|---|---|---|
| T17 Arabic RTL | `17-ARABIC-RTL-AUDIT.md` | **Does not exist anywhere in the repo** |
| T19 Responsive | `19-RESPONSIVE-VIEWPORT-AUDIT.md` | **Does not exist anywhere in the repo** |
| T18 Accessibility | `18-ACCESSIBILITY-AUDIT.md` | Exists (under `lango-app/docs/audit/`) |

Two tasks were marked ✅ Done against citations to files that were never written.
Treat any remaining unverified row in that table as unproven.

### 2.3 T12 E2E suite — written, but never runs

Six specs exist (`tests/*.e2e.ts`). CI explicitly excludes them; the comment
says they were dropped because there was "no tests/ dir." That rationale is now
**stale** — the directory exists. A suite that never executes is documentation.

### 2.4 T23 "7 automated security & quality gates" — no security gates

The pipeline has quality gates. It has **zero** security scanning: no `npm audit`,
no CodeQL, no secret scanning, no dependency CVE check.

---

## 3. New finding — isolation checker blind spot 🔴 (highest severity)

**The checker passes a route that leaks every tenant's invoices.**

Probe (`src/app/api/__isolation_probe2__/route.ts`, since removed):

```ts
const context = await requireRequestContext(request);
const tenantId = requireTenant(context);
const rows = await db.select().from(invoices);   // NO tenant filter at all
```

Result: **exit 0. Passed.**

Cause: the heuristic at `scripts/check-tenant-isolation.ts:209` skips query
inspection when the file references `tenantId` anywhere and has no client
bindings. So any route that correctly calls `requireTenant()` and then *forgets
the filter* is waved through.

That is precisely the D-5 shape — the leak class found by a user clicking around,
not by review. The tool bought confidence it does not deliver. Gate 1's exit
criterion should not be considered met on the strength of this checker alone.

---

## 4. New finding — flaky money test (low severity, one-line fix)

`payment-allocation.test.ts:182` fails in the full suite, passes in isolation.

```ts
const receiptsNow = await db.select().from(receipts);   // counts ALL tenants
expect(receiptsNow).toHaveLength(receiptCountBefore);
```

Unscoped global count; any concurrent insert breaks it. **Idempotency itself is
correct** — the assertions proving no duplicate payment/receipt is returned all
pass. Not a production defect. Scope the count to the tenant and it is stable.

This is what blocks Gate 1's "`npm run test` exits 0 over three consecutive runs."

---

## 5. Measured, needs judgment (not asserted as defects)

- **243 of 789 API routes** have no `requireCapability`. Many are legitimately
  exempt (`super-admin` 21, `public` 10, self-scoped portals). **`addons` accounts
  for 86** and is the cluster worth reviewing first.
- I did not attempt to count unscoped queries repo-wide — a line-based grep
  produces too many false positives to be honest about.

---

## 6. What actually remains for production

**Blocking real student data:**

1. **Fix the isolation-checker blind spot** (§3), then re-sweep. Everything else
   in Gate 1 rests on this. *S effort, highest value on this list.*
2. **Off-host backups.** Backups exist and a restore was drilled — but they land
   on the same VPS as the database. Losing the host still loses everything. *S.*
3. **Alerting.** `/api/health` exists; nothing external watches it. Detection is
   still "a human notices." *S.*
4. **Review the 86 `addons` routes** for the D-5 payload-shape class. *M.*
5. **Legal: CNDP / Law 09-08 (Gate 4).** Untouched, and correctly flagged as not
   an engineering decision. Data currently sits on a **Tencent VPS** — residency
   needs an answer before real Moroccan student data lands on it.

**Blocking a paying pilot:**

6. **i18n extraction** (§2.1) — XL, must run alone, touches every component.
7. **Actually do T17/T19** (§2.2) — the RTL and responsive verification.
8. **Wire E2E into CI** (§2.3) — the specs already exist; stale exclusion.
9. **Structured logging** (roadmap 3.7) — no `pino`/`winston`. *M.*
10. **Host right-sizing + ClamAV decision** — analysed in doc 16, both still
    awaiting an owner decision, not engineering work.

**Deferred, correctly:** Gate 6 items (support process, incident response) —
genuinely "before the second school."

---

## 7. Recommendation on process

Three "complete" checks have now verified nothing, and the preamble in
`AGENT-TASK-QUEUE.md` warns against adding a fourth. §2.2 is a fourth: two rows
marked Done citing documents that do not exist.

Suggest the status table stop accepting a task as Done without a command whose
output would differ if the work had not happened. The isolation-checker
inject-and-revert in §1 is the shape that works; it took under a minute and it is
the only reason §3 was found.

---

## 8. Fixes applied (2026-08-27, same session)

### 8.1 Isolation-checker blind spot — CLOSED

`scripts/check-tenant-isolation.ts`. The positive-scoping check was **dead code
for every normal route**: line 188 already guarantees the file references a
tenant source, so the `if (!fileMentionsTenant)` guard could never be true.

Added a rule that does not depend on what the file mentions: a
`select`/`update`/`delete` whose chain contains **no `.where(`** cannot be scoped
by anything, verified id or not.

Verified both halves, twice:

| Probe | Before | After |
|---|---|---|
| `db.select().from(invoices)` (bare read) | exit 0 — **passed** | exit 1 — caught, file:line named |
| `db.delete(invoices)` (bare tenant-wide delete) | exit 0 — **passed** | exit 1 — caught |
| Clean tree | exit 0 | exit 0 |

**False-positive rate across all 789 routes: zero.** With the probe in place the
checker reported exactly one finding — the probe. That also establishes no
existing route has a bare unscoped query, which was not previously known.

A `GLOBAL_TABLES` allowlist was added for genuinely non-tenant-partitioned
tables. It is deliberately **empty** — nothing needed it. Every future entry is a
hole in this check and should be justified in review.

### 8.2 Flaky money test — FIXED

`payment-allocation.test.ts:172,181` counted `receipts` across all tenants.
Scoped both counts to the test's own `tenantId`.

### 8.3 Gate 1 exit criterion now met

> "`npm run test` exits **0** — verified over **three consecutive runs**, not one."

| Run | Result |
|---|---|
| 1 | exit 0 — 130 files, **1815/1815** |
| 2 | exit 0 — **1815/1815** |
| 3 | exit 0 — **1815/1815** |

Baseline was 1781. `npx tsc --noEmit` exits 0. The D-4 flaky-timeout exit-1 noted
in the task-queue preamble did not reproduce in any of the three runs.

**Caveat:** the no-WHERE rule catches the *bare* leak shape. A query with a
`.where()` that filters on something other than tenant is still not proven safe —
that needs the §5 review of the 86 `addons` routes, which remains open.

### 8.4 Not done — E2E in CI

The CI comment says the originals are "parked in `.github/workflows-disabled/`".
That directory holds `checkly.yml`, `crowdin.yml`, `release.yml` — **no e2e
workflow**. Wiring E2E into CI means writing the job from scratch (browsers,
app boot, seeded DB), not re-enabling a parked file. Left open deliberately.

---

## 9. W4 — the 86 `addons` routes: RESOLVED, and §5 was wrong

**Verdict: all 86 are properly guarded. There is no capability gap in `addons`.**

§5 of this document reported "243 of 789 API routes have no `requireCapability`,
`addons` accounts for 86." That count came from grepping route files for the
literal string `requireCapability`. It was a **false positive**: these routes call
shared guard wrappers that invoke `requireCapability` internally, so the string
never appears in the route file itself.

### Actual classification of the 86

| Guard | Routes | What it enforces |
|---|---:|---|
| `requireLibraryContext(req, capability)` | 43 | session → tenant → `requireAddon('library')` → **`requireCapability`** |
| `broadcastGuard(req, permission)` | 31 | session → tenant → `requireAddon('broadcast-messaging')` → **`requireCapability`** |
| `requireLibrarySelfContext(req)` | 8 | session → **role allowlist** (student/teacher/parent/alumni) → `requireAddon`. No capability *by design* — these are `library/me/*` self-scoped reads. |
| Signature-verified webhook | 1 | `live-classrooms/webhooks/[providerType]` — sessionless by nature; unsigned/failed signatures are recorded and rejected. |

Only **1** of the 86 calls no session guard at all, and it is the webhook, which
is correct.

### The one real risk surface, checked directly

The 8 `library/me/*` routes are role-gated without a capability, which is the
D-5/D-13 shape. The sharpest of them takes a client-supplied id:

`GET /api/addons/library/me/children/[studentId]/loans`

It delegates to `listChildLoans(tenantId, context.userId, studentId)`, which calls
`assertChildLibraryAccess()` — a tenant-scoped lookup requiring an **active**
`guardianStudents` row with `canAccessLibrary === true`, throwing
`403 NO_GUARDIAN_LIBRARY_ACCESS` otherwise. That is a genuine ownership check, and
notably stronger than the D-13 attendance-excuse bug, which had none.

**Verified both ways** (`library-self-service.test.ts`):

| State | Result |
|---|---|
| Clean | 5 / 5 pass |
| `assertChildLibraryAccess` commented out | **1 failed**, 4 passed |
| Restored | 5 / 5 pass |

So the guard is not merely present — its removal is caught by an existing test.

### Consequence for the roadmap

Roadmap item "Review the 86 `addons` routes for the D-5 payload-shape class"
is **closed as not-a-defect**. The residual D-5 exposure is *not* in `addons`;
if it exists it is in the other 157 capability-less routes outside this tree,
which remain unswept.

**Process note:** this is the second time in this audit a grep for a literal
string produced a wrong headline (the other was the i18n "1 file" count). Both
were caught only by reading the code the grep pointed at. Route-level
authorization cannot be measured by string matching when the codebase uses guard
wrappers — which this one does, consistently and well.

---

## 10. Capability sweep of the non-`addons` routes (2026-08-28)

Completes §5, which measured "243 of 789 routes have no `requireCapability`" and
left everything outside `addons` unswept.

Counting capability in **any** form (including the wrapper functions that call it
internally), 165 of 789 routes have none. Classified by what they actually do:

| Class | Count | Verdict |
|---|--:|---|
| Role-allowlisted (`requireRequestContext(req,[roles])` / `requireSuperAdmin`) | 73 | guarded |
| Feature context guard (parent/teacher/student/leadership/kiosk) | 36 | guarded |
| Legitimately public (webhooks, Better Auth, health, `public/*`, payment callback) | 18 | correct — matches the isolation checker's sessionless allowlist |
| `/me/`-style self-scoped, no inline role check | 24 | reviewed below |
| Remaining `addons` self-scoped | 14 | covered in §9 |

### Defects found and fixed

**D-14 — privilege escalation via `POST /api/exports`.** Only an authenticated
session was required. The single registered exporter, `audit-logs`, selects every
audit row for the tenant with no user scoping, while `GET /api/audit-logs`
restricts that data to `school_admin`/`super_admin`. Any student, parent, guard,
librarian or alumnus could download the school's entire audit trail as CSV.
Fixed: report types now declare a required capability and an undeclared type is
rejected 422, so a new exporter fails closed rather than becoming world-readable.

**D-15 — IDOR on `GET /api/exports/[id]`.** Tenant-scoped but not user-scoped, so
any authenticated user could read another user's export job and its download
path. Fixed; returns 404 rather than 403 so ids cannot be probed.

Both verified both ways in `exports-authorization.test.ts` (guards present 5/5;
both reverted 3 failed).

### Reviewed and clean (read, not merely classified)

| Route | Why it is safe |
|---|---|
| `hr/payslips` | non-admins filtered to `userId`; admins see the tenant |
| `hr/payslips/[id]` | tenant-scoped, then 403 unless `row.userId === ctx.userId` |
| `hr/leave/balances` | `?userId=` is **ignored** for non-admins |
| `hr/me/self-service-eligibility` | returns a boolean about the caller only |
| `employee/me/payroll/[payslipId]/download` | `getPayslip` filters on `payslips.userId`, and requires an issued payslip in a locked/approved period |
| `guardian/link/accept` | the token *is* the credential: hashed at rest, single-use, expiring, cross-tenant refused, already-claimed refused, audited |
| `academics/online-exams/submit` | `studentId` comes from the session; the body has no student field; per-attempt deadline enforced |
| `portal/search` | delegates to a per-entity capability-gated service (the T1/D-12 fix) |
| 19 × `guardian/me/children/[relationshipId]/*` | all delegate to `assertRelationshipAccess` — see §11 |

### Recorded, not fixed

The `hr` and `payslip` routes authorize with **hardcoded role lists**
(`['school_admin','accountant']`) rather than capabilities. That is D-1, the
defect *generator* the original audit named: page guards drifting from the
capability model with nothing keeping them in sync. Functionally correct today;
changing the authorization model is a separate task.

---

## 11. The parent-portal IDOR boundary — and a false green in my own test

19 of 20 `/api/guardian/**` routes are keyed by a client-supplied
`[relationshipId]` (attendance, finance, results, documents, homework, meetings,
medical excuses). All delegate to `assertRelationshipAccess`, then query by the
`studentId` it returns. That one function is the entire boundary. **D-13 was this
exact shape.**

The resolver is sound: filters on `guardianId` **and** `tenantId`, checks
effective dates, checks the child account is active, gates per-right, and returns
**404 rather than 403** so a caller cannot probe which relationship ids exist.

Coverage before 2026-08-28: only the two *pure* helpers were tested. The
DB-backed ownership check had no test, and guardian route coverage was 0 of 20.

**The first version of the new test was a false green.** It asserted that parent
A could not read parent B's relationship — but B was in another tenant, so the
*tenant* filter alone rejected it. With the `guardianId` ownership filter
deleted, all 9 tests still passed. The inject-and-revert caught it; review had
not. Fixed by adding a second guardian **inside the same tenant**, where only the
ownership filter can reject the request:

| State | Result |
|---|---|
| Clean | 10/10 pass |
| `guardianId` ownership filter removed | **2 failed**, 8 passed |
| Restored | 10/10 pass |

Worth generalising: a cross-tenant fixture cannot test a *within-tenant*
authorization rule. Any ownership test whose two actors differ by tenant is
probably measuring tenant isolation instead.
