# AUD-TEACHER-01 — Static gates and test runs

All commands run from `lango-app/` in the campaign worktree
(`C:\Users\OMEN\AppData\Local\Temp\opencode\agentb-teacher`), branch
`audit/agent-b/AUD-TEACHER-01`, target base `f42c2bc` (origin/student-directory-hardening).

## Static gates

| Gate | Command | Result |
|---|---|---|
| Types | `npm run check:types` | PASS (`tsc --noEmit`, no output) |
| Tenant isolation | `npm run check:isolation` | PASS — 828 files, 774 tenant-scoped routes; zero warnings in touched files |
| i18n | `npm run check:i18n` | PASS — no missing keys, no invalid translations |
| Missing keys | `node scripts/check-missing-i18n-keys.mjs` | PASS — `missing translation keys: 0 in 0 files` |
| UI reality ratchet | `npm run check:ui` | PASS — dead controls 38/39 (improved by 1; baseline left untouched to avoid cross-agent churn), mock 0/0, unlinked 28/28, orphaned 7/7 |
| ESLint (touched) | `npx eslint <files>` | see below |

### ESLint per-file before → after (errors, warnings)

The two large pre-existing UI files are not lint-clean on the target branch;
the numbers must not grow.

| File | HEAD | After |
|---|---|---|
| `features/teacher/ui/TeacherPortalView.tsx` | 27 err / 102 warn | 25 err / 103 warn |
| `features/students/ui/students-list-client.tsx` | 276 err / 621 warn | 276 err / 622 warn |
| `features/academics/ui/teacher-schedule-view.tsx` | 12 err / 33 warn | 12 err / 33 warn |
| New/changed files (`teacher/server/teacher-portal.ts`, three `/api/teacher/me/*` routes, test file, `students/route.ts`, `class-results`, `class-subjects`) | n/a | 0 errors |

(The single added warning is the repo-wide misconfigured `better-tailwindcss`
entry-point warning; the same warning fires on every className in the file.)

## Focused tests

```
DATABASE_URL=…/schoolos_audit npx vitest run src/app/api/__tests__/teacher-portal-scope.test.ts
→ Test Files 1 passed; Tests 6 passed
```

New suite `teacher-portal-scope.test.ts` (DB-backed, real context/permission
pipeline with a session mock):

1. teacher reads own class-subject results → 200
2. teacher reading another teacher's class-subject results → 403
3. class-subject picker narrowed to own subjects
4. `/api/teacher/me/timetable` serves canonical slots only (legacy table empty → would answer 0)
5. teacher home lists the subject-assigned section and today's canonical session
6. teacher gets no overdue aggregate; school_admin gets it (`1000 MAD`)

Regression suites re-run (all pre-existing, all pass):

```
DATABASE_URL=…/schoolos_audit npx vitest run \
  src/app/api/security.test.ts \
  src/app/api/__tests__/teacher-directory-hardening.test.ts \
  src/app/api/__tests__/student-360-hardening.test.ts \
  src/app/api/__tests__/role-response-shape.test.ts
→ Test Files 4 passed; Tests 78 passed
```

Combined focused total: **84/84 passed**.

## Full suite (campaign end)

```
DATABASE_URL=…/schoolos_audit npm run test
→ Test Files 6 failed | 217 passed (223)
→ Tests 2 failed | 3197 passed | 9 skipped (3199)
```

Failed files and triage (none in the teacher/academics/students domains this
campaign touched):

| File | Failure | Triage |
|---|---|---|
| `features/finance/__tests__/refund-linkage.test.ts` | expects 0 `accounting_adapter_exceptions` rows, found 3 | Pre-existing / shared-DB state: the 3 rows were written at 19:19–19:21 today (before this run at 20:19) by other agents' runs against the shared `schoolos_audit` DB. Reproduced standalone on this branch. |
| `features/finance/__tests__/invoice-lifecycle.test.ts`, `payment-allocation.test.ts`, `payment-idempotency.test.ts`, `payment-reversal.test.ts` | `Error: Failed query: delete from "tenants"` in cleanup | Environmental on the shared audit DB (leftover child rows from concurrent agents block the tenant delete). |
| `features/subscriptions/services/__tests__/license-expiry-worker.test.ts` | "writes an audit row for the suspension" | Same shared-DB leftover class. |
| (first run only) `libs/api/__tests__/uploads-branding.test.ts` | `beforeAll` hook 10s timeout | Load/timeout flake; passed in the second run. |

Evidence that these are not teacher-portal regressions: the diff touches only
teacher/academics/students files (see §10 of `report.md`), the failures are in
finance/subscriptions suites, and the failure modes are DB-state assertions on
a database shared with other agents' concurrent test runs.
