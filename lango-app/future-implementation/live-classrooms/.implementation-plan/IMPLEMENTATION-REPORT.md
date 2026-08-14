# Live Classrooms — Implementation Report

Status: **implemented; verification in progress — NOT "fully verified"**
Date: 2026-08-08
Scope: `future-implementation/live-classrooms/LIVE-CLASSROOMS-ADDON.md` + `.implementation-plan/EXECUTION-PLAN.md` (+ binding `PLAN.md` phase-zero gate).

## 1. Honest verdict

The **full lifecycle is implemented** in `src/features/live-classrooms/` with a real tenant-scoped schema (migrations 0081 → 0087 hardening → 0091 schedule-overlap), 23 API routes under `/api/addons/live-classrooms/**`, the provider adapter layer, and the replacement UI pages. All **64 live-classrooms automated tests pass against a real PostgreSQL database** (`npx vitest run src/features/live-classrooms` → 4 files, 64/64, exit 0), including the P1-1 provider-operation saga (no external I/O inside a DB transaction) and P1-2 DB-authoritative schedule-overlap constraints. No live-classrooms file is flagged by the tenant-isolation static check.

This report **does not claim "fully implemented and verified"** based on TypeScript/build alone. The caveats in §6 are real and must be read before treating the add-on as production-ready.

## 2. What was delivered

| Area | Delivered |
|---|---|
| Schema | 9 tables in `migrations/0081_live_classrooms.sql` (idempotent, applied twice to a real DB → 9/9). Feature schema in `models/live-classrooms-schema.ts`. |
| Provider layer | `providers/types.ts` contract + 3 adapters: **dev** (ships, deterministic, clearly labeled), **bigbluebutton** (to contract, gated behind `LIVE_BBB_URL`/`LIVE_BBB_SECRET`, **NOT certified**), **external_link** (join-token only). Join grants in `providers/tokens.ts` (HMAC-signed, single-use nonce cache). |
| Scheduling | `services/session-service.ts` — create/update/cancel/start/end saga, tenant-scoped FK validation (`INVALID_REFERENCE` 422), overlap conflict (`LIVE_SESSION_CONFLICT` 409), teacher-assignment check with audited admin override, concurrency-safe transitions, `expireStaleSessions` sweep. |
| Join authorization | `services/join-service.ts` — just-in-time short-lived role-aware grants; window enforcement (before/after → 409); host/admin moderator, placed student viewer, unplaced student `STUDENT_NOT_PLACED`, non-host teacher `TEACHER_SCOPE`, parent via placement; single-use redemption. |
| Events & webhooks | `services/event-service.ts` — HMAC verification → receipt (unique `(tenantId, providerEventId)`) → idempotent normalization; forged deliveries recorded but never ingested. |
| Attendance | `services/attendance-service.ts` — immutable events → derived summaries (reconnect-aware interval union, presence ratio, 5-min late/early grace), reconciliation with required reason, reviewed posting to the core register. |
| Recordings & materials | `services/recording-service.ts` + `/materials` routes (attachments `live_class` usage links). Recording defaults **off**. |
| Reports | `services/report-service.ts` + `/reports/overview`, `/reports/sessions`, `/reports/export` (CSV, tenant-scoped). |
| UI | Replacements for the mock pages: `/dashboard/academics/live-class` (list), `/new` (create), `/[id]` (detail), `/dashboard/academics/live-class-reports`, new `/dashboard/settings/live-classrooms`, plus student + parent `live-classes` entry points. |
| Gating | Permission keys `live.*` in `src/libs/api/permissions.ts`; addon gate via `requireAddon`; nav in `src/components/shared/sidebar.tsx`. Registry entry updated to `enabled: true`, "Built." |

## 3. Test evidence (executed 2026-08-08 against real local Postgres)

`npx vitest run src/features/live-classrooms` → **4 files, 64/64 pass, exit 0** (re-run after the P1-1 saga and P1-2 overlap work):

| File | Tests | Status |
|---|---|---|
| `providers/tokens.test.ts` | 7 | pass (sign/verify, expired, forged, malformed, replay, ISO expiry, join-grant hash binding) |
| `providers/signing-key.test.ts` | 8 | pass (dev/test/prod-missing/prod-short/prod-known-insecure, health mode, no secret leakage) |
| `providers/dev-provider.test.ts` | 7 | pass (deterministic id, lifecycle, dev-labeled join URL, webhook verification, no fabricated data, capability flags, `isProviderFailure`) |
| `services/live-classrooms-db.test.ts` | 42 | pass — cross-tenant 404/422, teacher scope, unassigned teacher + override, overlap 409, start/end/cancel idempotency + concurrency, join windows, redeem/replay, forged/duplicate webhook, expiry sweep, **P1-1 provider saga (6)**, **P1-2 schedule-overlap constraints (11)** |
| **Total** | **64** | **64 pass, 0 fail** |

Full mapping to the 24-item verification matrix: `live-classrooms-verification-evidence.md`.

