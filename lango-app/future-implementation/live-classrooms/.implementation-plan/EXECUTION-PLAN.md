# Live Classrooms — Execution Plan

Status: **in progress (planning complete, implementation pending)**
Date: 2026-08-08
Authoritative specs: `../LIVE-CLASSROOMS-ADDON.md`, `../REFERENCE-TOOLS-AND-REPOSITORIES.md`, `../../_shared/APP-CONTEXT-AND-UI-SYSTEM.md`
Predecessor doc: `./PLAN.md` (corrected implementation plan — its phase-zero gate and architecture are binding).

---

## 0. Scope & current-state snapshot

**Current state (verified 2026-08-08):**
- `src/features/live-classes/` is **mock-only**: a fake video grid (`live-classes-management-client.tsx` renders `STUDENT_TILES`, fake timer, fake chat), fake reports (`live-class-reports-client.tsx` renders fake stats "48"/"86,2%"/"47 min" and `RECENT_LIVE_CLASSES`), two 5-line RSC view wrappers, two 6-line pages.
- Routes `src/app/[locale]/(dashboard)/dashboard/academics/live-class/page.tsx` and `.../live-class-reports/page.tsx` render the mocks **unguarded** (no addon gate, no server authz, no capability).
- **No** live-class schema, migration, API, permission, or provider code exists anywhere.
- Addon `live-classrooms` is **already registered** in `src/addons/registry.ts` (lines 85–90, `enabled: false`, "Not built.").
- **No** provider credentials in any `.env*` (grep for BBB/BIGBLUE/ZOOM/JITSI/LIVEKIT/MEET → 0 matches).
- Shared files carry **concurrent agent work** (Agent 1 = CRM/Broadcast, Agent 2 = Library): `src/models/Schema.ts` (+551 lines, barrel at ~4005), `src/libs/api/permissions.ts` (library keys at 172–183), `src/components/shared/sidebar.tsx` (library nav), `src/addons/registry.ts`, `migrations/meta/_journal.json` (82 entries, idx 81 = `0080_library_management`). **Do not revert/overwrite/reformat these.**

**Delivered:** a production-grade, tenant-isolated Live Classrooms add-on covering the full lifecycle — schedule → join authorization → live session → attendance evidence → recording/material publication → reporting — **without building a competing academic/timetable/user/student/teacher/attendance/file-storage/notification system.**

**Provider posture (binding, per "External provider rule"):** no external conferencing provider is certified. The application ships a **`dev` provider adapter** (deterministic, clearly labeled, non-production semantics) so the whole lifecycle is usable and testable with zero credentials. A **BigBlueButton adapter is implemented to contract but NOT certified** (requires a real sandbox + ADR, per PLAN.md phase-zero gate). Join tokens/URLs from the `dev` adapter are labeled as development links, **never presented as real provider meetings**. All capability warnings in the UI are honest.

---

## 1. Dependency map

```
src/features/live-classrooms/
  models/live-classrooms-schema.ts        → imports @/models/Schema (tenants, users, academic tables, attendance)
  providers/                              → provider-neutral interface + adapters (dev, bigbluebutton [uncertified])
  services/                               → session saga, join grants, event normalization, attendance derivation, reconciliation
  data/                                   → API fetch helpers (client)
  ui/                                     → server + client components (replaces src/features/live-classes mocks)
  types.ts                                → strict interfaces

app/api/addons/live-classrooms/**         → routes (requireRequestContext + requireCapability + requireAddon)
src/app/[locale]/(dashboard)/dashboard/academics/live-class[/[id]]  → replaced pages
src/app/[locale]/(dashboard)/dashboard/settings/live-classrooms     → provider settings page (new)
```

