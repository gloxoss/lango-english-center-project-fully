# Section 04: Academics, Programs, Groups & Timetable Feature Module

## Overview
Implements the Academics feature module (`src/features/academics/`): Programs CRUD, Courses, Student Class Groups/Batches, Staff/Teacher subject assignments, and the Weekly Timetable Grid (`src/features/academics/ui/timetable-grid.tsx`).

## Risk: `green` — Core academic structures

## Tasks

<task type="auto" id="04-01">
  <name>Create Academic Types & Schemas</name>
  <files>src/features/academics/model/types.ts, src/features/academics/validation/academic.schema.ts</files>
  <action>
    Define Zod validation schemas and TypeScript types for Programs, Courses, Class Groups, Subject Coefficients, and Timetable Slots.
  </action>
  <verify>Import academic types without compilation errors</verify>
  <done>Academic data types & schemas created</done>
</task>

<task type="auto" id="04-02">
  <name>Create Academics Server Service</name>
  <files>src/features/academics/server/academic.service.ts</files>
  <action>
    Build server services for CRUD operations on Programs, Courses, Class Groups, Teacher subject assignments, and Timetable slot retrieval.
  </action>
  <verify>Academic service methods execute cleanly</verify>
  <done>Academic service layer completed</done>
</task>

<task type="auto" id="04-03">
  <name>Create Programs & Class Group UI Components</name>
  <files>src/features/academics/ui/programs-list.tsx, src/features/academics/ui/groups-list.tsx</files>
  <action>
    Build Programs list, Course selector, and Class Group assignment UI components.
  </action>
  <verify>Programs list renders active courses and class groups</verify>
  <done>Programs & Group components created</done>
</task>

<task type="auto" id="04-04">
  <name>Create Interactive Weekly Timetable Grid Component</name>
  <files>src/features/academics/ui/timetable-grid.tsx, src/features/academics/ui/timetable-client.tsx</files>
  <action>
    Build interactive weekly schedule grid displaying time slots per class group, room, and assigned teacher. Support filter by class, teacher, or room.
  </action>
  <verify>Timetable grid renders weekly slots Monday through Saturday</verify>
  <done>Weekly Timetable Grid component completed</done>
</task>

<task type="auto" id="04-05">
  <name>Create Staff & Teacher Assignment Module</name>
  <files>src/features/academics/ui/staff-list.tsx, src/features/academics/ui/teacher-assignment-modal.tsx</files>
  <action>
    Build Staff profile list and Teacher subject/class assignment modal.
  </action>
  <verify>Assigning a teacher to a course group updates state correctly</verify>
  <done>Staff assignment components created</done>
</task>

<task type="auto" id="04-06">
  <name>Create Academic Page Routes</name>
  <files>src/app/[locale]/(dashboard)/academics/programs/page.tsx, src/app/[locale]/(dashboard)/academics/groups/page.tsx, src/app/[locale]/(dashboard)/academics/timetable/page.tsx, src/app/[locale]/(dashboard)/academics/staff/page.tsx</files>
  <action>
    Assemble App Router page routes for Programs, Groups, Weekly Timetable, and Staff management.
  </action>
  <verify>Navigate to /fr/dashboard/academics/timetable and view weekly schedule</verify>
  <done>Academic pages active</done>
</task>
