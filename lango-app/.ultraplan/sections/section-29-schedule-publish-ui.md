# Section 29: Copy-preview UI + schedule-view publish controls

## Overview
Surfaces Section 28's version lifecycle in the actual schedule builder: a version selector (draft vs. published), a "Publier" button that calls the publish endpoint and shows any blocking conflicts, and a copy-preview step when starting a new draft from an existing version.

## Risk: [yellow, HIGH COLLISION RISK] - `schedule-view.tsx` has been actively dirty (edited by the other concurrent session) for the large majority of this session. Expect to hold this section until the file is stable - do not force an isolated-blob rewrite of a UI file this actively contested unless it's genuinely stalled for a long period, per this session's established judgment call on promotions-view.tsx.

## Dependencies
- Depends on: section-28
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: publishing a draft with a conflict shows the exact conflicting slots in the UI, matching the API's 409 response
- Test: switching the version selector between draft/published shows genuinely different slot sets when they differ

## Tasks

<task type="auto" id="29-01">
  <name>Add version selector + publish button to the schedule builder</name>
  <files>src/features/academics/ui/schedule-view.tsx (or its -page/-client split if the other session has restructured it by execution time - check current file structure first)</files>
  <action>
    Version dropdown (draft/published, from GET timetable-versions), "Nouveau brouillon" button (POST a new draft, optionally copied from the current published version), "Publier" button (POST publish, on 409 show the conflict list inline rather than a generic error toast). All existing slot CRUD in this file continues to work exactly as today, just scoped to whichever versionId is currently selected.
  </action>
  <verify>tsc --noEmit clean; full round-trip in the browser: create a draft, edit it, attempt to publish with a conflict, fix it, publish successfully</verify>
  <done>Draft/publish lifecycle fully usable from the existing schedule builder, no new page needed</done>
</task>
