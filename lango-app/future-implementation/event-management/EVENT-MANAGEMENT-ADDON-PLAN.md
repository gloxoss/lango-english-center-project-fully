# Event Management Add-on — Future Implementation Plan

Status: planned, not built. Product decisions are provisional pending owner review.

## Screen inventory

| # | Screen | Visible elements | Primary action |
|---|---|---|---|
| 1 | Events navigation | Event Type, Events | Configure a type or manage events |

The screenshot proves navigation only. The plan adds the minimum lifecycle needed for safe school event operations.

## Feature map against the current app

### Keep

- The dashboard calendar widget and its `CalendarEventItem` presentation contract.
- Existing tenant/branch, class/section, users, roles, communication and audit foundations.

### Change

- Replace dashboard placeholder/fallback events with a read model sourced from published events plus core holidays/exams.
- Generalize the display type beyond `vacation | holiday | exam | event` without coupling the dashboard to the add-on’s write model.

### Add

- Event types, draft/publish lifecycle, audiences, recurrence, venues/capacity, RSVP/registration, waitlists, consent, check-in, reminders, attachments, tasks, incidents, feedback and reports.
- Calendar/list/detail/admin/portal pages and iCalendar export/subscription.

### Remove

- Nothing. Placeholder calendar data should be replaced only when the real read model ships.

## Provisional decision gate

1. **Event scope:** school-controlled internal/public events, not an appointment marketplace; assumed.
2. **Registration:** support RSVP, capacity and waitlist, with payments deferred to an optional Finance integration; assumed.
3. **Audience:** target branches, roles, classes, sections, explicit groups and invited individuals; assumed.
4. **Recurrence:** RFC 5545-style recurrence with per-occurrence exceptions; assumed.

## Domain boundaries

Events owns event definitions, occurrences, audience targeting, invitations, registrations, check-in and event reporting. Academic schedules/exams and closure calendars stay authoritative in their domains and are projected into a unified calendar. Communication sends messages; Finance owns money; Attachments Book or secure storage owns files.

## Pages

- **Events dashboard:** upcoming, drafts awaiting action, registrations, capacity risks, check-in and post-event tasks.
- **Event types:** name, color/icon, defaults, visibility, approval requirement, RSVP/check-in policy and reusable checklist.
- **Calendar:** month/week/list views, branch/audience/type/status filters, conflict indicators and unified school-calendar layers.
- **Events list:** search, bulk publish/cancel, owner, date, venue, audience, registration and status.
- **Create/edit:** details, schedule/recurrence, venue or online link, audience, capacity, registration questions, consent, reminders, attachments and owners.
- **Event detail:** description, occurrence selector, audience, agenda, organizers, registration state, files, updates and safe share actions.
- **Registrations:** invited/going/maybe/declined/waitlisted/cancelled, custom answers, consent, companion count and exports.
- **Check-in:** QR/exact search, duplicate prevention, walk-in policy, live counts and offline-ready later phase.
- **Operations:** checklist/tasks, vendors/resources, incidents, announcements and change log.
- **Reports:** reach, registration funnel, attendance/no-show, capacity, audience breakdown, feedback and communication delivery.

## Core data model

- `eventTypes`: tenant, name, style, defaults, approval/check-in/registration policy and state.
- `events`: tenant, branch/owner, type, title, description, visibility, lifecycle, timezone, publication and cancellation metadata.
- `eventSchedules`: start/end, all-day, timezone, recurrence rule, recurrence end.
- `eventOccurrences`: materialized occurrence, original date, override/cancel state and version.
- `eventVenues`: physical/online/hybrid, address, capacity, accessibility and map/provider data.
- `eventAudienceRules`: target kind and target ID; resolved audiences are snapshots at publish/send time.
- `eventInvitations`: person/household, occurrence scope, delivery and response state.
- `eventRegistrations`: occurrence/person, status, seats, answers, consent, timestamps and idempotency.
- `eventWaitlistEntries`: ordered queue with offer/expiry state.
- `eventCheckins`: registration/person, occurrence, method, operator/device and immutable timestamp.
- `eventReminderRules`, `eventCommunicationJobs`, `eventAttachments`, `eventTasks`, `eventIncidents`, `eventFeedback`.
- `eventAuditEvents`: immutable lifecycle and sensitive-operation evidence.

