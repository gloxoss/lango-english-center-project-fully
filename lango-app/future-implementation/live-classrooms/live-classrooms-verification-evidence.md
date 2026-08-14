# Live Classrooms — Verification Evidence (24-item matrix)

Date: 2026-08-08. DB: real local PostgreSQL (migration 0081 applied; suite ran against it, not skipped).

Legend: **AUTOMATED** = asserted by `npx vitest run --project unit src/features/live-classrooms` (32/32 pass). **CODE** = verified by reading the implemented service/route. **MANUAL** = scenario provided in `MANUAL-TESTING.md`. **GAP** = not executable in the current scope; documented follow-up, nothing faked.

| # | Requirement | Verdict | Evidence |
|---|---|---|---|
| 1 | Session create/update persist + validate FK targets | ✅ AUTOMATED | `live-classrooms-db.test.ts` — "creates a scheduled session with a deterministic dev room" (status `scheduled`, `providerMeetingId = dev-<id>`); detail re-read from DB. |
| 2 | FK validation rejects invalid tenant-scoped ids | ✅ AUTOMATED | "rejects cross-tenant section / subject / teacher / provider-profile ids with 422" — `INVALID_REFERENCE`, 4 cases. |
| 3 | Schedule conflict (teacher/class) rejected | ✅ AUTOMATED | "rejects an overlapping session for the same teacher" — `409 LIVE_SESSION_CONFLICT`. |
| 4 | Teacher authz: unassigned teacher cannot create/host; admin override audited | ✅ AUTOMATED + CODE | `422 TEACHER_NOT_ASSIGNED`; admin `adminOverrideReason` creates the session. Override is audited in `session-service.ts` via `recordAudit` (not asserted in test — code review). |
| 5 | Student authz: student from another class cannot join; active-placement only | ✅ AUTOMATED | "rejects a student who is not placed and not invited" — `403 STUDENT_NOT_PLACED`. |
| 6 | Join window enforced: before start / after end | ✅ AUTOMATED | `409 SESSION_JOIN_WINDOW_NOT_OPEN` (future) and `409 SESSION_JOIN_WINDOW_CLOSED` (past). |
| 7 | Expired join grant fails; replayed grant fails (single-use) | ✅ AUTOMATED | `tokens.test.ts` — `EXPIRED` (unit); DB — redeem succeeds once, replay → `401 JOIN_GRANT_INVALID`. |
| 8 | Concurrent start/end: two starts → one room; end during start → one valid outcome | ⚠️ PARTIAL | "concurrent starts converge to a single live transition" — 2 requests, both fulfilled, identical `actualStart`, no rejection. The literal "end during start" interleaving is not directly exercised; the single-transition guard that makes it safe (status only flips once) is the tested mechanism. |
| 9 | Cancel/start race → one valid outcome | ✅ AUTOMATED | "a cancelled session cannot start" — `409 SESSION_NOT_STARTABLE`. |
| 10 | Provider failure → recoverable `failed`, never phantom `live`; saga rollback | ⛔ GAP | No failing provider exists in the suite (dev provider never fails by design). `isProviderFailure` discriminator is unit-tested (`dev-provider.test.ts`). A failure→`failed` probe needs a failing provider fixture — **follow-up**, not simulated. |
| 11 | Forged webhook → receipt `signatureResult=failed`, no event | ✅ AUTOMATED | DB — "records a forged delivery but never ingests an event" (unsigned receipt row, zero events); `dev-provider.test.ts` — tampered body rejected. |
| 12 | Duplicate webhook delivery → single normalized event | ✅ AUTOMATED | DB — "ingests a verified event exactly once (duplicate delivery is a no-op)"; unique `(tenantId, providerEventId)` receipt + event insert. |
| 13 | Duration: reconnect-aware union of intervals | ⚠️ IMPLEMENTED, NO TEST | `attendance-service.ts` `computeFromEvents` — join/reconnect/leave timeline → merged intervals, union length. **Dedicated test missing** (manual scenario S-7). |
| 14 | Reconnect dedupe: repeated join/leave → correct presence, no inflation | ⚠️ IMPLEMENTED, NO TEST | Same interval-union code (join-while-open closes segment + increments `reconnectCount`). Manual scenario S-7. |
| 15 | Attendance threshold + grace period respected | ⚠️ IMPLEMENTED, NO TEST | `LATE_GRACE_SECONDS`/`EARLY_GRACE_SECONDS` (5 min) + presence ratio vs `PRESENCE_THRESHOLD` in `attendance-service.ts`. Manual scenario S-8. |
| 16 | Sync idempotency: resync applies no duplicates | ⚠️ IMPLEMENTED, NO DEDICATED TEST | Same unique-event mechanism proven by #12. A resync-specific probe is a follow-up. |
| 17 | Audience restrictions: student/parent see only own; teacher only assigned; admin all | ✅ AUTOMATED (core) + CODE | Teacher scope — "scopes a teacher detail read to their own sessions" (`403 TEACHER_SCOPE` for wrong teacher, resolved for host); cross-tenant 404. Student placement — #5. `my-sessions` route enforces placement at query time (code review). |
| 18 | Forbidden-field projections: responses exclude secrets/internal refs | ✅ CODE (by design) | Credentials are **never persisted** (`credentialRef` reference + masked config only, per provider-profile service); responses carry masked state. No automated response scan — grep across the feature finds no secret literal. |
| 19 | Two-tenant isolation | ✅ AUTOMATED | #2 (write) + "rejects a cross-tenant session read with 404" (read). Tenant B fixtures never see tenant A rows. |
| 20 | Addon disable → 403 + nav hidden; re-enable restores | ⚠️ MANUAL | `requireAddon` is the shared gate used by every `/api/addons/live-classrooms/**` route (code review) and is the same mechanism other addons test. Dedicated disable regression for live-classrooms is manual (M-9). |
| 21 | Operational-role blast radius: accountant/receptionist/guard/alumni/librarian have no `live.*` | ✅ CODE | `src/libs/api/permissions.ts` grants `live.*` only to teacher/school_admin/super_admin/student/parent (per EXECUTION-PLAN §6); those roles get no keys → `requireCapability` 403. Config-level; not in the automated suite. |
| 22 | Export isolation: CSV contains only tenant-scoped rows | ⚠️ CODE | `/reports/export` filters by `tenantId` from `requireRequestContext` (code review). No automated CSV-content test. |
| 23 | No secrets in bundles/HTML/logs/audit | ✅ CODE + grep | No secrets stored (see #18); `recordAudit` metadata carries actions/ids, never credentials (code review + feature grep). |
| 24 | Posting attendance to core register via reviewed action, raw events intact | ⚠️ IMPLEMENTED, NOT DB-TESTED | `postAttendance` (reviewed action) in `attendance-service.ts` calls the existing attendance service and never deletes raw events. Requires a real register/backbone to assert end-to-end — manual M-8; follow-up test recommended. |

## Executive summary

- **Automated coverage:** items 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 19, and the core of 8 and 17 → the security/authorization/concurrency/webhook surface is covered by passing tests against real Postgres.
- **Implemented but no dedicated test:** 13, 14, 15, 16, 24 (attendance/reporting internals) — recommend `attendance-service.test.ts` before certifying attendance numbers.
- **Not executable in current scope:** 10 (needs a failing provider) — documented follow-up.
- **Manual-only:** 20 (addon disable), 22 (CSV content).