**Dependencies on existing systems (read-only / reused, never duplicated):**
| Need | Existing source | Notes |
|---|---|---|
| Tenant + session | `requireRequestContext`, `requireTenant`, `getServerUserContext`, `requireServerPage` | every route/page |
| Addon gate | `requireAddon`, `assertKnownAddon`, `isActive` in `src/libs/api/entitlements.ts` | 403 `ADDON_NOT_ACTIVATED` |
| Capabilities | `requireCapability` in `src/libs/api/context.ts` | permission keys `live.*` |
| Academic assignment | `academicClassOfferings`, `classSections`, `subjectTeachers`, `studentPlacements` (isCurrent) | validate teacher/roster eligibility |
| Timetable conflict | `assertSlotIsValid`, `overlaps` in `src/libs/services/timetable-validation.ts` | teacher/class conflicts, reused for live sessions |
| Teacher scope | `getTeacherClassSectionIds` in `src/libs/api/teacher-scope.ts` | teacher may only host assigned combos |
| Attendance register | `attendance`, `resolveRegisterForSubmission`, `recalculateStudentAttendanceSummary`, `detectAndRecordFlags` | **posting attendance is an explicit reviewed action** |
| Attachments | `digitalAssetUsageLinks` (usageType `live_class` exists in schema comment), `/api/content/**` targeting + visibility | recordings/resources link when addon enabled |
| Notifications | `sendNotification({tenantId, recipientId, template, channel, data})` | in_app born sent; email/sms pending — **creation success never coupled to delivery success** |
| Timetable slots | `classScheduleSlots` (live timetable — NOT dead `timetableSlots`) | optional source slot on a session |
| Audit | `recordAudit` (fixed action union `create|update|delete|login|logout|export|import|settings_change|permission_change|entitlement_change`) | **never awaited** |

**Anti-dependencies (explicitly NOT built):** no WebRTC/media server, no duplicate timetable, no duplicate user/student/teacher/attendance/file-storage/notification system. `meetingSlots` (guardian appointments) is untouched and not repurposed.

---

## 2. Provider strategy

**Provider-neutral interface** (`src/features/live-classrooms/providers/types.ts`):

```ts
interface LiveClassProvider {
  id: string;                                   // 'dev' | 'bigbluebutton' | 'external_link'
  capabilities: ProviderCapabilities;           // flags below
  validateConfiguration(config): Promise<Result>;
  createRoom(session, config, idempotencyKey): Promise<{ providerMeetingId: string }>;
  updateRoom(session, config): Promise<Result>;
  cancelRoom(session, config): Promise<Result>;
  getRoom(providerMeetingId, config): Promise<RoomState | null>;
  createJoinToken(opts: { meetingId; role: 'moderator'|'viewer'; identity; ttlSeconds }): Promise<{ url: string; expiresAt: string }>;
  listParticipants / syncEvents(providerMeetingId, since): Promise<RawProviderEvent[]>;
  listRecordings / deleteRecording(providerMeetingId): Promise<ProviderRecording[]>;
  verifyWebhook(headers, body): WebhookVerification;
  normalizeWebhook(body): NormalizedProviderEvent;
}
type ProviderCapabilities = {
  webhooks: boolean; attendanceEvents: boolean; recording: boolean;
  breakoutRooms: boolean; polls: boolean; whiteboard: boolean; embeddedUI: boolean;
};
```

**Adapters:**
| Adapter | Production claim | Behavior |
|---|---|---|
| `dev` (default, ships) | **No** — labeled development/test provider | Deterministic: `createRoom` returns stable `dev-<sessionId>` meeting id honoring an idempotency key; `createJoinToken` returns a short-lived signed token + clearly-labeled dev URL (`/api/addons/live-classrooms/dev/join?token=...`); `syncEvents` emits scripted join/leave/reconnect events for the session's roster; `listRecordings` returns nothing until a scripted recording event exists; `verifyWebhook` accepts the dev shared secret; `test` always succeeds with real measured latency. Every UI badge/token carries "DÉVELOPPEMENT". |
| `bigbluebutton` | **Not certified** — needs real sandbox + ADR (PLAN.md gate) | Implemented to contract: SHA-1 checksum signing per BBB API, `createMeeting`, `joinMeetingURL` with `moderatorPW`/`attendeePW`, `getMeetingInfo`, `getRecordings`. Gated behind env `LIVE_BBB_URL`/`LIVE_BBB_SECRET` — absent → config test returns `not_configured`, UI shows "non configuré" (never simulates success). |
| `external_link` | Not certified | Reduces to join-token with the provider base URL; capabilities all false except none. |

**Capability-driven UI:** unsupported controls (recording, breakout, polls…) are disabled with a tooltip explaining the provider limitation — never hidden-but-presented.

**Config storage:** `liveClassProviderProfiles` rows are tenant-owned; `scope` column (`tenant` default; `platform` reserved for super-admin-managed infra profiles, stored under the platform tenant so isolation checks stay clean). **Raw secrets are never persisted.** A profile stores `credentialRef` (a reference key name, e.g. `LIVE_BBB_SECRET`) + `credentialEncrypted` (encrypted blob with `keyId`/`version` metadata) or, for no-secret providers, masked config only. Responses/HTML/logs/audit metadata never contain secrets.

