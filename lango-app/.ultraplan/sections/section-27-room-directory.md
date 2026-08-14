# Section 27: Room directory

## Overview
A small, real room/facility directory (name, capacity, type) the timetable can reference instead of a free-text label. Per the existing ponytail comment in Schema.ts, the pre-existing `rooms` table is dead LMS boilerplate tied to a `buildings` chain this app doesn't use - this section creates a fresh, small `academicRooms` table instead of reviving it.

## Risk: [yellow, HIGH COLLISION RISK] - check before starting: this exact feature (rooms-view.tsx + an academics/rooms route) was mid-build by the other concurrent session earlier the same day this plan was written, under the prior mock-data-remediation plan's own Section 03. Re-verify via `git status` and by checking whether `src/app/api/academics/rooms/route.ts` already exists and is real before writing a single line - if it's already done, skip this section entirely and note it in this plan's index rather than duplicate/conflict with it.

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: POST /api/academics/rooms rejects a duplicate room name within the same tenant
- Test: GET is tenant-scoped
- Test: classScheduleSlots.roomLabel can optionally be backed by a real roomId once this table exists (additive - roomLabel free-text stays valid for tenants that never populate the directory)

## Tasks

<task type="auto" id="27-00">
  <name>Collision/duplication check (must run first, before any other task in this section)</name>
  <files>(read-only)</files>
  <action>
    Check git status on src/features/academics/ui/rooms-view.tsx and search for src/app/api/academics/rooms/route.ts. If a real (non-mock) rooms CRUD route already exists from the other session's concurrent work, STOP - this section is already done by someone else. Update sections/index.md to mark Section 27 complete-by-other-session and move on to Section 28 instead of duplicating the work.
  </action>
  <verify>n/a - this is the verification step itself</verify>
  <done>Either confirmed not yet built (proceed to 27-01) or confirmed already built (section marked done, skip remaining tasks)</done>
</task>

<task type="auto" id="27-01">
  <name>Add academicRooms table</name>
  <files>src/models/Schema.ts, migrations/00XX_add_academic_rooms.sql (new), migrations/meta/_journal.json</files>
  <action>
    New pgTable academicRooms: id, tenantId, name, capacity (integer, nullable), roomType (varchar, nullable - e.g. classroom/lab/gym), isActive (boolean default true), createdAt. Unique (tenantId, name). Do not touch or revive the existing dead `rooms`/`buildings` tables - this is a deliberately separate, small table.
  </action>
  <verify>docker compose build migrate; run it; drizzle-kit check passes</verify>
  <done>New table live, no interaction with the dead rooms/buildings chain</done>
</task>

<task type="auto" id="27-02">
  <name>Build /api/academics/rooms CRUD + wire rooms-view.tsx</name>
  <files>src/app/api/academics/rooms/route.ts (new), src/features/academics/ui/rooms-view.tsx</files>
  <action>
    Standard reference-data CRUD matching src/app/api/academics/mediums/route.ts's shape exactly (this session's established pattern for simple lookup tables). Wire rooms-view.tsx to it, removing any mock data. Add an optional roomId select (backed by this table) to the timetable-slots create/edit form alongside the existing free-text roomLabel field - populating roomId also fills roomLabel from the room's name, but roomLabel stays independently editable for tenants that haven't adopted the directory.
  </action>
  <verify>tsc --noEmit clean; full CRUD round-trip; timetable slot creation still works with either a picked room or free text</verify>
  <done>Real room directory, wired UI, optional (not forced) adoption by the timetable</done>
</task>
