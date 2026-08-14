# Live Classrooms — Independent Audit Remediation Plan

Status: **planning complete; remediation in progress**
Date: 2026-08-08
Scope: Independent audit of the Live Classrooms add-on implemented in `src/features/live-classrooms/` + `src/app/api/addons/live-classrooms/**` (migration 0081, 23 API routes, provider adapters, replacement UI).

This document is the single source of truth for remediation. It maps **every** audit requirement to one of five dispositions and records the executable evidence for each. It does not claim completion — completion claims are gated by the "Completion rule" in §7 of this plan.

---

## 1. Phase-0 evidence baseline (executed 2026-08-08)

| Evidence | Result |
|---|---|
| `npx vitest run --project unit src/features/live-classrooms` | ✅ **32/32 pass, exit 0** (tokens 6, dev-provider 7, live-classrooms-db 19) — real Postgres |
| `npx tsc --noEmit --pretty false` (global) | ⚠️ exit 2, **12 error lines, zero in any live-classrooms file** — all in 5 concurrent-agent files (`scripts/test-transport-adversarial.ts`, `src/app/api/portal/portal-security.test.ts`, `src/app/api/portal/role/route.ts`, `src/libs/api/context.ts`, `src/libs/auth/server-context.ts`). Nondeterministic (41→25→12 across runs) — see memory `project_tsc_nondeterminism`. Shared files `src/libs/api/context.ts` / `src/libs/auth/server-context.ts` carry a concurrent `BasePrincipal` rework; **re-read before any edit** and coordinate. |
| Migration journal | Last entry **idx 85 = `0084_student_transport_remediation`** → forward migration is **`0085_live_classrooms_hardening` (idx 86)**. |
| Migration 0081 idempotent re-run | ✅ applied twice to real DB, 9/9 tables present |
| PG constraints / indexes (live query) | See §2 below. No overlap exclusion constraint; FKs are single-column (no composite `(tenant_id, id)`); unique indexes captured. |
| Tenant-isolation static check | ⚠️ fails only on `src/app/api/guard/**` (concurrent Guard agent). **Zero live-classrooms routes flagged.** |

## 2. Real PostgreSQL state (queried live, not assumed)

**Tables (9):** `live_class_provider_profiles`, `live_class_recurrences`, `live_class_sessions`, `live_class_invitations`, `live_class_participant_events`, `live_class_attendance_summaries`, `live_class_recordings`, `live_class_webhook_receipts`, `live_class_provider_operations`.

**Constraints:** all FKs are single-column. Sessions have no overlap protection. The only concurrency/idempotency primitives that exist today:

| Unique index | Purpose | Used by |
|---|---|---|
| `live_class_sessions_provider_meeting_unique (provider_profile_id, provider_meeting_id)` | room identity bound to profile | P1-1/P1-4 |
| `live_class_provider_operations_idem_key_unique (tenant_id, idempotency_key)` | provider saga idempotency | P1-1 |
| `live_class_participant_events_provider_event_unique (tenant_id, provider_event_id)` | event idempotency | P1-4/P1-5 |
| `live_class_webhook_receipts_event_unique (tenant_id, provider_event_id) WHERE NOT NULL` | webhook dedupe | P1-4 |
| `live_class_invitations_session_user_unique (session_id, user_id)` | roster uniqueness | P1-3 |
| `live_class_attendance_summaries_session_user_unique (session_id, user_id)` | summary identity | P1-5 |

**Missing primitives this plan will add (migration 0085):** a durable join-grant redemption table (P0-1); overlap protection (P1-2); composite tenant+id reference guidance — implemented as app-layer validation plus, where practical, composite FKs (P1-11).

---

## 3. Finding-by-finding disposition

Legend: ✅ **existing + verified** · 🟡 **existing but insufficiently tested** · 🔧 **requires correction** · ❌ **genuinely missing** · ⛔ **blocked by external provider**

