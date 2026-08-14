# Live Classrooms — Provider Adapters & Environment Variables

Status: **dev adapter ships (default, deterministic). BigBlueButton adapter is implemented to contract but NOT certified** — it is gated behind environment variables and must never be claimed operational without a real sandbox + the phase-zero ADR (`PLAN.md` §1).

## Provider contract

`src/features/live-classrooms/providers/types.ts` defines `LiveClassProvider`: `validateConfiguration`, `createRoom`, `updateRoom`, `cancelRoom`, `getRoom`, `createJoinToken`, `syncEvents`, `listRecordings`, `deleteRecording`, `verifyWebhook`, `normalizeWebhook`, plus a `capabilities` flag set (webhooks / attendanceEvents / recording / breakoutRooms / polls / whiteboard / embeddedUI).

Registered adapters (`providers/index.ts`):

| `ProviderType` | Adapter | Production claim |
|---|---|---|
| `dev` | `dev-provider.ts` | **No** — deterministic development/test provider, clearly labeled. |
| `bigbluebutton` | `bigbluebutton-provider.ts` | **Not certified** — needs real sandbox + ADR. |
| `external_link` | `external-link-provider.ts` | Not certified — join-token to a provider base URL. |

## Environment variables

| Variable | Required? | Purpose | Effect when absent |
|---|---|---|---|
| `DATABASE_URL` | yes (app) | Postgres connection for the app + DB-backed tests. | `live-classrooms-db.test.ts` skips (`describe.skipIf(!hasDb)`); app cannot run. |
| `LIVE_BBB_URL` | no | BigBlueButton server base URL (e.g. `https://bbb.example.com/bigbluebutton/api`). | `validateConfiguration` returns `NOT_CONFIGURED`; `createRoom`/`createJoinToken` refuse. **No fake success is ever returned.** |
| `LIVE_BBB_SECRET` | no | BBB shared API secret used for SHA-1 checksum signing. | Same as above; webhook verification reports `unsupported`/`unsigned` and processing refuses to trust unsigned bodies. |

The dev adapter needs no variables. `src/features/live-classrooms/providers/dev-provider.ts` defines a development-only webhook secret (`dev-webhook-secret-do-not-use-in-prod`) and header `x-dev-signature` — used by tests and the dev provider's own webhook receiver; never a production credential.

## dev adapter (default)

- `createRoom(sessionId)` → deterministic `providerMeetingId = dev-<sessionId>` (idempotent, honors the saga idempotency key).
- `createJoinToken` → short-lived signed token + an **internal app route** join URL labeled **DÉVELOPPEMENT** (`/dashboard/academics/live-class/<id>?join_token=…`). It is an app route, never a third-party meeting host. `tokens.ts` (HMAC-SHA256, nonce replay cache) enforces single use + expiry.
- `verifyWebhook` → HMAC over `x-dev-signature` using the dev secret; `normalizeWebhook` maps `{eventId, meetingId, type, externalParticipantId, participantRole, timestamp}`.
- `listRecordings` / `syncEvents` → `[]` by design. **Nothing is fabricated.** A scripted recording/event exists only if written for a test/manual probe.
- `test` connection → always succeeds with real measured latency (deterministic adapter).

## bigbluebutton adapter (NOT certified)

Implemented to contract, gated by `LIVE_BBB_URL`/`LIVE_BBB_SECRET`:

- SHA-1 checksum signing per the BBB API (`call + query + secret`).
- `createMeeting` (`create`), role-aware `joinMeetingURL` (`join` with `moderatorPW`/`attendeePW`), `getMeetingInfo`, `getRecordings`, `deleteRecordings`, `end`.
- Webhook: BBB's standard plugin does not sign callbacks; the adapter only trusts a documented `x-bbb-signature` HMAC when `LIVE_BBB_SECRET` is configured, otherwise receipts record `unsupported`/`unsigned` and processing refuses.

**Certification is blocked** until: a real BBB sandbox/trial exists, the checksum + join + webhook + recordings + RTL/Arabic/French + mobile/bandwidth + operations review passes (PLAN.md §1), and an ADR is recorded. Until then, treat the adapter as contract-shaped code, not a working integration.

## Secrets policy

Raw credentials are **never persisted** and never returned by any response, HTML, log, or audit metadata. A `liveClassProviderProfiles` row stores a `credentialRef` (a key name, e.g. `LIVE_BBB_SECRET`) plus masked configuration; no secret literal is stored in `setting_values`, profiles, or `recordAudit` metadata.