## Lifecycle and business rules

- Event: `draft → pending_approval → published → completed`; alternate `cancelled` or `archived` paths.
- Materialize occurrences inside a bounded horizon; changes to a series require “this occurrence / this and future / entire series”.
- Store event timezone and UTC instants; render in user timezone. All-day events use local dates, not midnight UTC.
- Publication freezes an audience-resolution snapshot for invitations while still allowing policy-controlled late joins.
- Registration is transactional: validate visibility, eligibility, deadline and capacity; then confirm or waitlist. Idempotency prevents duplicate seats.
- Cancellation records reason, refunds via Finance if applicable, notification plan and occurrence/series scope.
- Waitlist promotion creates an expiring offer before confirmation; never silently enroll.
- Check-in never changes RSVP history and duplicate scans return the existing check-in.
- Sensitive student data, registration answers and attendee lists follow least visibility and retention rules.

## Unified calendar integration

Create a neutral `SchoolCalendarEntry` read model that projects published event occurrences, holidays/closures, exams and academic schedule milestones. The dashboard reads this projection and continues working when the Events add-on is disabled. Source modules retain write authority; the projection stores source type/id/version and never becomes a second source of truth.

Offer `.ics` export for an event and authenticated calendar feeds with revocable secrets. Do not expose private audience data in public feeds.

## API outline

- `/api/addons/events/types`, `/events`, `/events/:id`, `/events/:id/publish|cancel`
- `/api/addons/events/:id/occurrences`, `/occurrences/:id/register|respond|cancel`
- `/api/addons/events/occurrences/:id/checkins`, `/waitlist`, `/communications`
- `/api/addons/events/calendar`, `/calendar/feed.ics`, `/reports`

Use tenant/branch authorization, Zod, transactions, optimistic concurrency, idempotency, stable error codes, rate limits for public RSVP, and an outbox for reminders/projections.

## Permissions

- `events.read`, `events.create`, `events.manage_own`, `events.manage_all`, `events.approve`, `events.publish`, `events.registration.manage`, `events.checkin`, `events.communication.send`, `events.report.read`.
- Audience visibility is evaluated in addition to role permissions.
- Public events expose an explicit safe projection; internal fields and attendee lists remain private.

## Delivery blueprint

| Phase | Deliverable | Dependency |
|---|---|---|
| A | Add-on shell, permissions, event types, draft CRUD | Core identity/tenant |
| B | Scheduling, recurrence, occurrences, venues and conflict checks | A |
| C | Audience rules, approval, publishing and unified calendar projection | B |
| D | Invitations, RSVP, capacity, waitlist and member portal | C |
| E | Reminders/outbox, updates, cancellation and ICS feeds | C–D |
| F | Check-in, tasks/incidents, feedback, dashboards and reports | D–E |
| G | Optional ticket/payment, offline check-in and external provider sync | Proven demand |

## Acceptance and tracking

- Test recurrence/DST/timezone boundaries, exception edits, audience authorization, capacity races, waitlist offer expiry, duplicate RSVP/check-in and cancellation.
- Confirm the dashboard projection behaves correctly with the add-on enabled, disabled and rebuilding.
- Test students, guardians, staff and public viewers against field-level privacy rules.
- Track publish lead time, invitation delivery, view-to-RSVP conversion, capacity utilization, waitlist conversion, attendance/no-show, check-in throughput, cancellation and feedback.
- Add replayable projection jobs, dead-letter monitoring, retention controls, export/delete handling and rollback runbooks.

## Open-source references

- Frappe Education — education calendar/domain integration inspiration: https://github.com/frappe/education
- Cal.com — recurrence, availability and event-type concepts only: https://github.com/calcom/cal.com (license model must be reviewed; do not copy source into this commercial app without approval).
- FullCalendar — calendar interaction/reference implementation: https://github.com/fullcalendar/fullcalendar (verify the license of the exact packages/features selected).

Prefer the app’s existing React/Next.js primitives for UI and `date-fns` for basic formatting. Adopt a recurrence library only after RFC 5545 correctness, timezone, maintenance, bundle and license review.

