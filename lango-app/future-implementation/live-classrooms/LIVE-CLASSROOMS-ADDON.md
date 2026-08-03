# Live Classrooms Addon Plan

Status: planned optional addon, not built  
Addon ID: `live-classrooms`  
Reference scope: Live Class Rooms, Add Live Class, provider setup, and Live Class Reports

## Product decision

Build scheduling, authorization, attendance reconciliation, recordings, and reports inside Lango, but do not build a WebRTC media server. Integrate a conferencing provider behind a provider-neutral adapter.

Recommended first provider: BigBlueButton, because it is designed for education and already supplies whiteboards, polls, breakout rooms, recordings, and a Learning Analytics Dashboard. Support external-link providers such as Google Meet and Zoom as reduced-capability connectors. Keep LiveKit/Jitsi adapters possible without forcing their lower-level room semantics into the domain model.

This is an addon because ordinary in-person academic operation must continue without video infrastructure, and video hosting/recording creates substantial variable infrastructure cost.

## What Lango has today

- Active tenant-scoped classes, sections, subjects, class teachers, and subject teachers.
- Weekly class timetables and collision reporting.
- Assignments and submissions.
- Guardian/teacher appointment `meetingSlots`; these are appointments, not classrooms.
- No live-room/session, participant event, recording, provider credential, webhook, or classroom analytics model.

Do not repurpose `meetingSlots`: a guardian appointment has one booked guardian and optional student; a live class has a roster, teacher/moderator roles, attendance events, recording consent, and provider lifecycle.

## Pages

### Live Class list

- Filters: session year, class/section, subject, teacher, provider, date range, status.
- Columns: provider, title, class/section, subject, teacher, planned/actual times, invited/joined counts, recording, creator, status.
- Actions: view, join, edit draft, cancel, end, sync, report, recording, duplicate.
- Statuses: `draft`, `scheduled`, `waiting`, `live`, `ended`, `cancelled`, `failed`, `expired`.

### Create/edit live class

- Select class offering/section, subject, assigned teacher, start/end and timezone.
- Optional source timetable slot and recurrence rule.
- Provider/profile selection, recording policy, waiting room, chat, screen share, guest policy, max participants.
- Description, learning objectives, attachments, and notifications.
- Conflict preview against teacher/class timetable and other live sessions.
- Provider capability warnings instead of pretending every provider supports the same controls.

### Classroom detail

- Join controls with teacher/student-specific short-lived tokens.
- Roster and invitation/delivery status.
- Provider state, event timeline, attendance reconciliation, recording assets, shared resources, audit history.
- Manual reconciliation requires a reason and never overwrites raw provider events.

### Live Class Reports

- Session summary: scheduled vs actual duration, invited, joined, unique participants, attendance rate, late joins, early leaves, reconnects, engagement signals where the provider exposes them.
- Per-participant intervals and total presence, not only first join/last leave.
- Filters and CSV/PDF export.
- Teacher/class/subject trends, failed sessions, provider reliability, recording availability.
- Label provider-specific metrics clearly; do not invent comparable engagement scores.

### Provider settings

- School admin chooses from platform-configured provider profiles; raw secrets remain server-side encrypted.
- Connectivity test, webhook health, supported capabilities, data region, recording retention, and last successful sync.
- Super admin owns shared infrastructure profiles; schools can optionally bring their own credentials where allowed by plan.

## Data model

- `liveClassProviderProfiles`: tenant/platform scope, provider type, encrypted credential reference, base URL/account ID, capabilities, enabled state.
- `liveClassSessions`: tenant, class offering/section, class subject, teacher, provider profile, external meeting ID, title, planned and actual times, timezone, status, policy snapshot, creator.
- `liveClassRecurrences`: recurrence rule, timezone, start/end boundary, source timetable slot.
- `liveClassInvitations`: session, user, participant role, delivery state, join eligibility.
- `liveClassParticipantEvents`: immutable provider event ID, user/external participant identity, event type, provider timestamp, received timestamp, raw payload reference.
- `liveClassAttendanceSummaries`: derived participant intervals, duration, late/early flags, reconciliation state/version.
- `liveClassRecordings`: provider recording ID, state, playback/download references, duration, retention/expiry, consent/policy snapshot.
- `liveClassWebhookReceipts`: provider event ID, signature result, processing status, retries and error.

