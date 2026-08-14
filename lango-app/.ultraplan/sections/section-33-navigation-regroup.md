# Section 33: Navigation regroup

## Overview
Reorganizes the doc's target IA (Academic Setup / Timetables / Academic Year Operations) without removing any existing route - additive regrouping, matching this session's own precedent of adding nav entries for pages that had none (schedule/teacher-schedule/conflicts).

## Risk: [green] - pure nav-config change, no route/schema changes; cosmetically best done last once every other section's pages exist to group

## Dependencies
- Depends on: none (technically executable anytime, but only makes full sense once sections 20-32's pages exist)
- Blocks: none
- Parallel batch: 5

## TDD Test Stubs
- (Nav-only change - manual click-through verification, no automated test needed.)

## Tasks

<task type="auto" id="33-01">
  <name>Regroup portal-manifest.ts and sidebar.tsx into the doc's target IA</name>
  <files>src/libs/api/portal-manifest.ts, src/components/shared/sidebar.tsx</files>
  <action>
    Reorganize the academics section's children into three groups matching doc §5: "Academic Setup" (Classes & Sections, Subjects, Curriculum/Class Subjects, Class Teachers, Subject Teachers, the new Assignment Workspace from section-26), "Timetables" (Class Schedule, Teacher Schedule, Conflicts, Rooms from section-27), "Academic Year Operations" (Session Years, Class Offerings from section-21, Promotion wizard from section-31, Promotion History from section-34). Keep Mediums/Semesters/Streams/Shifts/Optional Subjects under an "Advanced Setup" subsection per the doc. Every existing route stays reachable - this is a regroup, not a removal.
  </action>
  <verify>click through every link in both nav surfaces after the change, confirm nothing 404s and nothing that worked before stopped being reachable</verify>
  <done>Nav matches the doc's proposed IA, zero existing routes lost</done>
</task>
