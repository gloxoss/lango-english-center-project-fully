# Live Classrooms — Corrected Implementation Plan

Read the shared context, source plan and provider references first. Current Live Classes management and reports pages are mock-only arrays; there is no live-class schema or API. Do not treat the video-grid mock as a conferencing implementation.

## 1. Mandatory phase-zero gate

Before production provider code, produce an ADR and evidence from a real BigBlueButton sandbox/managed trial covering API checksum, meeting creation, role-aware joins, webhook/event availability, reconnect events, recordings, analytics, French/Arabic/RTL, mobile bandwidth and operations. Complete privacy/recording consent, retention, data-region and subprocessors review.

If external access is unavailable, planning and a deterministic fake adapter may proceed, but BigBlueButton integration cannot be certified.

## 2. Architecture

- SchoolOS owns scheduling, authorization, roster, normalized immutable participant events, attendance summaries, recording policy and reports.
- The provider owns media rooms and raw conferencing capabilities.
- Use provider-neutral adapters plus capability flags; start with fake + BigBlueButton, then external-link connector.
- Store encrypted credential references with key/version metadata. Platform profiles and tenant BYOC profiles have explicit scope.
- Session creation/update/cancel is a persisted saga with idempotency and repairable partial failure.
- Join URLs/tokens are generated just in time, short-lived, role-aware and never persisted as reusable public links.

## 3. Model and invariants

Provider profiles, sessions, recurrence, invitations, participant events, derived attendance summaries/intervals, recordings, webhook receipts and provider-operation attempts. Add unique external meeting/event constraints and bounded payload evidence.

Validate teacher assignment against current class offering/class subject; validate student/guardian visibility through active placement. Detect timetable and live-session conflicts. Webhooks require signature/checksum, timestamp/replay protection and idempotent normalization. Reconciliation never overwrites raw events. Posting proposed presence to academic attendance is an explicit reviewed action through the existing attendance service.

## 4. APIs, worker and UI

APIs under `/api/addons/live-classrooms/**`: provider profiles/test, sessions CRUD/actions, self-scoped list/join, invitations, webhooks, sync/repair, reports, reconciliation and later recordings. Use a PostgreSQL claim/lease worker for webhook normalization, resync and saga retries; reuse the repository instrumentation pattern.

Replace the current fake pages with list/create/detail/report/provider settings. Do not build an in-app WebRTC grid for BigBlueButton; embed or redirect according to the verified provider integration. Capability warnings must be honest.

## 5. Delivery

0. Provider/compliance spike and ADR.
1. Add-on, schema, permissions, encrypted profiles, fake/BBB adapters and health checks.
2. Scheduling, collision checks, saga creation and secure joins.
3. Webhooks, normalized intervals, reconciliation, reports and repair/dead-letter operations.
4. Recording policy/access/retention and Attachments links.
5. External-link connector, quotas/usage and additional providers only on demand.

## 6. Acceptance

- API retries do not create duplicate provider rooms.
- Forged/replayed/duplicate webhooks do not duplicate or regress events.
- Unauthorized, wrong-roster and expired join attempts fail.
- Reconnect intervals yield reproducible attendance durations from raw events.
- Provider outage creates visible recoverable state, never phantom success.
- Manual reconciliation requires reason and preserves raw evidence.
- Recording defaults off and is private, consent/policy controlled, expirable and audited.
- Disabling the add-on leaves timetable, assignments and academic attendance intact.
- Real sandbox evidence, fake-adapter deterministic tests, two-tenant/role sweep, worker restart tests, Docker build/migrate, TypeScript and isolation checks pass.

