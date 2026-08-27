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
| Isolation checker is enforced | Wired into `npm run lint` (package.json:17), which runs in CI. Not decorative. |
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
