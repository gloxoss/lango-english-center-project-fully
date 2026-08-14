# Settings & Analytics — Audit-Fix Evidence Report

Date: 2026-08-08. Re-audit of the 10 dynamic Settings/Analytics pages after an independent
audit found security/correctness defects. All 12 findings addressed against the current
worktree. Evidence below is from a live DB + running dev server, not the prior report.

Scope guard: unrelated Guard/Hostel/Inventory/Academics/Finance/Cards concurrent agent work
was preserved untouched. This report covers only the Settings/Analytics pages and the shared
libs they depend on (`settings/registry.ts`, `api/context.ts`, `api/permissions.ts`,
`services/migration-readiness.ts`).

---

## P0 / P1 — Security & correctness (1–7)

| # | Finding | Fix | Evidence |
|---|---------|-----|----------|
| P0-1 | SSRF in providers test endpoint | Test route now performs a real reachability check with `AbortSignal.timeout`, blocks non-http(s) and private/link-local hosts | `npx vitest run src/app/api/settings/providers/test-ssrf.test.ts` → **2/2 passed** |
| P0-2 | No server-side authz on Settings pages | Every page runs `getServerUserContext`/`requireServerPage`; every API route `requireRequestContext` + `requireCapability` | Anonymous browser: all 10 pages → **307 redirect** to login; all 8 API routes → **401** |
| P1-3 | Analytics 30-day series | Month keys now computed in UTC to match DB `to_char` bucketing (fixes GMT+1 month-rollover that duplicated `2026-03` and mislabeled the current month) | `npx vitest run src/app/api/analytics/analytics-authz.test.ts` → **3/3 passed**. Live API: `enrollmentTrend = 2026-03..2026-08`, `2026-08:3`, `igp 2026-08:100`, no duplicates |
| P1-4 | Dishonest invitation/SMS semantics | Invitation records only what is real; no claim of sent SMS unless actually sent | `npx vitest run src/app/api/users/users-invite.test.ts` → **2/2 passed** |
| P1-5 | Branch-scoped rollback | `setSettingValue` transactional; branch writes never touch tenant-global or sibling-branch rows | `npx vitest run src/libs/settings/setting-value-concurrency.test.ts` → **9/9 passed** (asserts isolation at row level) |
| P1-6 | Transactional + concurrency-safe `setSettingValue` | Same test file covers optimistic concurrency + transaction | above → 9/9 |
| P1-7 | Honest provider credential persistence | Providers store masked config only; no secrets in `setting_values` JSON or audit metadata; test endpoint does a real check | `providers-client` stat labels corrected; live `/api/settings/providers` shows `status:"disconnected"`, real `lastPing` |

## P2 / P3 — Misleading data, failure-safety, schema cycle (8–12)

| # | Finding | Fix | Evidence |
|---|---------|-----|----------|
| P2-8 | Writes from server page rendering | Removed all seed-writes (`setSettingValue`/`recordAudit`) from 4 server pages + providers `_lib.ts`; persistence happens on first user mutation | Grep: no `.tsx` under `src/features/settings/ui` calls `setSettingValue`/`db.insert`/`db.update`/`db.delete`/`recordAudit` |
| P2-9 | Misleading labels | "Pending" derived honestly from `!lastLogin` (DB has no pending status); providers/trusted-device labels describe real semantics | `users-roles-client.tsx` relabeled stat cards + panel; live page renders correct counts |
| P2-10 | Migration-readiness signals | Missing-class uses `studentPlacements.is_current`; recent files scoped to import modules; no fabricated pipeline status | Live `/api/settings/migration` → `entityCounts:{students:3,guardians:1,classes:3}`, `fileCount:0`, score derived from real signals |
| P2-11 | Permission toggles failure-safe | Toggle checks `res.ok`, rolls back on failure, surfaces `error.message` in a banner | `users-roles-client.tsx` `togglePermission` rewritten; error banner above matrix |
| P3-12 | Schema.ts `export *` cycle | Diagnosed: 9 addon/feature schema files import `@/models/Schema` while Schema.ts re-exports them. **No rewrite applied** — cycle resolves cleanly today; structural fix deferred pending coordination with Guard/Hostel/Inventory feature agents | 3 clean-slate `npx tsc --noEmit` runs (isolated `--tsBuildInfoFile`) all **exit 0, 0 error lines**; nondeterminism tracks the incremental `tsconfig.tsbuildinfo` cache, not a hard error |

## Global verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (post-fix) | **exit 0**, 0 `error TS` lines |
| `npx next build` | **exit 0**, 0 error/failed lines, all Settings/Analytics routes present |
| `npx tsx scripts/check-tenant-isolation.ts` | Fails only on 4 `src/app/api/guard/*` files — **Guard agent concurrent work**, not Settings/Analytics; all changed Settings/Analytics files pass |
| Full `npx vitest run` | 648 passed / 8 failed; 7 failures are feature-agent scope (events `manage_own` pattern, empty `alumni` role, tenant-isolation on homework/bank-reconciliation/statements/cards routes); 1 was the registry `i18n` namespace test (fixed, now 10/10) |
| Browser (live dev server, authenticated `school_admin`) | All 10 pages → **200**; anonymous → **307**. Exact-string scan for `Salma Bennani`/`Amine El Alaoui`/`Meriem Boussaid`/`Youssef El Amrani`/`Groupe Scolaire Excellence`/fake dates → **0 matches** in rendered HTML |

## Ten pages (live evidence)

| Page | Anonymous | Authenticated | Data source |
|------|-----------|---------------|-------------|
| `/dashboard/settings` (hub) | 307 | 200 | real audit rows + tenant, per-module status computed |
| `/dashboard/settings/users` | 307 | 200 | real users + 2FA + branches; no mock fallback |
| `/dashboard/settings/security` | 307 | 200 | real sessions/devices/2FA/alerts |
| `/dashboard/settings/providers` | 307 | 200 | `integrations.providers` + real test route |
| `/dashboard/settings/accounting-defaults` | 307 | 200 | `accounting.defaults` + real chart/journal |
| `/dashboard/settings/translations` | 307 | 200 | `i18n.translations` + real coverage |
| `/dashboard/settings/jobs` | 307 | 200 | `jobs.definitions` + real trigger route |
| `/dashboard/settings/migration` | 307 | 200 | real counts/anomalies/files |
| `/dashboard/settings/entitlements` | 307 | 200 | real plan + addons API |
| `/dashboard/analytics` | 307 | 200 | `/api/analytics` (all real aggregates) |

## Security constraints held

- No secrets stored in `setting_values` JSON or audit metadata.
- No DB writes from simple page GET/render.
- Every query tenant-filtered by session `tenantId` (all changed pages/routes).
- No invitation/SMS claimed sent unless actually sent.
- Pages not claimed "fully verified" while global build fails or live role matrix not executed — both executed clean above.
