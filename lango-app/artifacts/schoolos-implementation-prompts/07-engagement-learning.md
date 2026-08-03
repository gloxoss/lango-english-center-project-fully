# 07 — Engagement, Events, and Live Learning Prompt Pack

## Domain contract

Leads are pre-admission contacts; conversion links to the admissions workflow. Communications use consent, templates, segments, outbox jobs, provider events, suppression lists, and delivery evidence. Events and live classes reuse audiences, notifications, attendance links, files, and audit services.

## EL-01 — Lead pipeline and lead detail

**Routes:** `/dashboard/leads`, `/leads/[id]`, `/leads/sources`. **Objective:** capture inquiries, assign ownership, track consent and next action, then convert qualified leads into admissions without duplicates. **Layout:** pipeline/list; detail with contact, interests, source, activity, tasks, messages, consent, conversion. **Actions:** create, assign, schedule follow-up, change stage with reason, merge candidate, convert. **States:** new, contacted, qualified, dormant, lost, converted, duplicate. **Acceptance:** source attribution immutable after conversion except audited correction; contact suppression honored. **Exclude:** treating leads as enrolled students.

## EL-02 — Form intake and lead routing

**Routes:** `/dashboard/leads/forms`, `/forms/[id]`, `/routing`. **Objective:** configure public inquiry/demo/admission-interest forms and deterministic assignment rules. **Layout:** field builder using approved custom fields, consent copy, embed preview, routing rules, spam/security status. **Actions:** publish version, rotate embed key, test submission, pause. **States:** draft, published, rate-limited, spam quarantined. **Acceptance:** CSRF/bot controls, consent evidence, no arbitrary scripts. **Exclude:** collecting sensitive child documents in a generic lead form.

## EL-03 — Audience segments

**Routes:** `/dashboard/communications/segments`, `/segments/[id]`. **Objective:** build reusable, previewable recipient sets from authorized school data. **Layout:** rule builder, estimated/actual count, sample with masked contacts, exclusion reasons. **Actions:** validate, save dynamic or snapshot segment, duplicate. **States:** invalid rule, zero recipients, restricted field, stale snapshot. **Acceptance:** server recomputation, tenant scope, guardian/child deduplication rules. **Exclude:** raw SQL editing.

## EL-04 — Campaign composer and send flow

**Routes:** `/dashboard/communications/campaigns`, `/campaigns/new`, `/campaigns/[id]`. **Objective:** author SMS/email/WhatsApp/in-app broadcasts, preview personalization, approve, schedule, send, and track. **Layout:** audience → channels → content → preview/test → schedule → approval; detail shows job/delivery funnel. **Actions:** save draft, send test, request approval, schedule, cancel queued, retry eligible failures. **States:** draft, approval pending, scheduled, sending, completed, partial failure, cancelled. **Acceptance:** outbox batching, rate limits, quiet hours, opt-out/suppression, idempotency. **Exclude:** browser fan-out and fabricated “delivered” status.

## EL-05 — Message templates and triggers

**Routes:** `/dashboard/communications/templates`, `/templates/[id]`, `/triggers`. **Objective:** version localized SMS/email/WhatsApp templates and bind approved school events to automations. **Layout:** channel/locale editor, variable catalog, preview fixtures, trigger policy and run history. **Actions:** validate placeholders, submit provider template, publish version, enable trigger, test dry run. **States:** draft, provider pending/rejected, active, missing translation, trigger paused. **Acceptance:** strict variable allowlist, fallback locale, loop/duplicate prevention. **Exclude:** executable template code.

## EL-06 — Delivery and communication reports

**Routes:** `/dashboard/communications/reports`, `/messages/[id]`. **Objective:** distinguish queued, provider accepted, delivered, failed, opened where valid, and opted out. **Layout:** funnel, cost/volume, failure taxonomy, recipient event timeline. **Actions:** export authorized data, retry transient failures, suppress invalid contact. **States:** provider delay, unknown, bounced, complaint, opted out. **Acceptance:** provider semantics labeled honestly; privacy-safe retention. **Exclude:** calling provider acceptance “delivered.”

## EL-07 — Birthday and milestone automation

**Route:** `/dashboard/communications/automations/birthdays`. **Objective:** configure optional student/staff wishes with audience, template, approval, quiet hours, and privacy rules. **States:** missing consent/contact, holiday delay, duplicate prevented. **Acceptance:** opt-in policy and no age disclosure by default. **Exclude:** sending to minors without approved guardian/school policy.

## EL-08 — Event types, calendar, and event detail

**Routes:** `/dashboard/events/types`, `/events`, `/events/new`, `/events/[id]`, `/calendar`. **Objective:** plan academic/community events with audiences, capacity, location/link, RSVP, reminders, files, and owners. **Layout:** calendar/list; composer; detail with schedule, audience, RSVP, communication and activity. **Actions:** draft, publish, invite, RSVP, update/cancel, clone. **States:** draft, published, full, waitlisted, cancelled, completed. **Acceptance:** timezone-safe recurrence, capacity transaction, update notifications. **Exclude:** public exposure of private attendee lists.

## EL-09 — Event check-in

**Route:** `/dashboard/events/[id]/check-in`. **Objective:** quickly verify invited attendees by search/QR while supporting guests and offline-safe sync. **States:** valid, already checked in, waitlisted, invalid token, offline pending. **Acceptance:** QR contains opaque signed token; minimal PII; idempotent check-in. **Exclude:** biometric identity.

## EL-10 — Live class list, create, and detail

**Routes:** `/dashboard/live-classes`, `/live-classes/new`, `/live-classes/[id]`. **Objective:** schedule a provider-backed session for an offering, publish join policy, notify participants, and track lifecycle. **Layout:** method/status filters; composer with class/section/subject/host/provider/time; detail with join controls, attendance linkage, provider events and recording policy. **Actions:** create provider session, publish, join, reschedule, cancel, sync status. **States:** waiting, live, ended, expired, provider degraded, sync failed. **Acceptance:** provider adapter, server-created credentials, timezone and roster validation, webhook idempotency. **Exclude:** exposing host secrets or promising recording availability.

## EL-11 — Live class reports and settings

**Routes:** `/dashboard/live-classes/reports`, `/settings/connections/live-classes`. **Objective:** reconcile scheduled, joined, duration, attendance-import status, and provider errors. **Layout:** class/teacher/provider filters, session timeline, reconciliation queue. **Actions:** import reviewed attendance, retry sync, export scoped report. **States:** no provider data, incomplete roster mapping, duplicate participant. **Acceptance:** meeting join data is evidence for review, not automatic definitive attendance. **Exclude:** surveillance metrics such as attention scoring.

## Verification prompt

Test lead conversion deduplication, consent and suppression, audience snapshot rules, bulk-job retry, provider event semantics, quiet hours/timezones, RSVP capacity races, QR replay, live-provider outage, roster mapping, Arabic/French templates, and direct URL authorization.
