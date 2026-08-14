# Section 06: Alumni Events & RSVP

## Overview
Implements the PRD's "Alumni events" Must Have using the new, self-contained `alumniEvents`/`alumniEventRsvps` tables from section-01 — not blocked on the separate, unbuilt general event-management addon, per the discovery decision.

## Risk: green - straightforward real CRUD + RSVP over new, simple tables
No security-sensitive or novel logic — same shape as every other real CRUD feature built this session.

## Dependencies
- **Depends on:** section-01, section-03
- **Blocks:** none
- **Parallel batch:** 3

## TDD Test Stubs
- Test: Staff creating a real event makes it visible to alumni immediately.
- Test: An alumnus RSVPing sets a real, tenant-scoped, self-scoped row; RSVPing again updates rather than duplicates (unique constraint on event+alumnus).
- Test: An alumnus can change their RSVP from "going" to "not going" and it persists correctly.
- Test: Staff can see a real, accurate RSVP count/breakdown per event.

## Tasks

<task type="auto" id="06-01">
  <name>Build staff event CRUD</name>
  <files>src/app/api/students/alumni/events/route.ts</files>
  <action>
    New file. GET (staff, cap `admissions.manage` for management view — list all events with real RSVP counts per status, grouped via a single aggregate query, not N+1, real pagination via `parsePagination`). POST/PUT/DELETE (same cap): real CRUD on `alumniEvents`, Zod `.strict()` schemas, `recordAudit()` on mutations.
  </action>
  <verify>Create, edit, and delete a real test event as staff via curl; confirm RSVP counts aggregate correctly once task 06-02 produces real RSVPs.</verify>
  <done>Staff have real, working event CRUD with accurate RSVP aggregates.</done>
</task>

<task type="auto" id="06-02">
  <name>Build alumni-facing event list + RSVP endpoint</name>
  <files>src/app/api/alumni/me/events/route.ts, src/app/api/alumni/me/events/[id]/rsvp/route.ts</files>
  <action>
    `GET .../events`: `requireRequestContext(request, ['alumni'])`, real tenant-scoped upcoming events list, each annotated with the current alumnus's own RSVP status if one exists. `POST .../[id]/rsvp`: Zod `.strict()` schema `{status: 'going'|'not_going'|'maybe'}`, upsert (insert-or-update) on the unique `(eventId, alumnusId)` pair, matching the same upsert pattern already used for admission interviews in this session's prior plan.
  </action>
  <verify>As the real test alumnus, list events and RSVP; RSVP again with a different status and confirm the same row updates (verified via psql — one row, not two).</verify>
  <done>Alumni can see real events and RSVP with a real, idempotent upsert.</done>
</task>

<task type="auto" id="06-03">
  <name>Wire staff and alumni events UI</name>
  <files>src/features/students/ui/alumni-events-view.tsx, src/app/[locale]/(alumni-portal)/alumni/events/page.tsx</files>
  <action>
    Staff-side: real event CRUD screen under `/dashboard/students/alumni/events`, wired to task 06-01, showing real RSVP counts. Alumni-side: real event list inside the portal shell with a real RSVP control per event, wired to task 06-02, with a real, honest empty state ("Aucun événement à venir") when there are none.
  </action>
  <verify>In the browser: create a real event as staff, RSVP as the test alumnus, confirm the staff view's RSVP count updates.</verify>
  <done>Both staff and alumni event screens are real and working end to end.</done>
</task>
