# Lead CRM & Broadcast Messaging — Corrected Implementation Plan

Read the shared app context, both source specifications, and the current communication/admissions code before implementation.

## 0. Corrected starting point

Lead CRM is partially real: `inquiries`, conversion, public capture, admin routes and a real-fetch Kanban exist. However, there are two overlapping API/UI paths (`/api/admissions/inquiries` and `/api/crm/inquiries`; real `inquiries-kanban-view` and fake `lead-pipeline-client`). Follow-ups have a table but no route. Several communication pages are polished mock clients backed by config arrays. Existing SMS is explicitly simulated/log-only, and notification email/SMS rows have no drainer.

Treat Lead CRM and Broadcast Messaging as separate add-ons sharing audience/activity adapters. Finish CRM first.

## 1. Lead CRM plan

- Establish one inquiry service as the source of business logic. Keep compatibility routes temporarily, but make both call the same service and select one canonical route family.
- Validate `assignedToId` belongs to the tenant and an allowed staff role.
- Add inquiry detail, tags, follow-up/activity routes, scheduled follow-ups and conversion through the existing applicant service.
- Extend source attribution for `facebook_ads`, `instagram_ads`, `google_ads` and `other_import`; external provider ingestion stays behind signed, idempotent adapters.
- Replace/delete the fake `lead-pipeline-*` data path. Preserve one real Kanban and add `/[id]` profile/activity UI.
- Public capture keeps rate limiting/honeypot and gains deduplication/idempotency, consent provenance and normalized contact handling.
- Meta/Google connectors are a later phase requiring real tenant credentials and signed webhook tests; generic CSV/web intake ships first.

## 2. Broadcast architecture decisions

- Build email first, then one Morocco-capable SMS provider. WhatsApp/Telegram/Messenger remain adapters after the delivery model is proven.
- Sending never occurs inside the campaign HTTP request. Use a PostgreSQL outbox/claim worker patterned after the existing reporting scheduler and started from `instrumentation.ts`.
- One versioned template engine has channel/locale variants and typed allowlisted variables.
- Approval snapshots recipients, consent/suppression decisions and template version.
- Underage student communications route to eligible guardians by default, using a domain-owned resolver and recorded policy snapshot.
- Birthday wishes are generic automations with unique deduplication keys, not bespoke cron endpoints.
- Existing `smsTemplates`, `smsMessages` and notification outbox require a documented migration/compatibility strategy; do not silently create a third messaging ledger.

## 3. Data and services

Feature schema: encrypted provider connections/references, template identities and immutable versions, saved segment definitions, campaigns, recipient snapshots, deliveries, immutable delivery events, consent, suppressions, automations/runs, webhook receipts and dead letters. Secrets use authenticated encryption with key rotation/version metadata; never return plaintext.

Core services:

- audience adapters for inquiries, students/guardians, staff and explicit IDs;
- template render/escaping and SMS GSM-7/UCS-2 segment estimator;
- campaign preview/snapshot/approval/schedule/cancel;
- transactional outbox claim with `FOR UPDATE SKIP LOCKED`, leases and idempotency;
- provider adapter, webhook verification/replay protection and normalized delivery events;
- suppression/consent enforcement at snapshot and immediately before delivery;
- automation scheduler with timezone, quiet hours, Feb-29 policy and unique per-person/year/channel delivery.

## 4. APIs and pages

CRM: pipeline, lead detail, follow-ups, assignment, conversion, imports and signed provider intake.

Broadcast under `/api/addons/broadcast/**` and `/dashboard/broadcast/**`: connections, segments, templates, campaign composer, reports/delivery detail, automations/birthdays and preferences. Replace the current fake communication clients only after their real endpoints exist; do not leave mock fallback data.

Permissions should separate CRM read/manage/assign/convert/import from broadcast connection/template/campaign/approve/report/export/automation operations. Gate each add-on independently.

## 5. Delivery

1. CRM service consolidation, real pipeline/profile/follow-ups/conversion.
2. Signed imports/connectors and CRM metrics.
3. Broadcast schema, encrypted connections, template versions and email adapter.
4. Campaign preview/snapshot/outbox worker/reporting.
5. SMS provider, encoding/cost, receipts, consent/suppression.
6. Segments, approvals, scheduling and birthday automations.
7. Additional channels only after live-provider reliability is proven.

## 6. Acceptance

- Both legacy inquiry routes produce identical tenant-safe behavior during transition.
- No fake CRM/broadcast config array is reachable in production pages.
- Cross-tenant assignee/applicant/segment/template/connection IDs fail safely.
- Retried public/provider webhook submissions do not duplicate leads.
- Campaign approval freezes recipients and template version; later edits do not mutate it.
- Worker retries never duplicate provider sends; expired leases recover safely.
- Forged/replayed webhooks fail; delivery state never regresses from terminal states.
- Consent, suppressions, guardian routing and quiet hours are rechecked before send.
- Birthday run uniqueness is proven across concurrent workers and restart.
- Add-on disabling preserves admissions/public inquiry capture and core announcements.
- Live provider sandbox evidence, two-tenant sweep, worker restart/retry tests, Docker build/migrate, TypeScript and isolation checks pass.

