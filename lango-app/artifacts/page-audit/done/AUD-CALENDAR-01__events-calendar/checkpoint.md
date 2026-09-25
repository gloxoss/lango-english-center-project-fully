# AUD-CALENDAR-01 — CHECKPOINT (resume point)

- task: AUD-CALENDAR-01 — Events & Calendar + Institutional Scheduling
- agent: codex-2 (Executor C)
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-CALENDAR-01`
- branch: `audit/agent-c/AUD-CALENDAR-01-events-calendar`
- hub claims held: `task:AUD-CALENDAR-01`, `task:port-3463`
- collision check before claim: CLEAN (AUD-SAFETY-01 holds guard only)
- dev: port 3463, NEXT_DIST_DIR=.next-agentc, DATABASE_URL -> schoolos_audit
- node_modules: `npm install --ignore-scripts` DONE
- **EDIT IN THE WORKTREE.** Bash heredocs mangle backslashes; use plain strings.

## AUD-PLATFORM-01 IS NOT ABANDONED
Branch `audit/agent-c/AUD-PLATFORM-01-platform-entitlements` is pushed and its
checkpoint preserved at
`lango-app/artifacts/page-audit/done/AUD-PLATFORM-01__platform-entitlements/checkpoint.md`.
State: BLOCKED — MISSING SUPER_ADMIN TOTP ACCESS. Do not reset it.

## SCOPE (discovered, not assumed)
OWNED:
  src/features/events/**            (2272 lines: event-operations-service 1046,
                                     events-service 415, events-schema 277,
                                     audience-service 92 + existing tests)
  src/app/api/addons/events/**      (28 routes: audiences, occurrences, publish,
                                     cancel, registrations, waitlist, checkins,
                                     tasks, venues, incidents, feedback,
                                     attachments, feed.ics, communications,
                                     reports, types, calendar)
  src/app/api/public/events/[tenantSlug]
  /dashboard/events, /dashboard/events/[id]
ADJACENT, READ-ONLY (frozen / other owners — audit and report, do not edit):
  /dashboard/academics/calendar  -> renders AcademicCalendarView from
                                    src/features/academics (Academics is frozen)
  /dashboard/academics/{schedule,teacher-schedule}  (timetable, frozen)
  /dashboard/reports/schedules, /dashboard/settings/scheduled-jobs
  /dashboard/students/alumni/events, api/alumni/me/events, api/academics/meeting-slots
  api/guardian/me/children/[id]/meetings
Frozen: Communication delivery. If Calendar triggers SMS/email, verify the
integration against the frozen truth contract, do not redesign delivery.

## MODEL (17 tables)
event_types, events, event_schedules, event_occurrences, event_venues,
event_audience_rules, event_invitations, event_registrations, event_waitlist_entries,
event_checkins, event_reminder_rules, event_communication_jobs, event_attachments,
event_tasks, event_incidents, event_feedback, event_audit_events
Recurrence enum: none | daily | weekly | monthly, with recurrenceEndDate.
`events.timezone` / `event_schedules.timezone` default **'UTC'**.

## DESIGN NOTE (do not "fix" without cause)
`parseUtcString` re-appends Z to the naive DB text so ALL recurrence math runs in
one UTC frame; `originalDate` = UTC date slice; `addInterval` uses UTC date math.
This is self-consistent and DST-free while Morocco holds a fixed offset, and
`recurrence-boundary.test.ts` already covers it. Leave it alone.

## VERIFIED STRONG
- cancelEvent: `for('update')` lock, 409 ALREADY_CANCELLED (idempotent), sets
  lifecycle/cancelledAt/reason, cancels ALL occurrences in the same tx, writes
  event_audit_events. History preserved (row never deleted).
- Audience enforcement applied per role at events-service.ts:224-226
  (family roles -> canViewPublishedEvent; staff -> targeted + isEventVisibleToUser),
  plus per-route guards on [id], attachments, feed.ics, occurrences, venues.
  canViewPublishedEvent requires published AND not internal AND target match.
- Audience kinds: school | role | class_offering | class_section | class_subject |
  user | group.

## FINDING + FIX (DONE)
F-01 MED  `POST /api/addons/events` accepted endTime <= startTime. Its inline
          schedule schema had no order check (the refine in libs/api/validation.ts
          belongs to a different schema), and buildOccurrenceRows clamps a
          negative duration to ZERO, so a degenerate schedule materialised
          zero-length occurrences instead of failing.
          FIX: `.refine(s => s.startTime < s.endTime)` on the schedule object.
          SAFE for overnight events: times are absolute instants, so
          22:00 Sep24 -> 02:00 Sep25 has end > start and still passes. Only
          end-at-or-before-start is rejected.
TEST: src/features/events/__tests__/schedule-boundaries.test.ts (5 cases):
      overnight preserved across recurrence; degenerate schedule produces
      zero-length occurrences (evidence for the guard); recurrence end date is
      inclusive; runaway series capped at 366; the route validates order.
RESULT: 38/38 across src/features/events (5 files, incl. pre-existing
      audience-service, event-operations-service, recurrence-boundary).

## NEXT EXACT ACTION
1. Read /tmp/agentc-cal-gates.log (types/isolation/i18n/i18n:keys/ui/eslint).
2. Finish the sweep on 3463 (school_admin x3 + student + parent visibility).
3. Mobile 390 + AR RTL on /dashboard/events (the main changed/important route).
4. report.md from shared/REPORT_TEMPLATE.md: full route matrix + the lifecycle
   proof (create -> audience/branch -> schedule -> publish -> visibility ->
   update/cancel -> reminders -> historical record) and the brief's checklist
   (recurring correctness, timezone, Casablanca dates, overnight, duplicates,
   cancellation truth, stale reminders, unauthorized edits, historical integrity).
   Note reminders/comms are frozen-adjacent: verify integration only.
5. commit -> push -> `hub done task:AUD-CALENDAR-01` -> release both -> stop.
