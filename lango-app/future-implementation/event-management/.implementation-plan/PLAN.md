# Event Management Add-on — Implementation Plan

> Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` FIRST. Read the source spec `EVENT-MANAGEMENT-ADDON-PLAN.md` in this same folder — its data model, lifecycle rules, API outline, and phased delivery plan (Phases A-G) are already thorough and are adopted directly by this plan rather than re-derived. This plan confirms the real starting point, resolves the source doc's 4 "provisional decisions," and right-sizes the build order.

## 1. Confirmed against the real codebase

- `CalendarEventItem` is real (`src/features/dashboard/ui/dashboard-calendar-widget.tsx:7-13`: `{ id, title, startDate, endDate, type: 'vacation'|'holiday'|'exam'|'event' }`), and `DashboardCalendarWidget` genuinely accepts an `events` prop — but **both real call sites pass no prop** (`dashboard-view.tsx:215`, `super-admin-dashboard-view.tsx:124`), so the widget's own hardcoded fallback ("Vacances d'Été", "Fête du Trône") always fires. This is not "real data plus a placeholder mix" as the source doc's "Change" section implies caution about — it's **100% placeholder, 0% real**, confirmed by reading both call sites. Simpler situation than feared: there's no live data path to preserve compatibility with, just a typed contract to fill.
- **No general events/holidays/academic-calendar table exists anywhere** (confirmed by grep across `Schema.ts`) — this is genuinely greenfield for the core domain, unlike most future-implementation work this session which extends something half-real.
- `alumniEvents`/`alumniEventRsvps` (`Schema.ts:607-654`) are a real, working structural precedent (event + RSVP-with-status pattern, `unique(eventId, alumnusId)`) but are alumni-scoped (`alumnusId`, not a generic participant concept) — useful as a shape reference for `eventRegistrations`, not directly reusable or extendable in place. Building a second, general-purpose events system alongside the alumni one is correct per the source doc's own domain-boundary reasoning (these serve different audiences and lifecycles) — don't try to generalize `alumniEvents` into this feature's foundation.

## 2. Resolving the source doc's 4 "provisional decisions" — confirmed as the right defaults, no changes

1. School-controlled internal/public events, not a marketplace — correct scope for a school SIS add-on.
2. RSVP + capacity + waitlist now, payments deferred to an optional Finance integration — correct; this app's finance module is real and tenant-specific, but wiring ticket payments into a first pass would double this plan's surface area for a feature (paid event tickets) most schools won't need on day one.
3. Audience = branches/roles/classes/sections/explicit groups/invited individuals — matches the audience-targeting pattern already proven twice this session (`isHomeworkVisibleToStudent`, attachments-book's `isAssetVisibleToUser`) — this plan reuses that exact pure-function shape (see §5), not a new design.
4. RFC 5545-style recurrence — correct, but see §3's scope cut: full RFC 5545 is a large surface, v1 narrows it.

## 3. Scope decision — the source doc's own Phase A-G blueprint, with one real cut

Adopt the source doc's delivery blueprint (Phases A-G) directly as this plan's build order — it's already well-sequenced (shell→scheduling→publishing→RSVP→reminders→check-in→optional payments). **One scope cut, matching the established discipline of not over-building recurrence/infra beyond what's proven needed**: v1 supports a bounded, practical recurrence subset (daily/weekly/monthly on fixed weekdays, with a per-occurrence override/cancel — covers the vast majority of real school recurring events: weekly club meetings, monthly assemblies) rather than the full RFC 5545 grammar (arbitrary BYDAY/BYSETPOS/COUNT/UNTIL combinations). Full RFC 5545 parsing is exactly the kind of "adopt a library only after real need is proven" call the source doc's own "Open-source references" section already flags ("Adopt a recurrence library only after RFC 5545 correctness, timezone, maintenance, bundle and license review") — build the bounded subset by hand (a small, real, testable pure function, matching this session's established pattern) and revisit only if a school genuinely needs a recurrence pattern the bounded subset can't express. Phases F ("offline check-in") and G (ticket/payment, external provider sync) stay deferred exactly as the source doc already scopes them ("Proven demand" gate) — no change needed there.

## 4. Schema

Build the source doc's "Core data model" section (`eventTypes`, `events`, `eventSchedules`, `eventOccurrences`, `eventVenues`, `eventAudienceRules`, `eventInvitations`, `eventRegistrations`, `eventWaitlistEntries`, `eventCheckins`, `eventReminderRules`, `eventCommunicationJobs`, `eventAttachments`, `eventTasks`, `eventIncidents`, `eventFeedback`, `eventAuditEvents`) verbatim as a new `src/features/events/models/events-schema.ts`, following the shared reference doc's conventions. Add one table the source doc doesn't explicitly list but its own "Unified calendar integration" section requires: `academicCalendarEntries` (or fold holidays/closures into `events` with a system-owned `eventType` like `'holiday'`/`'closure'` — pick whichever avoids a second parallel "thing on a calendar" concept; recommend folding into `events` with a `isSystemGenerated` flag, since the source doc's own `SchoolCalendarEntry` projection needs to merge holidays and real events into one unified read model anyway, and one source table is simpler than two feeding the same projection).

`eventAttachments` should point at the real attachments-book `BlobStore`/`digitalAssets` infrastructure built this session (per the source doc's own domain-boundary note: "Attachments Book or secure storage owns files") rather than a new upload mechanism — an event attachment is a `digitalAssetUsageLinks` row (`usageType: 'event'`, extending the enum this session's attachments-book work already defined) pointing at a real `digitalAssets` row, exactly like the homework-reuse integration already proven. Do not build a parallel file-upload path for event attachments.

## 5. The audience-resolution function — reuse the proven pattern, don't reinvent

New `src/features/events/services/audience-service.ts`, structurally identical to `isAssetVisibleToUser` (attachments-book) and `isHomeworkVisibleToStudent` (assessment): a pure function taking the event's `eventAudienceRules` rows and a resolved viewer context (role, sectionId, offeringIds, explicit group membership) and returning a boolean. Reuse `resolveStudentAudienceContext` (`src/libs/academics/audience-context.ts`, already shared between homework and attachments-book) for the section/offering resolution rather than re-deriving it a third time. Per the source doc's "Publication freezes an audience-resolution snapshot" rule: at publish time, resolve the full audience list once and store it in `eventInvitations` rows (a snapshot), not re-resolved live on every read — this is what makes "late joins" and audience-rule changes after publish behave correctly per the source doc's own stated policy.

## 6. Registration transaction safety

Per the source doc: "Registration is transactional: validate visibility, eligibility, deadline and capacity; then confirm or waitlist. Idempotency prevents duplicate seats." Implement this with the exact `db.transaction` + unique-constraint-backed pattern proven twice this session (attachments-book's version numbering, certificate-management's serial generation): re-check capacity inside the transaction, rely on a real unique constraint (`eventRegistrations` unique per `(occurrenceId, personId)`) to catch the race rather than trusting the pre-check alone, and catch-and-retry-as-waitlist on a capacity-exceeded collision rather than letting it surface as a raw 500.

## 7. Unified calendar projection

Per source doc §"Unified calendar integration": build a real `GET /api/calendar/projection` (or equivalent) that queries published `eventOccurrences` (+ the folded-in holiday/closure rows per §4) within a date range and maps them to `CalendarEventItem[]`, then wire both real call sites (`dashboard-view.tsx:215`, `super-admin-dashboard-view.tsx:124`) to actually pass this data as the `events` prop instead of nothing. This single change is what finally makes the dashboard widget's existing, already-correct `CalendarEventItem` contract mean something — confirmed the widget itself needs zero changes, only its callers do.

## 8. Suggested build order (Phases A-D are the real v1; E-G follow the source doc's own gating)

Adopt source doc Phases A→D as this plan's v1 scope (shell/permissions/types/draft CRUD → scheduling/recurrence/occurrences/venues → audience/approval/publish/calendar projection → invitations/RSVP/capacity/waitlist/portal). Phase E (reminders/outbox/ICS feeds) is real and valuable but genuinely separable — build it once A-D are live-verified, not in the same pass. Phases F/G stay deferred per the source doc's own demand-gating.

## 9. Acceptance checklist

- [ ] Both real dashboard call sites show live, real events/holidays after the projection is wired — confirmed by creating a real published event and seeing it appear on the actual dashboard, not by reading the projection code.
- [ ] Recurrence: a weekly event correctly materializes occurrences within the bounded horizon, and editing "this occurrence only" vs "this and future" vs "entire series" each produce the exact scoped change, verified live against real rows.
- [ ] Audience targeting: a class-section-targeted event is visible to a real student in that section and invisible to one in a different section (same live-verification rigor as attachments-book's targeting sweep).
- [ ] Registration capacity race: fire two concurrent registration requests at an event with 1 remaining seat, confirm exactly one succeeds and the other is waitlisted, not both succeeding or both failing.
- [ ] Check-in: a duplicate scan of an already-checked-in registration returns the existing check-in record, doesn't create a second one or alter RSVP history.
- [ ] Cross-tenant sweep on every new route.
- [ ] Disabling the add-on leaves the dashboard calendar projection either gracefully empty or falling back to the old hardcoded placeholder (confirm which, per the source doc's "dashboard reads this projection and continues working when the Events add-on is disabled" requirement) rather than erroring.
- [ ] `tsc --noEmit` and `check-tenant-isolation.ts` clean (baseline).
