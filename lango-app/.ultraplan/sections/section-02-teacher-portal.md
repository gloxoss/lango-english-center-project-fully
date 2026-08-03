# Section 02: 5A Teacher Portal (`/dashboard/teacher`)

## Overview
Build the dedicated Teacher Portal dashboard featuring Today schedule timeline, assigned class section selection, 1-click attendance taker, homework assignment publisher, and Moroccan `/20` markbook grid.

## Risk: [yellow] - Moderate complexity due to teacher-assignment scoping.

## Dependencies
- Depends on: Section 01
- Blocks: none
- Parallel batch: 2

## TDD Test Stubs
- Test: verifies teacher can only view and submit attendance for assigned class sections.
- Test: verifies Moroccan /20 grade entry updates assignment submissions.

## Tasks

<task type="auto" id="02-01">
  <name>Build Teacher Dashboard Today View & Class Roster Component</name>
  <files>src/app/[locale]/(dashboard)/teacher/page.tsx, src/components/teacher/TeacherTodaySchedule.tsx</files>
  <action>
    Create Teacher Portal home view with today's timetable, assigned class sections dropdown, and class roster list.
  </action>
  <verify>Navigating to /dashboard/teacher renders today's schedule and assigned classes</verify>
  <done>Teacher home view displays timetable and assigned class sections</done>
</task>

<task type="auto" id="02-02">
  <name>Build Quick Attendance Taker Component</name>
  <files>src/components/teacher/AttendanceTakerModal.tsx, src/app/api/attendance/session/route.ts</files>
  <action>
    Build fast attendance taker modal allowing teachers to mark Present, Absent, or Late for their assigned class roster.
  </action>
  <verify>Submitting attendance records session entries in database</verify>
  <done>Attendance taker modal records session attendance</done>
</task>

<task type="auto" id="02-03">
  <name>Build Homework Publisher & Moroccan Grade Grid</name>
  <files>src/components/teacher/HomeworkPublisher.tsx, src/components/teacher/GradeEntryGrid.tsx</files>
  <action>
    Build homework assignment creation panel and grade entry grid enforcing Moroccan /20 scoring scale.
  </action>
  <verify>Grade entries validate within 0-20 bounds</verify>
  <done>Teachers can publish homework and enter grades</done>
</task>
