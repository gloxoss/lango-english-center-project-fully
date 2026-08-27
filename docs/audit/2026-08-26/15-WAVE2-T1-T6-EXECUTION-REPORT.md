# Wave 2 — T1–T6 Execution Report

Executed 2026-08-27, following `AGENT-TASK-QUEUE.md`. Every claim below was
proven by running something, not by reading a diff — the standing rule this
project keeps re-learning the hard way.

**Context:** work was already in progress on T1, T3, and T4 when this pass
started (real external agents are working through the same queue in
parallel). This report verifies the actual current state of each task
regardless of who touched it, and completes what was still open.

## Summary

| Task | Result | Proof |
|---|---|---|
| T1 — fix `/api/search` (D-12) | ✅ **Done** | 4/5 fail on original code, 5/5 pass on fix |
| T2 — parity test detects drift | ✅ **Done** | Injected mismatch caught by name; clean tree passes |
| T3 — isolation checker usable | ✅ **Done** (stated scope) | Clean tree exit 0; injected violation still caught |
| T4 — suite exits 0 reliably | ❌ **Not achieved** | 2 of 3 consecutive runs passed; 1 new flaky failure |
| T5 — complete the field-leak sweep | ⚠️ **~2% done** | 7/334 sites; found + fixed **D-13** (new, worse than D-12) |
| T6 — rotate VPS secrets | ⛔ **Withheld** | Requires your explicit authorisation (see below) |

---

## T1 — `/api/search` (D-12)

Already fixed when this pass began. Verified rather than trusted:

- Test `search-authorization.test.ts` seeds real cross-role data and calls the
  real handler.
- **Ran as-is: 5/5 pass.**
- Reverted `route.ts` to the original code (no capability checks at all) and
  reran: **4/5 fail** — teacher, accountant, student, and guard all got data
  they shouldn't have. Restored the fix.
- Checked both UI consumers (`invoices-view.tsx`, `statements-view.tsx`) —
  both already use `?? []`, and the fixed route always returns arrays (never
  omits keys), so there's no crash risk from a role receiving an empty
  category.

**Verdict: genuinely fixed, properly tested, safe for the UI.**

---

## T2 — Nav↔page parity test

The version I audited yesterday never imported the nav manifest and could not
detect drift. It has since been rewritten to import `FULL_NAVIGATION` directly
and assert that every nav item's `permission` **equals** its page's
`requiredCapability` — the actual D-1 failure mode.

- **Ran clean: 3/3 pass**, including a new "no dead nav links" check (0 found).
- Changed `finance/payments/page.tsx`'s capability from `finance.read` to
  `settings.read` and reran: **the parity test failed and named the exact
  route** (`Found 1 nav ↔ page guard mismatch(es)`). Reverted.

**Verdict: this is now a real regression test for D-1.**

---

## T3 — Tenant-isolation checker

Yesterday this failed on the clean tree (`guardian/me/children/[relationshipId]
/overview` false positive — a route that authenticates via
`requireParentContext`, which the checker didn't recognise). That's fixed.

- **Clean tree: exit 0.**
  ```
  ✅ Tenant-isolation static check passed.
     Scanned 790 files: 741 tenant-scoped, 21 super-admin, 7 self-scoped, 21 sessionless.
  ```
- Re-injected the original D-2 violation class (`db.insert(...).values({ tenantId:
  body.tenantId, ... })`): **still caught, same file and line reported.**
- Tried a harder case — a route with `tenantId` hardcoded to a literal string
  (bypassing session derivation entirely, but the token `tenantId` still
  appears in nearby queries) and a route whose query drops its tenant filter
  entirely while `tenantId` stays in scope elsewhere in the function: **neither
  is caught.**

This second case is not a hidden defect — the checker's own printed output
already discloses exactly this boundary ("session origin are not proven"). A
static token-presence heuristic cannot see value provenance without real
dataflow analysis, which was explicitly out of scope for this fix. I'm
recording it here so it doesn't get treated as solved-permanently; a
determined developer could still write an unfiltered query as long as
`tenantId` is lexically present somewhere nearby.

**Verdict: fixed against everything the task asked it to fix. One
pre-existing, honestly-disclosed limitation remains — not a regression.**

---

## T4 — Test suite exit 0

This is the one task that did **not** pass its acceptance bar.

```
Run 1: exit 0 — Test Files 126 passed | Tests 1794 passed
Run 2: exit 0 — Test Files 127 passed | Tests 1799 passed
Run 3: exit 1 — Test Files 2 failed, 125 passed | Tests 3 failed, 1796 passed
```

Three consecutive clean runs were the bar precisely because one green run
proves nothing for a flaky suite. Run 3 proved that.

**The good news:** the original 5 cross-tenant-isolation timeouts from
yesterday's audit (`portal/manifest`, `portal/me`, `me/permissions`,
`gate/credentials/verify`, `addons/reporting/.../preview`) **did not recur in
any of the 3 runs.** That specific fix holds.

