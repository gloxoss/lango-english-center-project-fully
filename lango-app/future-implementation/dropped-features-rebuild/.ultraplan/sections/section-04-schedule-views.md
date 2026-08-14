# Section 04: Schedule — teacher and room views

## Overview
Implements the PRD's "Schedule by teacher or by room" Must Have. No schema change — `classScheduleSlots` already carries `teacherId` (FK) and `roomLabel` (free text) on every real slot; the existing route already force-scopes teachers to their own slots and lets admins pass `?teacherId=`. This section only adds a room-label filter and a client-side view-mode toggle over the same real data. Deliberately small per the discovery decision that this area needed a UX addition, not new schema.

## Risk: green - pure read-side addition over already-real, already-validated data
No writes, no new tables, no new capability. The only real risk is grouping logic bugs (e.g. slots with no `roomLabel` disappearing silently instead of showing under an "unassigned" bucket) — low severity, easy to catch in manual verification.

## Dependencies
- **Depends on:** none (no schema dependency on section-01)
- **Blocks:** none
- **Parallel batch:** 1

## TDD Test Stubs
- Test: Switching to teacher view and selecting a real teacher shows exactly that teacher's real slots across every class section, matching what the existing per-class view shows when checked slot-by-slot.
- Test: Switching to room view groups slots by their real `roomLabel` string; a slot with no `roomLabel` set appears under an honest "Salle non assignée" group instead of vanishing.
- Test: Class view (the existing default) is pixel-for-pixel unchanged by this section.

## Tasks

<task type="auto" id="04-01">
  <name>Add roomLabel filter to timetable-slots route</name>
  <files>src/app/api/academics/timetable-slots/route.ts</files>
  <action>
    Read the existing file. Add an optional `?roomLabel=` query param to the GET handler, filtering `classScheduleSlots` by exact `roomLabel` match when provided, alongside the existing `classSectionId`/`teacherId`/`offeringId`/`versionId` filters (all remain unchanged). No new capability needed — reuses the existing `academics.read`/teacher-scoping logic already in the handler.
  </action>
  <verify>GET with `?roomLabel=Salle 12` returns only real slots with that exact label. Omitting the param behaves exactly as before this change (no regression).</verify>
  <done>The existing timetable-slots GET route supports an additional real roomLabel filter with no change to prior behavior.</done>
</task>

<task type="auto" id="04-02">
  <name>Add teacher/room view toggle to Schedule UI</name>
  <files>src/features/academics/ui/schedule-client.tsx</files>
  <action>
    Read the existing file. Add a view-mode toggle (Classe / Enseignant / Salle). In teacher mode, fetch real teachers (existing teachers list endpoint) for a selector, then fetch slots via `?teacherId=`. In room mode, derive the distinct set of real `roomLabel` values from an initial unfiltered slots fetch (or a dedicated lightweight fetch) for a selector, then fetch via `?roomLabel=` from task 04-01, grouping slots with no `roomLabel` under an explicit "Salle non assignée" section. Keep the existing class-view day-list rendering completely untouched — new modes reuse the same day-list rendering component, just with differently-filtered data.
  </action>
  <verify>In the browser: switch to teacher view, pick a real teacher, confirm the slots shown match that teacher's real assignments. Switch to room view, confirm slots group correctly including any unassigned-room slots.</verify>
  <done>The Schedule page offers real teacher and room views over the same real slot data, with class view unchanged.</done>
</task>