---

## 3. Schema plan — 9 tables (`migration 0081`)

Feature file: `src/features/live-classrooms/models/live-classrooms-schema.ts` (pattern mirror of `src/features/inventory/models/inventory-schema.ts`), one `export * from` appended to `src/models/Schema.ts` barrel (after line ~4005). All owned tables carry `tenantId uuid FK tenants.id ON DELETE CASCADE`; FKs to authoritative tables; tenant-aware unique constraints.

1. **`liveClassProviderProfiles`** — name, `providerType` (`dev`|`bigbluebutton`|`external_link`), `scope`, `baseUrl`?, `accountId`?, `credentialRef`?, `credentialEncrypted`?, `capabilities jsonb`, `enabled`, timestamps. Unique `(tenantId, name)`.
2. **`liveClassSessions`** — providerProfileId FK→profiles, classOfferingId?/classSectionId?/classSubjectId? FKs, teacherUserId FK→users, title/description/objectives, providerMeetingId?, `scheduledStart/End`, timezone, `actualStart/End`, `status` (pgEnum), `policy jsonb` (recordingEnabled, waitingRoom, chat, screenShare, guestPolicy, maxParticipants), sourceTimetableSlotId? FK→classScheduleSlots, recurrenceId? FK→recurrences, creatorUserId FK→users, `lastSyncAt`, `failureReason`, timestamps. **Unique `(providerProfileId, providerMeetingId)`** (multiple NULLs allowed pre-create). Indexes: `(tenantId, scheduledStart)`, `(tenantId, teacherUserId)`, `(tenantId, status)`.
3. **`liveClassRecurrences`** — `rule` (RFC 5545 RRULE), timezone, `startsOn`, `endsOn`?, sourceSlotId?. (Table + CRUD; auto-expansion from rule is a documented follow-up, not faked.)
4. **`liveClassInvitations`** — sessionId FK→sessions (cascade), userId FK→users, `participantRole` (`teacher|student|parent|guardian`), `joinEligible`, `deliveryState` (`none|queued|delivered|failed|read`), deliveryChannel?, deliveredAt?, invitedBy?. Unique `(sessionId, userId)`.
5. **`liveClassParticipantEvents`** — sessionId FK (cascade), `providerEventId` (immutable), `providerProfileId` FK, userId? (resolved Lango identity), externalParticipantId?, participantRole?, `eventType` (pgEnum: joined/left/reconnect/error/kicked/muted/consent_accepted/recording_started/recording_stopped), `providerTimestamp`, `receivedTimestamp`, `rawPayload jsonb` (bounded diagnostic evidence only), `processingStatus`, `retries`. **Unique `(tenantId, providerEventId)`** = webhook/duplicate dedupe.
6. **`liveClassAttendanceSummaries`** — sessionId FK (cascade), userId FK, participantRole, firstJoinAt?, lastLeaveAt?, `totalPresenceSeconds`, `intervals jsonb` (reconnect-aware), `reconnectCount`, `lateJoinSeconds`, `earlyLeaveSeconds`, `status` (`present|late|early|absent|unknown`), `reconciliationState` (`pending|proposed|approved|rejected|posted`), reconciliationNote?, reconciledBy?, reconciledAt?, `version`. Unique `(sessionId, userId)`. **Never overwrites raw events — derived table.**
7. **`liveClassRecordings`** — sessionId FK (cascade), providerRecordingId?, `state` (`processing|ready|failed|deleted|expired`), playbackUrl?/downloadUrl? (signed, expiring), durationSeconds?, sizeBytes?, `retentionDays`, `expiresAt`, `consentSnapshot jsonb` (policy at record time), createdBy?. Default v1 policy: **recording off**.
8. **`liveClassWebhookReceipts`** — providerProfileId FK, providerEventId?, `signatureResult` (`verified|failed|unsigned|unsupported`), `processingStatus` (`received|queued|processed|failed|dead_letter`), `attempts`, lastError?, receivedAt, processedAt, `rawPayload jsonb`. **Unique partial index on `(tenantId, providerEventId) WHERE providerEventId IS NOT NULL`** — duplicate-delivery idempotency.
9. **`liveClassProviderOperations`** (saga attempts) — sessionId?, providerProfileId FK, `operation` (`create_room|update_room|cancel_room|get_room|test_connection|sync_events`), `idempotencyKey`, `status` (`pending|running|succeeded|failed`), requestSnapshot?/resultSnapshot? (bounded, no secrets), error?, attempts. **Unique `(tenantId, idempotencyKey)`** — retried saga step cannot double-create a room.