**The bad news:** run 3 failed with 3 *new* failures, all in
`src/features/finance/__tests__/payment-allocation.test.ts`:
```
× rejects overpay that exceeds the total outstanding balance
× rejects a per-invoice allocation that exceeds its own balance...
× strictly rejects overpayment beyond remaining invoice balance
AssertionError: expected 500 to be 409  (a raw DB error surfaced instead of a
                                          caught validation error)
```
Ran this file alone twice: **7/7 pass both times.** So this is contention, not
a deterministic product bug — the same signature as yesterday's finding that
`role-response-shape.test.ts` passed alone but failed under full-suite load.

**Diagnosis:** `vitest.config.ts` still runs `pool: 'threads'` at full
parallelism with no cap. Yesterday's fix addressed the isolation suite's
specific timeout symptom; it did not address the underlying DB-contention
mechanism, which has now resurfaced in a different DB-seeding test file. This
is whack-a-mole, not a fix.

**What's needed** (unchanged from the original task): cap concurrency for
DB-backed suites specifically, or give each worker isolated DB fixtures, rather
than continuing to patch individual symptoms as they appear in different files.

**Verdict: partially fixed. Root cause still open. Do not build a CI gate on
this suite yet.**

---

## T5 — Field-leak sweep

Current state: **7 of 334 multi-role call sites** have been reviewed and
fixed (`cards/issued`, `certificates/issued/[id]`, `search`,
`students/parents/[id]`, `students/parents/[id]/payments`,
`students/parents/[id]/activity`, `students`). That's ~2%. No
sweep-tracking document exists, so coverage is only inferable from git status.

**While sampling the unswept remainder for this report, I found and fixed a
new, more serious defect — D-13.**

### D-13: Parent role had zero ownership check on attendance excuses

`src/app/api/attendance/excuses/route.ts` had a scoping branch for `student`
but **none for `parent`**:

```ts
if (context.role === 'student') {
  conditions.push(eq(attendanceExcuses.studentId, context.userId));
} else if (studentIdParam) {          // parent falls here, completely unchecked
  conditions.push(eq(attendanceExcuses.studentId, studentIdParam));
}
```

- Pass **any** `studentId` → read that child's excuse reason/document (often
  medical detail), zero relationship check.
- Omit the param → **no filter at all** — every family's excuses, tenant-wide.
- `POST` had the mirror flaw: `body.studentId` trusted unconditionally, so a
  parent could submit a **fabricated excuse for another family's child**.

This is worse than D-12: no guessing required (an empty query string was
enough), and it's read *and* write, not just read.

**Fixed:** added `getGuardianChildIds()`, resolving the caller's actual children
server-side via `guardians.userId → guardianStudents`. `GET` now scopes to that
set (denies a mismatched `studentId` instead of honouring it); `POST` now 403s
if the target student isn't the caller's child.

**Verified both directions:**
```
Original code:  3 of 4 new tests FAIL (cross-family read succeeds, forged
                excuse succeeds)
Fixed code:      4 of 4 PASS
```
Test: `src/app/api/__tests__/attendance-excuses-idor.test.ts`. Revert-to-fixed
confirmed byte-identical via diff.

**Take the lesson literally: two spot-checks of the unswept 334, on two
different days, found two different real vulnerabilities.** The sweep is not
optional polish — assume more exist until it's actually done.

**Verdict: 7/334 routes fixed and verified. The sweep itself remains open —
report this honestly rather than as "D-5 handled."**

---

## T6 — Rotate VPS secrets

**Not executed.** Per the task's own gate: this touches live production,
invalidates every active session, and requires coordinating a Postgres
password change with a running container. I do not have your authorisation to
do that right now, and the task explicitly says to stop and ask rather than
proceed on inferred consent.

If you want this done, say so explicitly and I'll run it — plan is: generate
fresh `POSTGRES_PASSWORD` and `BETTER_AUTH_SECRET`, update `.env` (keeping
`600` permissions, already fixed), rotate the Postgres role password inside
the container, `docker compose up -d` to restart with new env, verify HTTPS
and a fresh login all work post-rotation.

---

## Net effect on the defect register

- **D-1: fixed**, now with a real regression test.
- **D-2: fixed** (clean tree exits 0; catches the violation it claims to).
- **D-4: still open.** Root cause not resolved, just relocated.
- **D-5: still open** at ~2% coverage.
- **D-12: fixed and verified.**
- **D-13: new finding, fixed and verified same day.**
- **D-10, D-11, D-6, D-9: unchanged** — outside this wave's scope.

Register and severity summary updated in
`11-DEFECT-AND-RISK-REGISTER.md`.

## Recommended next step

Given D-13 was found in ~10 minutes of sampling, and D-12 in ~15 minutes
yesterday: **do not proceed past T5 in the task queue until T5 is actually
run to completion.** Every day it stays at 2%, the odds that a partner hits a
third one — live — go up, not down.
