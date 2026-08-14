# Section 28: Timetable draft/publish versions

## Overview
The biggest remaining piece of Phase 3: today's `classScheduleSlots` is one live table with no concept of draft vs. published. This section adds `timetableVersions` (scoped per tenant+sessionYear, status draft/published/archived) and a `versionId` on `classScheduleSlots`, so a school can build next term's schedule without touching the live one, and publishing becomes an explicit, validated action instead of implicit.

## Risk: [red] - the single highest-uncertainty section in this plan. Changes what "the" timetable means for every reader (schedule-view, conflicts-view, teacher-schedule - all three built/wired this session). Requires careful backfill so today's live slots become a "published v1" version with zero disruption, and this section's own validation reuses `assertSlotIsValid` at the version level, not just per-slot.

## Dependencies
- Depends on: none (scoped by sessionYearId at the tenant level, does not require section-22's offeringId to exist)
- Blocks: section-29
- Parallel batch: 3

## TDD Test Stubs
- Test: backfill creates exactly one 'published' version per tenant+sessionYear that has existing slots, and every existing slot's versionId points to it - zero data loss, zero slot becomes invisible
- Test: a draft version can be edited freely without any effect on what schedule-view/teacher-schedule display (they only ever read the published version)
- Test: publishing a draft with zero conflicts succeeds and the previously-published version (if any) becomes 'archived'
- Test: publishing a draft with an unresolved conflict (reuse assertSlotIsValid's overlap logic across the whole draft, not just per-slot) is rejected with the specific conflicting slot pairs listed
- Test: only one 'published' version exists per tenant+sessionYear at any time

## Tasks

<task type="auto" id="28-01">
  <name>Add timetableVersions table + versionId on classScheduleSlots</name>
  <files>src/models/Schema.ts, migrations/00XX_add_timetable_versions.sql (new), migrations/meta/_journal.json</files>
  <action>
    New pgTable timetableVersions: id, tenantId, sessionYearId (fk sessionYears), status (new pgEnum timetableVersionStatus: draft/published/archived), versionNumber (integer), effectiveFrom/effectiveTo (date, nullable), createdBy (text, fk user), publishedBy (text, fk user, nullable), publishedAt (timestamp, nullable), copiedFromVersionId (uuid, nullable, fk to self), createdAt. Partial unique index: one 'published' status per (tenantId, sessionYearId). Add versionId (uuid, nullable at the column level but the app will always set it) to classScheduleSlots with an fk to timetableVersions, onDelete cascade.
  </action>
  <verify>docker compose build migrate; drizzle-kit check passes</verify>
  <done>Tables/columns defined, partial unique index enforced at the DB level</done>
</task>

<task type="auto" id="28-02">
  <name>Write the migration + backfill into a synthetic "published v1"</name>
  <files>migrations/00XX_add_timetable_versions.sql (same file as 28-01 or immediately following, per next available number)</files>
  <action>
    For every tenant+sessionYear pair that has at least one existing classScheduleSlots row (join to classSections -> figure out session via section-22's offeringId if that section has landed by execution time, otherwise fall back to the tenant's default sessionYear - re-check which is true at execution time, do not assume), insert one timetableVersions row with status='published', versionNumber=1, publishedAt=now(), createdBy/publishedBy = a system marker or the tenant's first school_admin user. Then UPDATE classScheduleSlots SET version_id = that version's id for all of that tenant+session's existing rows.
  </action>
  <verify>docker compose run --rm migrate; confirm zero classScheduleSlots rows have a NULL versionId after migration; confirm schedule-view/conflicts-view/teacher-schedule still show identical data to before this migration</verify>
  <done>Every existing slot belongs to exactly one published version, nothing changes visibly for existing users</done>
</task>

<task type="auto" id="28-03">
  <name>Version-aware timetable-versions route + publish action</name>
  <files>src/app/api/academics/timetable-versions/route.ts (new), src/app/api/academics/timetable-versions/publish/route.ts (new)</files>
  <action>
    GET (list versions for a sessionYear), POST (create a new draft - optionally copiedFromVersionId to clone an existing version's slots into the new draft, reusing the same copy-with-preview shape as section-23's endpoint for consistency). Publish endpoint: POST { versionId }, requireCapability 'academics.manage' - runs assertSlotIsValid's conflict-detection logic (extend timetable-validation.ts with a bulk `findVersionConflicts(tenantId, versionId)` function reusing the existing `overlaps` helper) across every slot in the draft; if any conflict exists, return 409 with the full list, do not publish; if clean, in one transaction: set the current published version (if any) to 'archived', set this version to 'published' with publishedAt/publishedBy.
  </action>
  <verify>manual test: create a draft, add a conflicting pair of slots, attempt publish (expect 409 with details), remove the conflict, publish again (expect success, old version archived)</verify>
  <done>Publish is blocked by any real conflict, never silently allows one through</done>
</task>

<task type="auto" id="28-04">
  <name>Update timetable-slots route to be version-aware</name>
  <files>src/app/api/academics/timetable-slots/route.ts, src/libs/services/timetable-validation.ts</files>
  <action>
    POST/PUT now require a versionId (the draft being edited) instead of writing directly against "the" timetable. GET gains an optional ?versionId= filter; when omitted, defaults to the tenant+sessionYear's currently published version (this is what schedule-view/conflicts-view/teacher-schedule should call without any changes to those three files - the default-to-published behavior means their existing unfiltered GET calls keep working unchanged). assertSlotIsValid's conflict scan is scoped to slots within the same versionId, not tenant-wide, since two different drafts should be free to independently experiment without seeing each other's slots as conflicts.
  </action>
  <verify>tsc --noEmit clean; confirm schedule-view/conflicts-view/teacher-schedule (all built earlier this session, unmodified by this task) still work identically since they default to the published version</verify>
  <done>Editing requires an explicit draft; reading defaults to published; zero visible change to the three pages built earlier this session</done>
</task>