pgEnums (local, `DO $ BEGIN CREATE TYPE … EXCEPTION WHEN duplicate_object THEN null; END $;`): `live_class_session_status` (draft/scheduled/waiting/live/ended/cancelled/failed/expired), `live_class_event_type`, `live_class_reconciliation_state`.

**Migration `migrations/0081_live_classrooms.sql`** — hand-written, idempotent (`CREATE TABLE IF NOT EXISTS` + guarded CREATE TYPE), appends **one** journal entry (`idx: 82`, `tag: "0081_live_classrooms"`, `when: > 1787000000000`, no `.sql`). Verifier applies twice.

---

## 4. API inventory — `/api/addons/live-classrooms/**`

All routes: `requireRequestContext` → `requireTenant` → `requireAddon(tenantId, 'live-classrooms')` → `requireCapability(context, 'live.*')`. Every foreign ID verified tenant-scoped. Zod `strict()` validation. Errors: 401/403 (`ADDON_NOT_ACTIVATED`, capability), 404 (not found / not visible), 409 (conflict), 422 (validation/state), 500 (no leaks).

| Method & path | Capability | Purpose |
|---|---|---|
| GET `/provider-profiles` / POST `/provider-profiles` | `live.providers.manage` | list / create |
| PATCH/DELETE `/provider-profiles/[id]` | `live.providers.manage` | edit (masked creds only); delete blocked if sessions exist |
| POST `/provider-profiles/[id]/test` | `live.providers.manage` | **real** connectivity check (dev: deterministic; BBB: env gate) |
| GET `/sessions` (filters: year/class/subject/teacher/provider/date/status, paginated + capped) | `live.read` | list |
| POST `/sessions` | `live.manage` | create **saga** (draft → provider room → notifications) |
| GET `/sessions/[id]` | `live.read` | detail + event timeline + roster |
| PATCH `/sessions/[id]` | `live.manage` | edit draft/scheduled (conflict re-check) |
| DELETE `/sessions/[id]` | `live.manage` | cancel (saga reconcile both systems) |
| POST `/sessions/[id]/start` | `live.host` | start (idempotent: two concurrent → one room) |
| POST `/sessions/[id]/end` | `live.host` | end (idempotent) |
| POST `/sessions/[id]/join` | `live.join` | just-in-time short-lived join grant (teacher-host / roster-verified) |
| POST `/sessions/[id]/sync` | `live.attendance.manage` | provider resync → normalized events |
| POST `/sessions/[id]/reconcile` | `live.attendance.manage` | propose derived attendance (requires reason if manual) |
| POST `/sessions/[id]/post-attendance` | `live.attendance.manage` | **explicit reviewed** post to core register |
| GET `/sessions/[id]/recordings` | `live.recordings.read` | list recordings |
| DELETE `/recordings/[id]` | `live.recordings.manage` | delete recording (audited) |
| GET `/reports` | `live.reports.read` | aggregates + filters |
| GET `/reports/export` | `live.export` | CSV export (tenant-scoped) |
| POST `/webhooks/[providerType]` | signed provider callback | verify → receipt → idempotent normalize (queued) |
| GET `/health` | `live.read` | addon health: provider config state, webhook health, last sync |
| **Self-scoped (student/parent)** GET `/my-sessions` + POST `/my-sessions/[id]/join` | `live.join` | identity-based discovery via **active placement**; joinEligible + placement check; returns short-lived grant |

---

## 5. Page inventory (replaces mock `src/features/live-classes/`)