### P0-1 Durable single-use join grants — ✅ DONE (2026-08-08)
**Evidence:** migration `0087_live_classrooms_hardening` (journal idx 88) adds `live_class_join_grants` storing only the SHA-256 **nonce hash** (never raw), bound to tenant/session/user/auth-session/role/expiry, with unique redemption and a partial expiry index. `redeemJoinGrant` performs an atomic `UPDATE … WHERE redeemed_at IS NULL RETURNING` — exactly one concurrent redemption wins, others get `JOIN_TOKEN_REPLAYED`. Durable across processes/restart. Adversarial DB tests cover concurrent redemption and replay.
**Evidence:** `src/features/live-classrooms/providers/tokens.ts` uses a process-local `nonceCache = new Map<string, number>()`; replay protection dies with the process; token payload `{sub, session, role, exp, nonce}` has **no tenant binding**. `join-service.ts` re-validates window/role at redemption but tenant binding is implicit.
**Fix:** migration 0085 adds `live_class_join_grants` (idempotent, durable): `tenant_id`, `session_id`, `user_id`, `auth_session_id`, `role`, `nonce_hash` (SHA-256 of the nonce — **never raw**), `expires_at`, `redeemed_at`, plus unique `(tenant_id, session_id, user_id, auth_session_id, nonce_hash)`. `issueJoinGrant` persists hash + expiry in the same tx as the token signature; `redeemJoinGrant` does an **atomic `UPDATE … WHERE redeemed_at IS NULL RETURNING`** — exactly one redemption wins, others get a stable `JOIN_TOKEN_REPLAYED` error. Redemption re-checks authz/session/window and records the participant event. Cleanup: delete expired un-redeemed grants via the existing stale sweep. Adversarial DB tests: concurrent redemption (N workers, exactly 1 winner), restart durability (in-memory replay no longer possible), cross-tenant isolation, expired-grant cleanup.
**Blocked by:** nothing.

### P0-2 Secure signing-key configuration — ✅ DONE (2026-08-08)
**Evidence:** the known-literal fallback secret is removed. `providers/signing-key.ts` resolves `LIVE_JOIN_SECRET` strictly: dev/test may use a clearly labeled `dev:` secret; **production fails closed** (`NOT_CONFIGURED`) when absent, < 32 chars, or known-insecure. `GET /api/addons/live-classrooms/health` reports `{ configured, mode }` — never the value. The key is never stored in DB, API responses, logs, or client bundles. Unit tests cover dev/test/prod-missing/prod-short/prod-known-insecure.
**Evidence:** `tokens.ts` falls back to a known literal secret `'dev-join-secret-do-not-use-in-prod'` when `LIVE_JOIN_SECRET` is absent. A hardcoded shared secret is a known-value credential.
**Fix:** remove the fallback path. Resolve `LIVE_JOIN_SECRET` strictly: **dev/test** environments may use a labeled dev secret (clearly distinguishable, e.g. `dev:` prefix) ; **production** fails closed (join issuance returns 500/`NOT_CONFIGURED`) when the var is absent, too short (< 32 chars), or a known-insecure value. Add a startup/`GET /api/addons/live-classrooms/health` diagnostic that reports *whether* the signing key is configured and its mode — never the value. Rotation: support two-key verification (previous key grace period) documented in PROVIDER-ADAPTERS.md. Do not store the key in DB, API responses, logs, or client bundles. Tests: dev-mode ok, test-mode ok, prod-missing → fail, prod-short → fail, prod-known-insecure → fail, rotation (old key still verifies during grace, new key issued).
**Blocked by:** nothing.

### P0-3 Global release gates — ❌ GENUINELY MISSING (verification only)
**Evidence:** global `tsc` exit 2 (12 errors, zero mine, concurrent-agent files); `next build` not re-runnable while a concurrent agent holds the `.next` lock.
**Disposition:** not a code finding; the gate is to *report* honestly and re-run when the lock frees. Blocked on shared infra, not on my code.

