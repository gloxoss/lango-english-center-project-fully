# Testing Results — This Audit Session

Machine-readable version: `test-results.csv`. Original results recorded as-found, per the audit's no-modify rule — nothing below was fixed during this pass.

## 1. TypeScript type check — RAN, FAILED

**Command:** `npm run check:types` (= `tsc --noEmit --pretty`)
**Environment:** local Windows/Git Bash, this audit session
**Result:** ❌ **3 errors in 3 files**

```
src/app/api/addons/events/[id]/attachments/route.ts:95:56
  TS18048: 'attachment' is possibly 'undefined'.

src/app/api/addons/events/[id]/route.ts:55:67
  TS2345: Argument type mismatch — UpdateEventInput's `venue.name` expects
  string | undefined, but the route passes string | null | undefined.

src/features/assessment/services/homework-service.ts:16:34
  TS2305: Module '"drizzle-orm"' has no exported member 'leftJoin'.
```

**Root cause analysis:**
- The two Events errors are both in code added as part of building the Events edit-capability feature (a real gap this repo's own review had flagged — the fix itself is real and mostly correct, it just has two loose-typing bugs).
- The homework-service.ts error is more serious: `leftJoin` is not a real named export of `drizzle-orm` — Drizzle's join methods are called as `.leftJoin()` on a query builder, not imported as a standalone function. **This means whichever recent edit added this import either never ran `tsc` before committing, or the surrounding code path has never actually executed successfully.** Worth checking whether this file's recent edits (question-bank ownership work, per earlier this session's audit) still function correctly at runtime despite the type error, since a type error doesn't always mean a runtime crash — but it should be verified, not assumed.

**Recommended action:** fix all 3 before the next commit. None require the database to be running, so this can be done immediately, independent of the DB-outage blocker below.

## 2. Everything else — NOT RUN or BLOCKED

| Check | Status | Why |
|---|---|---|
| `npm run lint` (ESLint + tenant-isolation check) | Not run | Time-boxed this session after `check:types` already surfaced real defects worth prioritizing |
| `npm run test` (Vitest) | Blocked | Postgres/docker-desktop reported `Stopped` by a concurrent agent working in this same repo during this session |
| `npm run test:e2e` (Playwright) | Blocked | Same DB dependency, plus needs a running dev server |
| `npm run build` (migrate + Next build) | Not run | Would fail at the migrate step with DB down; also avoided to prevent resource contention with the concurrent agent's active work |
| `drizzle-kit migrate` | Blocked | DB down |
| `npm run db:seed:full` | Blocked | DB down |
| `npm ci` | Not run | Not re-verified this pass; `check:types` running successfully against real type definitions implies `node_modules` is intact |

## 3. What "verification" has actually meant in this repo to date

There is no evidence of automated tests ever running successfully and being recorded anywhere in this repository's history. What exists instead, and what this audit itself continues the pattern of, is **manual code-level verification**: opening the actual file, reading the actual logic, and cross-checking it against a specific claim (a review item, a commit message, a status doc). Across this session and the one before it, this method was applied to roughly 150-200 individual files/routes with specific, falsifiable claims checked one at a time (see `EXECUTION-AUDIT-VERIFIED.md` for the full evidence trail of one such pass).

This is a real and legitimate verification method — several claims from prior status reports were found to be **false** using exactly this method (see `13-risks-security-and-technical-debt.md` for the specific example: a claim that Office Accounting posts to the real ledger, which turned out to be false on inspection). But it is manual, slow, and non-repeatable. It is not a substitute for automated tests, and the near-total absence of confirmed-passing automated tests is the single largest testing gap in this project.

## 4. Immediate next steps for testing

1. Restart Postgres/docker-desktop.
2. Fix the 3 TypeScript errors above (does not require the DB).
3. Run `npm run test` and record real, complete output — pass/fail counts, not just "it ran."
4. Run `npm run lint`.
5. Run `npm run build` in isolation.
6. Only then attempt any readiness-score revision upward from this audit's numbers.

See `08-complete-testing-plan.md` (folded into `FULL-PROGRESS-REVIEW.md` §7) for the longer-term test-coverage plan.