| Route | Server authz | Contents |
|---|---|---|
| `/dashboard/academics/live-class` (rewrite existing page) | `requireServerPage` + `requireAddon` + `live.read` | List: filters (year/class/subject/teacher/provider/date/status), columns (provider, title, class/section, subject, teacher, planned/actual, invited/joined, recording, creator, status), actions (view/join/edit/cancel/end/sync/report/duplicate). |
| `/dashboard/academics/live-class/new` | + `live.manage` | Create form: class offering/section, subject, assigned teacher (validated), start/end + timezone, optional source timetable slot + recurrence, provider/profile, policy, description/objectives, conflict preview (reuses timetable validation), capability warnings. |
| `/dashboard/academics/live-class/[id]` | `live.read` | Detail: join controls (role-aware short-lived token), roster + invitation/delivery status, provider state, event timeline, attendance reconciliation (reason required), recordings, shared resources, audit history. |
| `/dashboard/academics/live-class-reports` (rewrite) | + `live.reports.read` | Session summary cards (scheduled vs actual, invited/joined/unique, attendance rate, late/early, reconnects), per-participant intervals, trends (teacher/class/subject, failed sessions, provider reliability, recording availability), filters + CSV export. Label provider-specific metrics clearly. |
| `/dashboard/settings/live-classrooms` (new) | `live.providers.manage` | Provider profiles, connectivity test, webhook health, supported capabilities, data region, recording retention, last sync. |
| Student/parent entry | `live.join` | Self-scoped "Mes classes en direct" — only active-placement sessions; join button issues short-lived grant. Location verified against existing student portal nav during UI phase. |

All pages: French UI copy, page header icon gradient `from-[#2487B8] to-[#1B6C93]`, `#16212B` headings, cards `rounded-2xl border border-slate-200/80 bg-white shadow-2xs`, Badge variants exactly `success|danger|warning|info|neutral|signal`, lucide-react w-4/5/6. No fake people/numbers/dates; empty DB → empty state with a next action.

---

## 6. Permission matrix

New keys appended to `PERMISSIONS` in `src/libs/api/permissions.ts` (after line 183, preserving library keys). Naming follows the codebase convention (single-word module prefix, regex `^[a-z]+\.[a-z]+(\.[a-z]+)?$` — addon id `live-classrooms` contains a hyphen and cannot be a permission segment, so the module prefix is **`live`**):

| Key | Label (FR) | Roles (default) |
|---|---|---|
| `live.read` | Consulter les classes virtuelles | teacher, school_admin (auto via ALL), super_admin (auto) |
| `live.manage` | Créer/modifier/annuler des classes virtuelles | teacher, school_admin, super_admin |
| `live.host` | Animer (modérateur) une classe virtuelle | teacher, school_admin, super_admin |
| `live.join` | Rejoindre une classe virtuelle | teacher, school_admin, super_admin, **student**, **parent** |
| `live.attendance.read` | Consulter les présences des classes virtuelles | teacher, school_admin, super_admin |
| `live.attendance.manage` | Réconcilier et reporter les présences | teacher, school_admin, super_admin |
| `live.recordings.read` | Consulter les enregistrements | teacher, school_admin, super_admin |
| `live.recordings.manage` | Gérer les enregistrements (rétention/suppression) | school_admin, super_admin |
| `live.providers.manage` | Gérer les fournisseurs de classes virtuelles | school_admin, super_admin |
| `live.reports.read` | Consulter les rapports de classes virtuelles | teacher, school_admin, super_admin |
| `live.export` | Exporter les rapports de classes virtuelles | teacher, school_admin, super_admin |

**Student join path is identity-based:** `live.join` grants the *permission*, but the actual join route additionally requires (a) active `studentPlacements` placement matching the session's class offering, or (b) a roster `liveClassInvitations` row with `joinEligible=true`. A student can never join a session for a class they are not placed in, regardless of capability. Same for parent (placement through their child).

Default grants only to staff/student/parent as above; accountant/receptionist/guard/alumni/librarian get **no** `live.*` keys (blast-radius discipline).

---

## 7. Security model