### P1-1 Provider saga (no external I/O inside a DB tx) — ✅ DONE (2026-08-08)
**Evidence:** `createLiveSession`/`startLiveSession`/`endLiveSession`/`cancelLiveSession` now reserve state and persist a `live_class_provider_operations` row with the idempotency key **in one short tx, commit**, call the provider **outside** any transaction with a bounded timeout (`withTimeout`, default 10s, test seam `setProviderOpTimeoutForTest`), and persist the outcome atomically. Atomic `pending→running` claim; stale `running` leases reclaimed after grace; non-owner workers poll `waitForOpSettled` and converge on the winner's result; `persistCreateRoomOutcome` promotes to `scheduled` or cleans up a terminal room. Proven by the deterministic `scripted-provider` double + `setProviderOverrideForTest` against real Postgres (6 saga tests: hung provider → recoverable `failed`, retry reuses room, concurrent workers converge, stale-lease reclaim, delayed provider succeeds, cancel-during-create → valid `cancelled` + room cleanup).
**Evidence:** `session-service.ts` `createLiveSession` calls `provider.createRoom` **inside** `db.transaction`; on failure the code sets status `failed` then rethrows → the tx rolls back the failed state, leaving the session `scheduled` with a phantom expectation. Same pattern in `startLiveSession`/`endLiveSession`/`cancelLiveSession`.
**Fix:** redesign the create/start/end/cancel sagas: (1) validate + reserve the session row and persist a `provider_operations` record with the idempotency key **in one tx, then commit**; (2) call the provider **outside** the transaction with `AbortSignal.timeout`; (3) persist success/failure **atomically** in a second short tx. Idempotency key reuse returns the stored result. Add a deterministic failing/timeout provider test double proving: timeout → recoverable `failed` state; retry reuses the room (no duplicate rooms); duplicate workers converge (unique idem key → one winner); provider-succeeds-but-persistence-fails → no phantom `live`; app-succeeds-but-provider-delayed → correct final state; cancellation-during-creation → valid final state.
**Blocked by:** nothing.

### P1-2 Concurrency-safe scheduling — ✅ DONE (2026-08-08)
**Evidence:** migration `0091_live_classrooms_schedule_overlap` (journal idx 92) adds **DB-authoritative** EXCLUDE constraints `live_class_sessions_teacher_overlap_excl` and `live_class_sessions_section_overlap_excl` (GiST over `tsrange(scheduled_start, scheduled_end, '[)')`, partial `WHERE status NOT IN ('cancelled','ended')`, btree_gist enabled). `session-service` keeps `assertNoLiveSessionOverlap` as a friendly pre-check and maps `SQLSTATE 23P01` (including the `.cause` Drizzle wraps it in) to `409 LIVE_SESSION_CONFLICT`. 11 DB tests prove: concurrent identical raw inserts (exactly one wins, 23P01), concurrent `createLiveSession` (one 409), teacher across classes, class with two teachers, adjacent `[start,end)` non-overlap OK, cancelled/ended free a slot / failed still occupies it, UPDATE-caused overlap rejected, friendly 409 on update, DST-boundary adjacency, a deterministic TOCTOU race that slips past the pre-check still surfaces 409 via the DB, and cross-tenant no false positive. Applied to the live DB; `\d live_class_sessions` shows both constraints.
**Evidence:** `assertNoLiveSessionOverlap` runs a **pre-insert read** (no row locks, no constraint). Two concurrent identical creates both pass the check. No DB-level exclusion constraint exists.
**Fix:** DB-authoritative overlap protection. Options: an exclusion constraint `EXCLUDE USING gist (teacher_user_id WITH =, tsrange(scheduled_start, scheduled_end) WITH &&) WHERE (status IN ('scheduled','live'))` — requires btree_gist; plus a second for `class_section_id`. Where the composite granularity can't be expressed cleanly, fall back to a **transaction-scoped advisory lock** keyed on `(tenant_id, teacher_user_id)` / `(tenant_id, class_section_id)` for the create/update window. Either way the DB is the arbiter. Tests (real PG): concurrent identical creates (1 wins, 1×409), overlapping teacher across classes, overlapping class with two teachers, adjacent non-overlapping OK, cancelled/ended policy (ignored for overlap), update causing overlap → rejected, DST boundary, cross-tenant no false positive.
**Blocked by:** nothing (exclusion constraint is local PG; advisory locks are standard).

