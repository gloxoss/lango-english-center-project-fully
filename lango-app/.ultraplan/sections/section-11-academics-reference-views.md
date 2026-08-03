# Section 11: Academics Reference Views

## Overview
Four pages with hardcoded arrays but real, already-wired-elsewhere backends: `classes-view.tsx` (api/academics/classes), `schedule-view.tsx` (api/academics/timetable-slots + conflicts + copy), `class-subjects-view.tsx` (api/academics/class-subjects), `class-section-teachers-view.tsx` (api/academics/class-teachers, subject-teachers, teachers). Plus one policy task: swap `syllabus-view.tsx` for the previously-decided "coming soon" placeholder instead of building a syllabus backend (no schema concept exists, not worth inventing per this session's earlier established decision).

## Risk: [green] - all backends already exist and are proven (some wired with academics.manage this session), pure frontend wiring

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- (All backends already tested/verified this session - frontend-only wiring, no new automated tests needed.)

## Tasks

<task type="auto" id="11-01">
  <name>Wire classes-view.tsx to real classes/mediums/streams/shifts APIs</name>
  <files>src/features/academics/ui/classes-view.tsx</files>
  <action>Remove INITIAL_CYCLES/INITIAL_STREAMS/INITIAL_MODELS/INITIAL_CLASSES. Fetch real data from api/academics/classes, mediums, streams, shifts on mount. Wire create/edit/delete forms to those routes.</action>
  <verify>tsc --noEmit clean; fresh-tenant empty state, real rows after create</verify>
  <done>No INITIAL_* hardcoded arrays remain</done>
</task>

<task type="auto" id="11-02">
  <name>Wire schedule-view.tsx to real timetable-slots API</name>
  <files>src/features/academics/ui/schedule-view.tsx</files>
  <action>Remove MOCK_SLOTS. Fetch real data from api/academics/timetable-slots, wire the weekly grid builder to create/edit/delete real slots, surface conflicts via the existing timetable-conflicts detection.</action>
  <verify>tsc --noEmit clean; double-booking a teacher through the UI surfaces via the real conflict detection</verify>
  <done>No MOCK_SLOTS reference remains</done>
</task>

<task type="auto" id="11-03">
  <name>Wire class-subjects-view.tsx to real class-subjects API</name>
  <files>src/features/academics/ui/class-subjects-view.tsx</files>
  <action>Remove MOCK_ASSIGNMENTS. Fetch real data from api/academics/class-subjects, wire assignment create/edit/delete.</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_ASSIGNMENTS reference remains</done>
</task>

<task type="auto" id="11-04">
  <name>Wire class-section-teachers-view.tsx to real class-teachers/subject-teachers APIs</name>
  <files>src/features/academics/ui/class-section-teachers-view.tsx</files>
  <action>Remove MOCK_TEACHERS workload array. Fetch real teacher assignment data from api/academics/class-teachers, subject-teachers, and api/teachers for workloadHours (already a real column per this session's earlier audit).</action>
  <verify>tsc --noEmit clean</verify>
  <done>No MOCK_TEACHERS reference remains</done>
</task>

<task type="auto" id="11-05">
  <name>Replace syllabus-view.tsx with the coming-soon placeholder</name>
  <files>src/features/academics/ui/syllabus-view.tsx</files>
  <action>Remove MOCK_CHAPTERS and the fake charts entirely. Reuse the coming-soon placeholder pattern already established in src/features/super-admin/ui/coming-soon-view.tsx - import/reuse it directly if generic enough, otherwise copy its structure. This is a deliberate scope decision from earlier this session, not a new one: no syllabus schema concept exists in this app or the ESchool reference project.</action>
  <verify>tsc --noEmit clean; page renders an honest "coming soon" state, no fake data</verify>
  <done>No MOCK_CHAPTERS or fake syllabus charts remain</done>
</task>
