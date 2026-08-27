# Automated Test Results (2026-08-26)

All commands below were actually executed. Exit codes are reported as observed,
not inferred. Where a command's headline message contradicts its exit code, both
are shown.

## Commands run

### 1. `npm run test` (vitest) — FIRST RUN, database DOWN

```
Test Files  47 failed | 50 passed | 25 skipped (122)
     Tests  5 failed | 438 passed | 1332 skipped (1775)
  Duration  43.39s
TEST_EXIT=1
```

**Cause of failure: environment, not code.** 1180 occurrences of
`ECONNREFUSED 127.0.0.1:5432`. The local Postgres container (`schoolos-db`) had
been stopped earlier in the session. This run is reported for transparency and
because it exposes a real risk (below), but its failures are **not** product defects.

### 2. `npm run test` (vitest) — SECOND RUN, database UP

```
Test Files  121 passed (122)
     Tests  1772 passed (1775)
    Errors  1 error
  Duration  93.54s
TEST_EXIT=1
```

- **0 assertion failures.** Every test that executed, passed.
- Exit code is `1` because of one **unhandled error**, not a failing test:
  ```
  Error: [vitest-pool]: Worker forks emitted error.
  Caused by: Error: Worker exited unexpectedly
  ```
  A vitest worker process crashed. On this machine, earlier in the same session,
  heavy parallel Node work caused a thermal shutdown and a Docker daemon hang, so
  a resource-exhaustion cause is plausible but **unproven**. This is a CI
  reliability defect (see D-4), not a product defect.

### 3. `npm run check:isolation`

```
✅ Tenant isolation static analysis passed. All API queries reference tenantId.
ISO_EXIT=0
```

**This message overstates what was verified.** See D-2 — the checker is a
regex heuristic with material blind spots.

## Test coverage observations

| Observation | Value | Significance |
|---|---|---|
| Tests that only run with a live DB | 1332 of 1775 (**75%**) | See D-3 |
| API routes with runtime tenant-isolation tests | 42 | Verified from run output |
| Total API route handlers | 788 | ~5.3% runtime isolation coverage |
| E2E / Playwright tests | **0 found** | `test:e2e` script exists; no `tests/` or `e2e/` dir |

The `src/app/api/tenant-isolation.test.ts` suite ("Automated Cross-Tenant
Isolation Test Suite") is genuinely valuable and does real per-route runtime
verification — e.g. `enforces tenant isolation on route GET /api/academics/class-results`.
Its 42-route scope against 788 handlers is the gap, not its quality.

## Commands NOT run (and why)

| Command | Why not |
|---|---|
| `npm run test:e2e` | No Playwright test files exist to run |
| `npm run build:next` | Verified earlier the same day pre-audit at a different commit; not re-verified at `b0c9124` |
| `npm run lint` | Not executed this session |
| `npm run check:types` | Executed multiple times earlier the same day (exit 0) but **not** at commit `b0c9124` |
| `npm run check:i18n` | Not executed; i18n assessed by direct source analysis instead (see `08-UX-ACCESSIBILITY-I18N.md`) |
| Coverage report | Not generated |
| CI parity check | Not performed |

## Honest summary

The test suite is in **better** shape than the raw exit code suggests: with a
database available, all 1772 executing tests pass. Two real problems remain:
the suite cannot exit 0 because of a worker crash (D-4), and three quarters of
its tests are silently inert without a database (D-3).
