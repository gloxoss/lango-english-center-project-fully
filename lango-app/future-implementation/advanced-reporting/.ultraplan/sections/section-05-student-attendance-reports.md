# Section 05: Student & Attendance Domain Adapters

## Overview
This section builds query adapters for 4 Student Reports (Credential Readiness Status, Admission Conversion Funnel, Class & Section Occupancy, Sibling & Household Distribution) and 5 Attendance Reports (Student Attendance Log, Daily Section Matrix, Student Overview & Risk Streaks, Employee Attendance Punch Summary, Exam Session Attendance).

## Risk: green - Read-only SQL queries over existing core models
Hits existing tables in `Schema.ts` (`students`, `guardians`, `guardian_students`, `classes`, `class_sections`, `applicants`, `inquiries`, `attendance_registers`, `attendance_records`). Low risk.

## Dependencies
- **Depends on:** section-02, section-03
- **Blocks:** section-09 (verification)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: `StudentAdapter.getCredentialStatusReport()` returns user account provisioning state without exposing plain passwords or password hashes.
- Test: `StudentAdapter.getAdmissionFunnelReport()` aggregates leads -> applications -> admitted -> enrolled conversion rates by cohort.
- Test: `AttendanceAdapter.getStudentOverviewReport()` returns accurate presence rates with denominator coverage.
- Test: `AttendanceAdapter.getDailySectionMatrixReport()` formats dates × classes attendance counts cleanly.

## Tasks

<task type="auto" id="05-01">
  <name>Build Student Domain Query Adapter</name>
  <files>src/addons/advanced-reporting/adapters/student-adapter.ts</files>
  <action>
    Create `StudentAdapter` executing queries for:
    1. `student.credentials`: Provisioning status, role, masked identifier, activation state, last login. Zero passwords or hashes exposed.
    2. `student.admission_funnel`: Inquiry/applicant pipeline conversion rates by date, branch, program, class, and cohort.
    3. `student.class_section_occupancy`: Effective enrollment count vs section `maxStudents` capacity.
    4. `student.siblings`: Explicit guardian-student household groupings, student counts, and authorized guardian contact list.
  </action>
  <verify>Run TypeScript checks on adapter methods and parameter types.</verify>
  <done>StudentAdapter query methods operational with tenant isolation.</done>
</task>

<task type="auto" id="05-02">
  <name>Build Student Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/student-reports-view.tsx</files>
  <action>
    Create dedicated UI component rendering Student domain report layouts, summary metrics cards, funnel charts, and household relationship tables.
  </action>
  <verify>Confirm rendering in Report Workspace when selecting any student report key.</verify>
  <done>Student reports frontend view integrated with workspace controls.</done>
</task>

<task type="auto" id="05-03">
  <name>Build Attendance Domain Query Adapter</name>
  <files>src/addons/advanced-reporting/adapters/attendance-adapter.ts</files>
  <action>
    Create `AttendanceAdapter` executing queries for:
    1. `attendance.student_log`: Per-student attendance history, late minutes, excuse approval status, and notes.
    2. `attendance.daily_matrix`: Date x class section grid with present/absent/late/excused totals and missing register indicators.
    3. `attendance.overview_streaks`: Student presence rates, consecutive absence streaks, and risk flags with clear register coverage denominators.
    4. `attendance.employee_summary`: Workforce workday punches, hours, lateness, and absence exceptions.
    5. `attendance.exam_session`: Candidate exam hall check-ins, room seats, and incident status.
  </action>
  <verify>Test denominator handling in overview report to ensure un-marked registers do not count as absences.</verify>
  <done>AttendanceAdapter query methods operational with denominator safety.</done>
</task>

<task type="auto" id="05-04">
  <name>Build Attendance Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/attendance-reports-view.tsx</files>
  <action>
    Create UI component rendering Attendance daily matrices, heatmaps, student risk cards, and exam presence lists.
  </action>
  <verify>Check interactive daily matrix rendering with class section filters.</verify>
  <done>Attendance reports frontend view integrated cleanly.</done>
</task>
