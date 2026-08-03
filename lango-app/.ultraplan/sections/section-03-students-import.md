# Section 03: Student 360, Admissions & Lifecycle Feature Module

## Overview
Implements the full Student Lifecycle: Student Directory list with live `/api/students` connection, Admissions Request Approval State Machine (`/api/students/admissions`), Guardian-Student Linking (`guardian_students` join table), Student Class Transfers (`/api/students/transfers`), Batch Student Promotions (`/api/students/promotions`), and the Excel Bulk Import Wizard.

## Risk: `yellow` — Multi-table transactions & state machines

## Tasks

<task type="auto" id="03-01">
  <name>Implement Student Admissions Approval State Machine</name>
  <files>src/app/api/students/admissions/route.ts, src/features/students/ui/admission-requests-view.tsx, src/features/students/ui/student-admission-view.tsx</files>
  <action>
    Wire `/api/students/admissions` to the real `admission_requests` table with multi-tenant isolation. Implement transaction-safe approval action: approving an admission request converts the lead into an enrolled student `user` row (`role='student'`), sets `classSectionId`, generates a matricule, and records an audit log.
  </action>
  <verify>Approve admission request -> student user record created in DB -> student appears in directory</verify>
  <done>Student Admissions Approval State Machine active</done>
</task>

<task type="auto" id="03-02">
  <name>Implement Guardian-Student Linker with Student Search Picker</name>
  <files>src/app/api/students/parents/link/route.ts, src/features/students/ui/parents-guardians-view.tsx</files>
  <action>
    Build student search-and-select picker replacing free-text student names in `parents-guardians-view.tsx`. Create `POST /api/students/parents/link` API writing to the `guardian_students` join table (`guardian_id`, `student_id`, `relationship_type`). Display linked student badges in the guardians list.
  </action>
  <verify>Link guardian to student via picker -> relationship saved in guardian_students table</verify>
  <done>Guardian-Student Linker active</done>
</task>

<task type="auto" id="03-03">
  <name>Implement Student Class & Campus Transfers</name>
  <files>src/app/api/students/transfers/route.ts, src/features/students/ui/student-transfers-view.tsx</files>
  <action>
    Build transfer API `/api/students/transfers` executing multi-table transaction: updates `user.classSectionId`, creates record in `transfers` table with `reason`, `transferDate`, and `previousClassSectionId`, and logs audit trail.
  </action>
  <verify>Transfer student from 2nde-A to 1ère-B -> classSectionId updates and transfer record created</verify>
  <done>Student Transfer workflow active</done>
</task>

<task type="auto" id="03-04">
  <name>Implement End-of-Year Batch Student Promotions</name>
  <files>src/app/api/students/promotions/route.ts, src/features/students/ui/promotions-view.tsx</files>
  <action>
    Build batch promotion API `/api/students/promotions` executing atomic transaction: advances all students in a source `classSectionId` to a target `classSectionId` for a new `sessionYearId`, writes batch log to `promote_students`, and logs audit trail.
  </action>
  <verify>Promote class 2nde-A -> all student classSectionIds advance atomically</verify>
  <done>Batch Student Promotion workflow active</done>
</task>

<task type="auto" id="03-05">
  <name>Wire Matricules, Photo Upload & Excel Bulk Import Wizard</name>
  <files>src/app/api/students/matricules/route.ts, src/app/api/students/photos/route.ts, src/features/students/ui/excel-import-view.tsx, src/features/students/lib/excel-parser.ts</files>
  <action>
    Wire sequential matricule generator API. Build photo upload endpoint for student avatar photos. Wire Excel import wizard using `xlsx` library with column mapping and batch insert into `user` table.
  </action>
  <verify>Upload sample Excel spreadsheet -> preview columns -> batch import 10 students cleanly</verify>
  <done>Matricules, Photo Upload & Excel Import active</done>
</task>