### P1-3 Effective guardian authorization — 🔧 REQUIRES CORRECTION
**Evidence:** `join-service.ts` `resolveChildrenOfParent` queries `guardians`/`guardianStudents` but does **not** filter by guardian `status`, effective dates (`effectiveFrom`/`effectiveTo`), custody, per-child rights, or the relationship's `relationshipType`. Revocation therefore isn't immediate.
**Fix:** read the **authoritative guardian entity + guardian-student relationship** in the same query and enforce: guardian `active` status; effective date window against `now`; `custody` (whether the guardian may join classroom sessions); per-child placement; `relationshipType` permission mapping. Revocation is immediate (read-time enforcement, no logout needed). Tests: valid guardian/child; parent user **without** a guardian entity → denied; guardian entity without active relationship → denied; revoked → denied immediately; expired/future effective window; custody-restricted → denied; finance-only relationship → denied for classroom; one child OK but sibling not placed → denied for sibling; cross-tenant → denied.
**Blocked by:** nothing.

### P1-4 Webhook provider binding — 🔧 REQUIRES CORRECTION
**Evidence:** `event-service.ts` resolves the session by `providerMeetingId` **only** — a provider-A meeting id would resolve a session even if the webhook claims a different provider profile. Receipt insert + event insert are **not** in one transaction. Raw payload unbounded. No rate limiting. No payload-size cap.
**Fix:** resolve session by **`provider_type + provider_profile_id + provider_meeting_id + tenant_id`**; verify signature with the **per-profile secret** (never a global one); reject any delivery whose claimed profile doesn't match the resolved session. Disabled/deleted profiles: keep receipts for audit, refuse ingestion with a retryable 4xx. Rate-limit unknown-session/invalid-signature deliveries (per-IP + per-tenant counters). Cap raw payload size **before** JSON parse (e.g. 256 KB). Redact sensitive fields in logs/audit. Make receipt + event insertion one transaction with `onConflictDoNothing`. Define failure classes: malformed/unsigned → 400 (no retry); unknown session/profile → 429/rate-limited; valid but provider-processing failure → 5xx (retry). Tests: correct signature, wrong signature, provider mismatch (A sends for B), meeting-id collision across tenants isolated, replay (duplicate delivery), oversized payload, concurrent delivery (exactly one event).
**Blocked by:** nothing.

### P1-5 Attendance calculations + dedicated tests — 🟡 EXISTING BUT INSUFFICIENTLY TESTED
**Evidence:** `attendance-service.ts` implements interval union, reconnect-aware merging, 5-min late/early grace, presence threshold, and deterministic derivation — but has **no dedicated automated test file** in the suite (32 tests cover tokens/dev/db; attendance internals are untested).
**Fix:** add `services/attendance-service.test.ts` covering every listed scenario (single joined/left, reconnect split, reconnects inside grace, interval union correctness, presence ratio threshold, late/early/absent/unknown classification, empty event set, determinism for the same immutable event set). Add versioning: `upsertSummary` bumps version and refuses stale writers via a `WHERE version = ?` optimistic check (today the version is computed from a non-locking read).
**Blocked by:** nothing.

### P1-6 Core attendance posting — 🔧 REQUIRES CORRECTION
**Evidence:** `postAttendance` **deletes the existing attendance row then re-inserts** — a live-class absence can silently overwrite an unrelated (e.g. manual) attendance record for the same student/day/period. No idempotency key, no revision/reversal workflow.
**Fix:** post via the authoritative academic register path with a **scoped, immutable marker** (source = live-class), never a blind delete+reinsert of unrelated data. Add an idempotency key (`live_class:attendance:<sessionId>:<userId>`) so re-posting converges. Changed payload with a reused key → rejected (`409`). Concurrent posting → exactly one result. Record reviewer + revision/reversal workflow (`reconcileAttendance` already has reasons). DB-backed integration tests against the real register tables.
**Blocked by:** nothing.

