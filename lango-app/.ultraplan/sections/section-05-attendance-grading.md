# Section 05: Mobile Attendance Grid & Moroccan Grade Engine (/20)

## Overview
Implements the Attendance feature (`src/features/attendance/`) and Moroccan Assessment & Grade Engine (`src/features/grading/`). Supports dual-mode attendance (daily or per-class session) optimized for responsive mobile web on teachers' smartphones. Implements Moroccan `/20` grading logic with subject coefficients, trimester moyenne, class ranking, and mentions (Très Bien, Bien, Assez Bien, Passable).

## Risk: `yellow` — Mobile UX & Grade calculation accuracy

## Tasks

<task type="auto" id="05-01">
  <name>Create Attendance & Grading Types & Schemas</name>
  <files>src/features/attendance/model/types.ts, src/features/grading/model/types.ts, src/features/grading/validation/assessment.schema.ts</files>
  <action>
    Define TypeScript types and Zod schemas for Attendance records (Present, Absent, Late, Excused), Assessment plans, Subject coefficients, and Moyenne results.
  </action>
  <verify>Import types cleanly into service files</verify>
  <done>Attendance & Grading types defined</done>
</task>

<task type="auto" id="05-02">
  <name>Create Attendance Server Service</name>
  <files>src/features/attendance/server/attendance.service.ts</files>
  <action>
    Implement server-side logic to record single/batch attendance, calculate student absence stats, flag unexcused absences, and trigger automated SMS alerts.
  </action>
  <verify>Batch recording 25 students updates attendance records cleanly</verify>
  <done>Attendance service layer completed</done>
</task>

<task type="auto" id="05-03">
  <name>Build Mobile-First Responsive Attendance Grid Component</name>
  <files>src/features/attendance/ui/attendance-grid-section.tsx, src/features/attendance/ui/attendance-grid-client.tsx</files>
  <action>
    Build mobile-first touch-friendly attendance grid allowing teachers to mark a full class in under 30 seconds on their phone. Support single-tap toggle (Present -> Absent -> Late -> Excused).
  </action>
  <verify>Attendance grid renders cleanly on mobile screen width (375px)</verify>
  <done>Mobile-first Attendance Grid component created</done>
</task>

<task type="auto" id="05-04">
  <name>Implement Moroccan Assessment & Moyenne Engine</name>
  <files>src/features/grading/lib/moyenne-calculator.ts, src/features/grading/server/grading.service.ts</files>
  <action>
    Build Moroccan `/20` grade calculation engine incorporating subject coefficients, trimester moyenne computation, student class ranking, and mention calculation.
  </action>
  <verify>Unit test calculator with sample scores: 14/20 (coeff 3) + 16/20 (coeff 2) = 14.8/20 (Bien)</verify>
  <done>Moroccan Grade Engine created & tested</done>
</task>

<task type="auto" id="05-05">
  <name>Create Grade Entry Grid Component</name>
  <files>src/features/grading/ui/grade-entry-grid.tsx, src/features/grading/ui/grade-entry-client.tsx</files>
  <action>
    Build Grade Entry spreadsheet-style grid for teachers and admins to enter assessment scores out of 20 per student.
  </action>
  <verify>Grade entry grid recalculates student moyenne live</verify>
  <done>Grade Entry Grid component completed</done>
</task>

<task type="auto" id="05-06">
  <name>Create Attendance & Grading Page Routes</name>
  <files>src/app/[locale]/(dashboard)/attendance/page.tsx, src/app/[locale]/(dashboard)/academics/assessments/[id]/page.tsx</files>
  <action>
    Assemble page routes for mobile Attendance grid and Assessment grade entry grid.
  </action>
  <verify>Navigate to /fr/dashboard/attendance and record sample attendance</verify>
  <done>Attendance & Grading pages active</done>
</task>
