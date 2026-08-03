# Section 05: 5D Receptionist Portal (`/dashboard/receptionist`)

## Overview
Build Receptionist Portal dashboard featuring walk-in inquiry intake modal, lead qualification pipeline, visitor check-in log, and front-desk appointment calendar.

## Risk: [green] - Low risk; inquiry models exist.

## Dependencies
- Depends on: Section 01
- Blocks: none
- Parallel batch: 3

## TDD Test Stubs
- Test: verifies walk-in inquiry intake creates new inquiry record with source='walk_in'.
- Test: verifies visitor check-in creates visitor log entry.

## Tasks

<task type="auto" id="05-01">
  <name>Build Receptionist Dashboard & Visitor Log Component</name>
  <files>src/app/[locale]/(dashboard)/receptionist/page.tsx, src/components/receptionist/VisitorCheckInLog.tsx</files>
  <action>
    Create Receptionist Portal home view with today's walk-in count, active inquiries count, visitor check-in table, and appointments calendar.
  </action>
  <verify>Navigating to /dashboard/receptionist renders front-desk dashboard</verify>
  <done>Receptionist home view displays visitor log and appointments</done>
</task>

<task type="auto" id="05-02">
  <name>Build Walk-in Inquiry Intake Modal</name>
  <files>src/components/receptionist/WalkInInquiryModal.tsx, src/app/api/inquiries/quick-intake/route.ts</files>
  <action>
    Build fast walk-in inquiry registration modal capturing parent name, phone, student name, interest level, and desired program.
  </action>
  <verify>Submitting intake modal creates inquiry with status='new'</verify>
  <done>Front desk staff can register walk-in inquiries in 10 seconds</done>
</task>

<task type="auto" id="05-03">
  <name>Build Lead Qualification & Appointment Scheduler</name>
  <files>src/components/receptionist/LeadQualificationPipeline.tsx</files>
  <action>
    Build quick lead pipeline cards allowing receptionists to qualify inquiries (New -> Contacted -> Qualified -> Converted) and schedule placement tests or tours.
  </action>
  <verify>Updating lead status updates inquiry record in database</verify>
  <done>Receptionists can qualify leads and schedule appointments</done>
</task>