### P1-7 Lifecycle races — ❌ GENUINELY MISSING (tests)
**Evidence:** races (start/start, start/end, start/cancel, end/end, sync/end, provider callback during creation, expiry-sweep/start, recording sync/deletion) are **not** covered by any automated test. The code has some `FOR UPDATE` but no harness proves single-valid-state.
**Fix:** a lifecycle-race test file with barriers/hooks (pg advisory locks or injected promise gates) asserting exactly one valid final state, no duplicate rooms, no duplicate audit, no contradictory timestamps, for every pair above.
**Blocked by:** nothing.

### P1-8 Harden provider adapters — 🔧 REQUIRES CORRECTION
**Evidence:** `external-link-provider.ts` `createJoinToken` returns `config.baseUrl` with **no URL validation** (arbitrary `javascript:`/`data:`/`file:` URLs). BBB adapter is gated/uncertified (fine) but shares the contract.
**Fix:** `external_link` approves **HTTPS only** (reject `javascript:`, `data:`, `file:`, `http:`), validates with `new URL()`, truthful capability labels. Shared adapter-contract tests (run against dev + external_link + BBB where config present): URL scheme, SSRF/internal-host block for any fetch-based adapter, bounded timeouts, secrets redacted from errors, checksum format (BBB), response-shape validation, clock-skew handling, idempotent create/end. BBB stays disabled/uncertified.
**Blocked by:** BBB live certification — see §4. The *hardening* is not blocked; only *claiming* BBB works is.

### P1-9 Authenticated HTTP adversarial suite — ❌ GENUINELY MISSING
**Evidence:** 23 route handlers exist; no automated HTTP test exercises them with auth/roles.
**Fix:** `routes.http.test.ts` (or per-route) that mounts each handler (pattern already used for other addons if present) and asserts: anonymous → 401; addon disabled → 403; missing capability → 403; wrong role → 403; cross-tenant → 404/403; teacher scope → denied; malformed → 400/422; valid → expected; only allowed fields returned. Harness **exits nonzero if a fixture is missing**; **a skipped suite is not a pass.**
**Blocked by:** nothing.

### P1-10 Branch scope — ✅ EXISTING + VERIFIED (policy decision, documented)
**Evidence:** live-classrooms is **tenant-wide, not branch-scoped** in v1 (no `branchId` on sessions; `RequestContext.branchId` is not used for authorization anywhere in the feature).
**Disposition:** document the tenant-wide policy explicitly in PROVIDER-ADAPTERS.md/IMPLEMENTATION-REPORT.md. **Never** accept a client-supplied `branchId` as authorization (none is accepted today). If branch-awareness arrives later it must be server-derived.
**Blocked by:** nothing.

### P1-11 Migration hardening — 🔧 REQUIRES CORRECTION
**Evidence:** FKs are single-column; `actualStart`/`actualEnd` in session-service use UTC `toISOString()` into `timestamp(mode:'string')` columns (naive-local convention) — a latent timezone bug. No composite tenant+id FKs.
**Fix:** forward migration 0085 adds the P0-1 table, P1-2 constraints, and any `WHERE`-narrowed unique indexes. Add **app-layer composite reference validation** (tenant of referenced id must equal session tenant — the DB tests already assert `INVALID_REFERENCE` 422) and, where practical, **composite FKs `(tenant_id, id)`**. Fix the `actualStart`/`actualEnd` timezone writes to the naive-local convention (`toLocalNaive`). Preflight violation detection in the migration script (fail loudly, never silently delete data).
**Blocked by:** nothing.

