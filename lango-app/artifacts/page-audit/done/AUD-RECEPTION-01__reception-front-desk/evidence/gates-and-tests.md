# AUD-RECEPTION-01 — Static gates and test runs

All commands from `lango-app/` in the campaign worktree
(`C:\Users\OMEN\AppData\Local\Temp\opencode\agentb-reception`), branch
`audit/agent-b/AUD-RECEPTION-01`, target base `f42c2bc`.

## Static gates

| Gate | Command | Result |
|---|---|---|
| Types | `npm run check:types` | PASS |
| Tenant isolation | `npm run check:isolation` | PASS — 828 files scanned, zero warnings in touched files |
| i18n | `npm run check:i18n` | PASS — no missing keys, no invalid translations |
| Missing keys | `node scripts/check-missing-i18n-keys.mjs` | PASS — `0 in 0 files` |
| UI reality ratchet | `npm run check:ui` | PASS — dead controls 38/39, mock 0/0, unlinked 28/28, orphaned 7/7 |
| ESLint (touched) | see below | no net new errors |

### ESLint per-file before → after (problems)

| File | HEAD | After |
|---|---|---|
| `features/reception/services/home-service.ts` | 8 (pre-existing) | 0 |
| `features/reception/services/notifications-service.ts` | pre-existing | 0 |
| `features/reception/ui/reception-api.ts` | pre-existing | 0 |
| `app/api/reception/staff/route.ts` | pre-existing | 0 |
| `app/api/__tests__/reception-portal-scope.test.ts` | n/a (new) | 0 |
| `features/reception/ui/reception-home-view.tsx` | 67 err / 57 warn | 66 err / 57 warn |
| `features/reception/ui/reception-appointments-view.tsx` | 89 err / 49 warn | 85 err / 41 warn |
| `features/reception/ui/reception-visitors-view.tsx` | 80 err / 50 warn | 78 err / 46 warn |
| `features/students/ui/students-list-client.tsx` | 276 err / 621 warn | 276 err / 638 warn* |
| `app/api/students/route.ts` | 0 | 0 |

\* the +17 are the repo-wide misconfigured `better-tailwindcss` entry-point
warnings that fire on every new className; error count is unchanged. The
large pre-existing style debt in the two reception views is untouched by this
campaign (no `--fix` on files with unrelated churn).

## Focused tests

```
DATABASE_URL=…/schoolos_audit npx vitest run src/app/api/__tests__/reception-portal-scope.test.ts
→ 1 file passed; 6/6 tests PASS
```

New suite `reception-portal-scope.test.ts` (DB-backed, real context and
permission pipeline with a session mock):

1. receptionist reads the student directory (200, projected fields);
2. detail strips finance, identity papers and academic history;
3. a role outside the allowlist (parent) still gets 403;
4. the shared host picker opens with `visitor.manage` alone and 403s when both
   capabilities are denied (user permission overrides);
5. reception home visitor counts are branch-scoped;
6. approved-template notifications record `queued` (never a fabricated `sent`)
   and reject unapproved template keys with 422.

Related regression suites re-run (all pass):

```
DATABASE_URL=…/schoolos_audit npx vitest run \
  src/app/api/security.test.ts \
  src/app/api/__tests__/student-360-hardening.test.ts \
  src/app/api/__tests__/role-response-shape.test.ts \
  src/libs/api/permissions.test.ts \
  src/libs/api/page-guard.test.ts \
  src/app/api/portal/role-portals.test.ts
→ 6 files passed; 83/83 tests PASS
```

Combined focused total: **89/89**.

## Broader suite

Deferred to the campaign-end run in the shared audit DB; the same
shared-database caveat documented by the teacher campaign applies (finance
suites pinned to leftover rows). Not re-run here because the audit DB now
contains other agents' concurrent test residue; the focused suites above cover
every file this campaign touched.
