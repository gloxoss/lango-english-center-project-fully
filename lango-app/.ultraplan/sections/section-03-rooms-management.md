# Section 03: Rooms Management

## Overview
`rooms-view.tsx` shows a hardcoded 4-row `MOCK_ROOMS` array. Only a stats-only `academics/room-utilization` API exists - no room CRUD route. Note: an unrelated dead `rooms` table already exists in Schema.ts (per MIGRATION-NOTES.md, orphaned from an old LMS structure) - this section must check whether that table is reusable or whether it's tied to the dead academic model and a fresh one is cleaner.

## Risk: [green] - simple CRUD, small backend, well-understood pattern

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 1

## TDD Test Stubs
- Test: POST /api/academics/rooms rejects duplicate room name within the same tenant
- Test: GET /api/academics/rooms is tenant-scoped
- Test: DELETE fails gracefully (not a 500) if the room is referenced by an exam session (once Section 02 exists) - for now, just verify DELETE tenant-scopes correctly

## Tasks

<task type="auto" id="03-01">
  <name>Check existing `rooms` table reusability, migrate if needed</name>
  <files>src/models/Schema.ts, migrations/00XX_add_academic_rooms.sql (new, only if the old table isn't reusable)</files>
  <action>
    Read the existing `rooms` table definition in Schema.ts and MIGRATION-NOTES.md's note on it. If it has tenantId, name, capacity (or close enough to extend cheaply), reuse it - add only the columns actually missing. If it's tied to the dead LMS `programs`/`courses` model with no clean path, create a new `academicRooms` table instead (tenantId, name, capacity, roomType, isActive). Prefer reuse - don't create a second table needlessly.
  </action>
  <verify>docker compose run migrate clean; drizzle-kit check passes</verify>
  <done>One clear, tenant-scoped rooms table exists, decision documented in a code comment either way</done>
</task>

<task type="auto" id="03-02">
  <name>Build /api/academics/rooms route (GET/POST/PUT/DELETE)</name>
  <files>src/app/api/academics/rooms/route.ts (new)</files>
  <action>
    Standard reference-data CRUD, matching src/app/api/academics/mediums/route.ts exactly in shape. requireRequestContext(['school_admin']), requireCapability(context, 'academics.manage').
  </action>
  <verify>manual curl round-trip; duplicate-name rejection test passes</verify>
  <done>Full CRUD works, tenant-isolated, admin-only, duplicate names rejected within a tenant</done>
</task>

<task type="auto" id="03-03">
  <name>Wire rooms-view.tsx to the real route, remove MOCK_ROOMS</name>
  <files>src/features/academics/ui/rooms-view.tsx</files>
  <action>
    Replace MOCK_ROOMS with a real fetch to GET /api/academics/rooms. Wire create/edit/delete forms to the route. Replace literal KPI strings ("38 Locaux", "68%") with real counts from the fetched list; if the 68% figure represents utilization, pull it from the existing academics/room-utilization endpoint instead of fabricating it.
  </action>
  <verify>tsc --noEmit clean; fresh-tenant empty state, real rows after create</verify>
  <done>No MOCK_ROOMS reference remains</done>
</task>
