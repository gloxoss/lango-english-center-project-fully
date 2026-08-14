# Section 30: Promotion wizard backend support (capacity headroom)

## Overview
Extends the already-real `/api/students/promotions/preview` endpoint (shipped earlier this session, currently unused by any UI) to also report capacity headroom for candidate target offerings, using Section 21's new `capacity` column. No new tables - this is a small, targeted extension of an existing route.

## Risk: [green] - one route extension, capacity column already exists from section 21

## Dependencies
- Depends on: section-21
- Blocks: section-31
- Parallel batch: 4

## TDD Test Stubs
- Test: preview response includes, for a given target offering, current occupied count vs. capacity (null capacity = "no limit set", not treated as zero)
- Test: existing preview behavior (grade-based promote/retain/defer recommendation) is completely unchanged - this is additive, not a rewrite

## Tasks

<task type="auto" id="30-01">
  <name>Extend /promotions/preview with capacity headroom</name>
  <files>src/app/api/students/promotions/preview/route.ts</files>
  <action>
    Accept an optional ?targetOfferingId= param. When present, look up that offering's capacity (from section-21's academicClassOfferings) and count of students currently active in its linked classSection (via user.classSectionId, matching how occupancy is counted everywhere else in this app), add `targetCapacity: { capacity: number | null, occupied: number, headroom: number | null }` to the response's `meta`. When capacity is null, headroom is null (meaning "not tracked", never treated as zero/full). Existing response shape (per-student recommendations) is untouched.
  </action>
  <verify>manual test against a real tenant with a capacity-limited offering close to full</verify>
  <done>Preview optionally reports real capacity headroom without changing any existing field</done>
</task>
