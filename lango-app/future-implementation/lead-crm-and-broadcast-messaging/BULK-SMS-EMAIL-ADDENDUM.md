# Bulk SMS and Email — Lead/Broadcast Add-on Addendum

Status: planned extension of `LEAD-CRM-AND-BROADCAST-MESSAGING.md`; provisional decisions pending owner review.

## Screen inventory

| # | Screen | Visible pages | Primary action |
|---|---|---|---|
| 1 | Bulk SMS and Email | Send SMS / Email; SMS / Email Report; SMS Template; Email Template; Student Birthday Wishes; Staff Birthday Wishes | Operate bulk communication |

## Feature map

- **Keep:** the existing plan's Channel Connections, Segments, Campaign Builder, Templates and Delivery Reports.
- **Change:** SMS and Email Template become channel-filtered views of one versioned template engine.
- **Change:** Send SMS / Email becomes the existing campaign composer with recipient preview, test send, approval and scheduling.
- **Change:** SMS / Email Report becomes the shared immutable campaign/delivery report filtered by channel.
- **Add:** student/staff birthday wishes as presets over one generic automation engine.
- **Remove:** nothing; channels absent from this screenshot remain independently useful.

## Provisional decisions

1. Send student messages to guardians by default when the student is underage.
2. Use one template engine with channel-specific, locale-specific variants and typed allowlisted variables.
3. Model birthdays as scheduled automations with timezone, quiet hours, approval and deduplication—not hard-coded cron routes.
4. Start with email plus one Morocco-capable SMS provider behind provider-neutral interfaces.

## Pages and logic

### Send SMS / Email

Route: `/dashboard/broadcast/campaigns/new`.

- Select channel/connection, live or saved segment, template/version, locale and schedule.
- Preview recipients, invalid/missing contacts, consent/suppression exclusions, duplicates, examples and estimated SMS segments/cost.
- Lifecycle: `draft → pending_approval → scheduled → sending → completed`; allow pause/cancel/failure paths.
- Snapshot recipients and template version at approval. Queue one idempotent delivery per recipient/channel; never send a bulk campaign in the HTTP request.
- Workers apply tenant/provider limits, retry transient errors with jitter, dead-letter permanent errors and consume authenticated replay-protected webhooks.
- Calculate GSM-7/UCS-2 segments for SMS. Email requires HTML + plain text, safe links, sender authentication, bounce/complaint suppression and preference links when applicable.

### SMS / Email Report

Route: `/dashboard/broadcast/reports`.

- Show targeted, excluded, queued, provider-accepted, delivered, bounced/undeliverable, complained, clicked/opened where available, cost and failures.
- Recipient drill-down includes redacted contact, template/version, provider reference, status evidence and safe retry eligibility.
- Never equate `sent` with `delivered`; label opens as unreliable provider-reported signals.
- Exports require permission and mask personal data by default.

### SMS Template / Email Template

Route: `/dashboard/broadcast/templates?channel=sms|email`.

- Shared identity with channel variant, locale, subject/preheader, body, variable schema, category, status, version and provider approval.
- Missing variables fail preview; published versions are immutable and edits create drafts.
- Sanitize email HTML, forbid scripts/unsafe URLs, preview plain text and run accessibility checks.

### Student / Staff Birthday Wishes

Route: `/dashboard/broadcast/automations/birthdays`.

- One automation parameterized by audience kind, date source, eligibility, channel preference, template, timezone, send time, quiet hours and approval mode.
- Daily scheduler atomically claims runs. Unique `(automation, person, localBirthdayYear, channel)` prevents duplicates.
- Handle Feb 29 policy, inactive people, missing birth dates, guardian routing, consent, branch timezone and weekends/holidays.
- Provide next-run preview, test, pause/resume, skip-person, audit and run report.

## Data and APIs

Add `communicationConnections`, `communicationTemplates`, `communicationTemplateVersions`, `communicationSegments`, `communicationCampaigns`, `communicationCampaignRecipients`, `communicationDeliveries`, `communicationDeliveryEvents`, `communicationSuppressions`, `communicationConsents`, `communicationAutomations` and `communicationAutomationRuns`.

- `/api/addons/broadcast/campaigns`, `/preview`, `/:id/approve|schedule|pause|cancel`
- `/api/addons/broadcast/templates`, `/:id/versions`, `/:id/publish`
- `/api/addons/broadcast/reports`, `/deliveries/:id`, `/deliveries/:id/retry`
- `/api/addons/broadcast/automations`, `/:id/test|pause|resume`, `/:id/runs`
- `/api/webhooks/communication/:provider` with signature/timestamp/replay verification.

Credentials are encrypted tenant secrets. Templates use context-specific escaping. Consent/suppression is enforced at snapshot and immediately before send.

## Delivery order

| Phase | Deliverable |
|---|---|
| B1 | Provider contracts, encrypted connections, permissions and template versions |
| B2 | Email, campaign composer, snapshots, worker/outbox and basic report |
| B3 | SMS, encoding/cost preview, receipts and suppression |
| B4 | Segments, approval, scheduling, retry/dead-letter and reports |
| B5 | Generic automation engine and two birthday presets |
| B6 | Preferences, localization, analytics and more providers |

## Acceptance and references

Test tenant isolation, consent, guardian routing, deduplication, escaping, webhook spoof/replay, retry storms, DST/timezone and Feb 29. Track queue latency, acceptance, confirmed delivery, bounce/complaint, permanent failure, SMS cost and duplicate automation sends (target zero).

- Novu workflows/providers: https://github.com/novuhq/novu
- listmonk campaign/report UX: https://github.com/knadh/listmonk
- Jasmin SMS gateway concepts: https://github.com/jookies/jasmin

Review exact licenses and use these as architectural references unless adoption is explicitly approved.