1. **Auth**: session via `requireRequestContext`/`getServerUserContext`; tenant + role derived from session, never from client input.
2. **Addon + capability**: every route `requireAddon` + `requireCapability`; every page `requireServerPage` (or equivalent) with capability + role.
3. **Foreign-ID verification**: every `userId`/`classSectionId`/`classSubjectId`/`classOfferingId`/`providerProfileId`/`sourceTimetableSlotId`/`userId` FK looked up and asserted tenant-scoped before use. Cross-tenant id → 404 (not 403, no existence leak).
4. **Roster/assignment enforcement**: teacher may only create/host sessions for class/subject combos returned by `getTeacherClassSectionIds` (admin override permitted and audited); students/parents scoped via active placement.
5. **Join grants**: generated just-in-time, short-lived (configurable TTL, default 10 min), signed, role-aware (moderator/viewer), never persisted as reusable links; single-use semantics enforced at redemption; expired/replayed/cancelled/outside-window grants fail.
6. **Webhooks**: signature/checksum verification (dev secret / BBB checksum), timestamp freshness + replay guard, receipt row upsert on `(tenantId, providerEventId)` for duplicate-delivery idempotency, async idempotent normalization, dead-letter + retry.
7. **No secrets**: credentials never persisted raw; responses/HTML/browser bundle/logs/audit metadata exclude secrets; provider test returns connectivity state only.
8. **Attendance integrity**: actual attendance derived from immutable join/leave events with reconnect intervals + grace period; summaries are derived (versioned); posting to core register is an explicit reviewed action through the existing attendance service (`resolveRegisterForSubmission` + `recalculateStudentAttendanceSummary` + `detectAndRecordFlags`), scoped by registerId.
9. **Audit**: every sensitive mutation (`recordAudit` with fixed action union; never awaited): create/update/cancel/start/end/join-grant, reconcile/post-attendance, recording delete, provider test, profile CRUD.
10. **Pagination caps** on all list endpoints; strict zod validation; safe 404/403/422/409.

**Explicit tests required** (all in verification matrix): cross-tenant class/teacher/student/provider-config IDs; student from another class; unassigned teacher; expired/replayed join grant; join before window / after end; cancelled classroom; forged/duplicate webhook; provider timeout; concurrent start/end; direct URL access.

---

## 8. Concurrency / idempotency proofs

| Requirement | Mechanism |
|---|---|
| Two `start` requests → one meeting | saga `liveClassProviderOperations` unique `(tenantId, idempotencyKey)`; provider create guarded by session status transition (`live` only from `scheduled`/`waiting`) |
| Duplicate webhooks → no duplicate events | receipt upsert `(tenantId, providerEventId)` + event insert unique `(tenantId, providerEventId)` |
| Reconnects don't inflate duration | summary `intervals jsonb` merges overlapping intervals; `totalPresenceSeconds` = union length |
| Notification retries idempotent | `sendNotification` channel + deliveryState transitions; no duplicate sends on retry |
| Sync applies once | `syncEvents` filters events already present (unique event id), receipt marks processed |
| Provider create succeeds once | idempotency key + `succeeded` op row; retry reuses stored `providerMeetingId` |
| Failure → no false `live` state | status only becomes `live` after provider op `succeeded`; failure sets `failed` + `failureReason` (recoverable) |
| Cancel/start race → one valid outcome | single transaction locks session row (`SELECT … FOR UPDATE`); later operation re-reads status and rejects or reconciles |

---

## 9. Add-on disable behavior

- `requireAddon` returns 403 `ADDON_NOT_ACTIVATED` for every `/api/addons/live-classrooms/**` route.
- Pages: server-side `requireAddon` → redirect/403; sidebar `live.*` entries and portal entries disappear (permission+addon-gated nav, same pattern as other addons).
- Other modules keep working; academic/timetable/attendance data untouched. Addon tables + data remain intact; re-enable restores full access.
- Verified by an addon-disable regression in the test suite.

---

## 10. Phased tasks

| Phase | Work | Task(s) |
|---|---|---|
| P0 | ADR + provider compliance (BBB sandbox evidence) — **gated, not deliverable without real sandbox** | doc in `.implementation-plan/` |
| P1 | Registry entry (exists), permissions `live.*`, schema + migration 0081, provider adapter layer (dev + BBB-uncertified + external_link), health | #28, #29, #31 |
| P2 | Sessions CRUD + scheduling saga, conflict checks, join grants (teacher/student/parent), notifications, self-scoped endpoints | #30, #32 |
| P3 | Webhook receiver, receipts, idempotent normalization, attendance derivation + reconciliation + reviewed posting, reports + export | #33, #35 |
| P4 | Recordings policy/retention/access, attachments `live_class` usage links, resource links | #34 |
| P5 | UI pages + nav (replace mocks, add settings page, student entry) | #36 |
| P∞ | Tests (unit + DB-backed + provider contract), verification, docs | #37, #38 |

---

## 11. Verification matrix (24 required evidence items)

Must use **real local PostgreSQL**. Each maps to a test file / live probe:

1. Session create/update persist + validate FK targets. → DB-backed test + live API
2. FK validation rejects invalid tenant-scoped class/teacher/subject/profile/slot. 
3. Schedule conflict (teacher/class) rejected via reused timetable validation.
4. Teacher authz: unassigned teacher cannot create/host; admin override audited.
5. Student authz: student from another class cannot join; active-placement only.
6. Join window enforced: before `scheduledStart`−grace / after end → 422/409.
7. Expired join grant fails; replayed grant fails (single-use).
8. Concurrent start/end: two starts → one room; end during start → single valid outcome.
9. Cancel/start race → one valid outcome.
10. Provider failure → recoverable `failed` state, never phantom `live`; rollback of saga op.
11. Signed webhook: forged signature → receipt `signatureResult=failed`, no event.
12. Duplicate webhook delivery → single normalized event (unique receipt + event).
13. Duration calc: reconnect-aware union of intervals, reproducible from raw events.
14. Reconnect dedupe: repeated join/leave of same participant → correct presence, no inflation.
15. Attendance threshold + grace period respected.
16. Sync idempotency: resync applies no duplicates.
17. Audience restrictions: student/parent see only own sessions; teacher only assigned; admin all.
18. Forbidden-field projections: responses exclude secrets, internal ids, raw credential refs.
19. Two-tenant isolation: tenant B cannot read/mutate tenant A sessions/events/recordings.
20. Addon disable → 403 + nav hidden; re-enable restores; other modules unaffected.
21. Operational-role blast radius: accountant/receptionist/guard/alumni/librarian have no `live.*` → 403.
22. Export isolation: CSV contains only tenant-scoped rows.
23. No secrets in bundles/HTML/logs/audit (grep + response scan).
24. Posting attendance to core register works via reviewed action and leaves raw events intact.

**Global gates:** `npx vitest run` (all new + no regressions), `npx tsc --noEmit` (3 clean-slate runs given [[tsc-nondeterminism]]), `npx tsx scripts/check-tenant-isolation.ts`, production `npx next build`, Docker build + sequential migration apply, **migration idempotent re-run**, `git diff --check`. Browser/manual sweep per `MANUAL-TESTING.md`. Honest completion verdict in `IMPLEMENTATION-REPORT.md` — no claim of "fully implemented and verified" on TypeScript/build alone.

---

## 12. Shared-file collision list (concurrent agents active)

| File | Change (mine) | Coordination |
|---|---|---|
| `src/models/Schema.ts` | append **one** `export * from './live-classrooms-schema'` line after current last line (~4005) | **re-read immediately before edit**; do not touch existing lines |
| `migrations/meta/_journal.json` | append **one** entry `idx: 82`, `tag: "0081_live_classrooms"`, `when: > 1787000000000` | re-read before edit; keep existing entry format |
| `src/libs/api/permissions.ts` | append `live.*` keys after line 183 (after library keys) + default role grants | re-read before edit; do not reorder library keys |
| `src/components/shared/sidebar.tsx` | add live-class nav entry under Académique (`live.read` permission) | re-read before edit; exact anchor confirmed at UI phase |
| `src/addons/registry.ts` | entry already present (lines 85–90) — update description to "Built." after verification, `enabled: true` | do not touch other entries |
| `src/app/api/content/assets/[id]/usage-links/route.ts` | extend usageType enum `homework` → `'homework','live_class'` + live-class existence check | re-read before edit (P4) |
| `src/app/[locale]/(dashboard)/dashboard/academics/live-class*/` | rewrite the 2 unguarded pages | routes are mine to own (mock files only) |
| `package.json`, `package-lock.json`, `docker-compose.yml`, `next.config.ts` | **no changes** | verified untouched by me |

**Delete** (my own mocks, not concurrent work): `src/features/live-classes/**` after replacement is wired.

---

## 13. Documentation deliverables

- `.implementation-plan/EXECUTION-PLAN.md` (this file)
- `.implementation-plan/IMPLEMENTATION-REPORT.md` (final, honest verdict)
- `../MANUAL-TESTING.md` (scenarios: create/edit/cancel, join windows, attendance, recordings, provider test, tenant switch, addon disable, concurrency)
- Provider adapter doc + env-var doc (BBB gated, dev default)
- `..//live-classrooms-verification-evidence.md` (24-item matrix results against live DB)