## 4. Bug fixes surfaced by the DB tests

These were real production bugs in `session-service.ts`, found and fixed while writing the DB test:

- **Overlap false negative / false positive**: DB `timestamp(mode:'string')` returns naive-local `YYYY-MM-DD HH:mm:ss` (space separator) while the form sends `T`-separated input; raw string comparison mis-ordered them. `assertNoLiveSessionOverlap` now compares epoch-ms.
- **Expiry-sweep timezone skew**: `expireStaleSessions` compared naive-local DB values against UTC `toISOString()`. Now uses a local-naive `now`.
- **Join-window skew** (in the test harness): used a `localIso()` helper that formats naive-local `T`-separated strings so `new Date(...).getTime()` comparisons in the services line up with `Date.now()`.

## 5. Global gates — status

| Gate | Result |
|---|---|
| `npx vitest run` (my files) | ✅ 32/32 pass, exit 0 |
| `npx tsc --noEmit` (my files) | ✅ no errors in any `live-classrooms` / `addons/live-classrooms` file (global run has concurrent-agent errors — see §6) |
| `npx tsx scripts/check-tenant-isolation.ts` | ⚠️ fails only on `src/app/api/guard/**` (4 routes, concurrent Guard agent's). **Zero live-classrooms routes flagged.** |
| Migration 0081 idempotent re-run | ✅ applied twice, 9/9 tables present |
| `git diff --check` | ⚠️ exit 2 — every flagged file is a concurrent agent's (`.ultraplan/*`, `src/middleware.ts`, finance/students settings files, `permissions.ts` trailing whitespace at lines 445/451). **Zero live-classrooms files flagged.** |
| Production `npx next build` | ⛔ **could not be re-run by this agent** — a concurrent `next build` (PID 29876 + worker) held the `.next` build lock. Earlier segments recorded the global build failing on other agents' broadcast/transport code. |
| Docker build + sequential migration apply | not re-run by this agent (shared infra; see §6) |

## 6. Honest caveats / not verified

1. **No external provider is certified.** The `dev` adapter ships and proves internal behavior only. The BigBlueButton adapter is implemented to contract but **gated and NOT certified** — it requires a real BBB sandbox and the PLAN.md phase-zero ADR before any production claim. All dev join URLs are labeled development links and are **never presented as real provider meetings**.
2. **Provider-timeout / failure recovery (verification item 10)** is covered by the deterministic `scripted-provider` test double (P1-1): hung provider → recoverable `failed` (never phantom `live`), retry reuses the room, concurrent workers converge, stale-lease reclaim, delayed provider, cancel-during-create. This is a test double, not a live provider — no external provider is certified (see #1).
3. **Attendance interval-union / reconnect / grace internals (items 13–15)** are implemented (`attendance-service.ts`) but have **no dedicated automated test** in this run; they are covered by code review and the manual scenarios in `MANUAL-TESTING.md`. Recommend a dedicated `attendance-service.test.ts` before certifying attendance numbers.
4. **Sync idempotency (item 16)** rests on the same unique `(tenantId, providerEventId)` mechanism that is directly tested for webhook duplicate delivery; a dedicated resync test is not present.
5. **Global suite has pre-existing failures in concurrent-agent territory**: `src/libs/api/permissions.test.ts` (underscore-key / role rework) and `src/app/api/tenant-isolation.test.ts` (homework/finance/cards/portal routes). These are not live-classrooms files and were **not touched**.
6. **`npx next build` could not be re-run** because a concurrent agent holds the build lock. The build state at the time of writing is therefore **not independently verified by this agent**. Do not treat the app as build-green until the concurrent agents release the lock and a fresh build passes.
7. **Global `tsc` has nondeterminism and concurrent-agent errors** (see `project_tsc_nondeterminism` memory). The claim above is limited to "no errors in live-classrooms files."
8. **`src/addons/registry.ts`, `src/models/Schema.ts`, `migrations/meta/_journal.json`, `src/libs/api/permissions.ts`, `src/components/shared/sidebar.tsx`, `package.json` are shared files** carrying concurrent agent work. Only my scoped edits were made (one barrel export line, one journal entry, appended permission keys, nav entry, registry entry). No revert/rewrite/reformat was performed.

## 7. Follow-ups before production

- Complete the BBB phase-zero gate: real sandbox + ADR (checksums, joins, webhooks, recordings, RTL, bandwidth, ops).
- Add an `attendance-service.test.ts` for interval-union / reconnect / grace / threshold (P1-5) and prove posting into the core register (P1-6).
- P1-3 effective guardian authorization, P1-4 webhook provider binding, P1-7 lifecycle-race harness, P1-8 adapter hardening, P1-9 authenticated HTTP suite, P1-11 composite-FK/preflight finalization — see `AUDIT-RESPONSE.md`.
- Re-run `npx next build` once the build lock is free; fix any global errors owned by live-classrooms (none known).
- Browser/manual sweep per `MANUAL-TESTING.md`.