Use unique `(providerProfileId, externalMeetingId)` and `(providerProfileId, providerEventId)` constraints. Store provider payloads only as bounded diagnostic evidence; normalized rows remain authoritative for Lango reporting.

## Core logic and invariants

- A teacher may create sessions only for assigned class/subject combinations unless an admin explicitly overrides.
- Students/parents can discover only sessions for their active placement.
- Join URLs are generated just in time and are never stored as reusable public links.
- Provider callbacks require signature/checksum verification, timestamp/replay checks, idempotent ingestion, and asynchronous processing.
- Creation is a saga: persist a Lango draft, create provider room, store external ID, then schedule notifications. Retriable failures must not duplicate provider rooms.
- Cancellation/updates reconcile both systems and expose partial failure for repair.
- Actual attendance is derived from immutable join/leave events with reconnect intervals and configurable grace periods.
- Lango attendance is not changed silently. A teacher/admin reviews a proposed reconciliation before posting to the core attendance register.
- Recordings require explicit school policy, retention, access control, and applicable consent/legal review. Default v1 policy: recording off.
- Provider deletion never destroys the Lango audit/report record.

## Provider adapter

Define operations such as:

- `validateConfiguration`
- `createRoom`, `updateRoom`, `cancelRoom`, `getRoom`
- `createJoinToken`
- `listParticipants`/`syncEvents`
- `listRecordings`, `deleteRecording`
- `verifyWebhook`, `normalizeWebhook`

Expose capability flags for breakout rooms, polls, whiteboard, recording, attendance events, webhooks, and embedded UI. The UI disables unsupported controls transparently.

## Implementation phases

### Phase 0 - provider and compliance spike

- Deploy a non-production BigBlueButton instance or managed sandbox.
- Validate API/checksum flow, webhook/event availability, recordings, analytics export, RTL/French/Arabic experience, mobile behavior, and realistic bandwidth.
- Complete privacy, recording consent, retention, processor/subprocessor, and data-region review.

### Phase 1 - addon foundation

- Add registry/gating, migrations, encrypted secret references, provider adapter, capability model, RBAC, audit events, and health checks.
- Add fake provider for deterministic tests.

### Phase 2 - scheduling and join

- Build list/create/detail pages and CRUD/saga APIs.
- Validate academic assignments and schedule collisions.
- Create short-lived role-aware join credentials and self-scoped student/teacher endpoints.
- Add notifications through existing channels without coupling creation success to delivery success.

### Phase 3 - events and reporting

- Add verified webhook receiver, receipt queue, idempotent normalization, reconciliation jobs, participant interval calculation, and reports.
- Add retry/dead-letter operations and provider resync.

### Phase 4 - recordings and classroom resources

- Add policy-controlled recordings, retention/expiry jobs, secure playback authorization, resource links, and deletion/legal-hold workflows.
- Connect to the Attachments Book addon through stable asset references when both addons are enabled.

### Phase 5 - additional providers and operations

- Add external-link connector first, then Jitsi/LiveKit only if customer demand justifies feature differences.
- Add quotas, usage metering, capacity alerts, provider failover policy, support diagnostics, and billing hooks.

## Acceptance criteria

- Tenant, teacher, student, and guardian isolation tests pass.
- Duplicate webhook delivery and API retry never duplicate sessions/events.
- Unauthorized or expired join credentials fail.
- Reports reconcile reconnects and retain raw evidence.
- Provider outage produces recoverable states, not phantom successful classes.
- Recordings are private, policy-controlled, expirable, and audited.
- Disabling the addon hides entry points and blocks APIs without affecting academic/timetable data.