### P2 UI / accessibility / design-system — 🟡 EXISTING BUT INSUFFICIENTLY TESTED
**Evidence:** replacement pages exist. A manual sweep identified residual issues to verify/fix: hardcoded hex colors vs design tokens, 44px touch targets, `focus-visible`, screen-reader error announcements, duplicate-submit guards, accessible dialogs (no `alert`/`confirm`), authorized resource selector, FR/AR/RTL labels, distinct loading/empty/permission/addon-disabled/provider-unavailable/network-error states, dev-provider links unmistakably labeled **DÉVELOPPEMENT**, honest capability indicators.
**Fix:** audit each page against this list; fix violations. Dev-provider join links already carry the label; keep it.
**Blocked by:** nothing.

### P2 Performance / operational — 🟡 EXISTING BUT INSUFFICIENTLY TESTED
**Evidence:** retention sweep (`expireStaleSessions`) exists; pagination/bounded payloads/timeouts on routes are not systematically proven; client polling cancellation not verified.
**Fix:** add pagination to list endpoints, bound payload sizes, add request timeouts on provider calls (P1-1), confirm retention job covers join grants (P0-1) and stale provider ops, cancel polling on unmount.
**Blocked by:** nothing.

---

## 4. Blocked-by-external-provider items (honest status, not silently skipped)

| Item | Status | Why blocked |
|---|---|---|
| BBB live certification (checksums, joins, webhooks, recordings, RTL, bandwidth, ops) | ⛔ uncertified, stays disabled | No real BBB sandbox/trial exists. The adapter remains contract-shaped, gated behind `LIVE_BBB_URL`/`LIVE_BBB_SECRET`. No production claim. |
| Provider-timeout recovery (verification item 10) live probe | ⛔ needs failing provider | Dev provider never fails by design; a test double covers it (P1-1) instead of a real one. |
| Resync idempotency live probe | 🟡 | Rest on the same `(tenant_id, provider_event_id)` unique mechanism directly tested for webhooks; a dedicated resync test is added in P1-4. |

## 5. Forward migrations — actual scope applied

Applied to the live DB (direct SQL, same pattern as other feature migrations; journal re-read immediately before writing):

- **`0087_live_classrooms_hardening`** (journal idx 88) — P0-1: `live_class_join_grants` table + unique redemption + tenant FK + expiry index.
- **`0091_live_classrooms_schedule_overlap`** (journal idx 92) — P1-2: `btree_gist` + the two EXCLUDE overlap constraints (partial `WHERE status NOT IN ('cancelled','ended')`). Preflight query confirmed 0 existing conflicts; the constraints fail loudly rather than silently delete conflicting data.

(Index 89-91 are other agents' migrations — parent/guardian portal, office-accounting workflow/reconciliation. Journal was re-read immediately before assigning idx 92.)

## 6. Execution order & gates

1. **P0-1 + P0-2** (security) → migration 0085 part 1 + tokens/join-service rewrite + adversarial DB tests. Gate: new tests pass, old 32 still pass.
2. **P1-1 + P1-2** (concurrency) → saga redesign + overlap protection + test doubles. Gate: saga/lifecycle tests pass.
3. **P1-4 + P1-3** (webhook binding + guardian) → event-service + join-service. Gate: new DB tests pass.
4. **P1-5 + P1-6 + P1-7** (attendance + posting + races) → attendance-service tests + posting fix + race harness.
5. **P1-8 + P1-9 + P1-11** (adapters + HTTP + migration) → adapter hardening + HTTP suite + migration finalization.
6. **P0-3 + P2** → global gates, UI/perf sweep, docs.

Each step runs the full live-classrooms test suite + scoped tsc before moving on.

## 7. Completion rule (from the audit directive — binding)

Do not claim "fully implemented and verified" until: **every P0 and P1 finding above is fixed; durable multi-instance token replay protection passes; provider failure state and retry behavior pass; schedule overlap is concurrency-safe; effective guardian authorization passes; webhook provider binding passes; attendance and posting tests pass; the authenticated HTTP suite passes; migrations are verified; global typecheck exits 0; production build exits 0; browser/manual acceptance is completed; every remaining external-provider limitation is clearly disclosed.** Evidence is recorded in `AUDIT-RESPONSE.md` (one row per finding) and `IMPLEMENTATION-REPORT.md`. A passing service suite or successful page compilation alone is not completion.
