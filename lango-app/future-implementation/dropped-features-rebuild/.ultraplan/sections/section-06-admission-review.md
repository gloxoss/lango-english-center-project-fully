# Section 06: Admission — interviews, staff notes, review checklist

## Overview
Implements the PRD's "Admission interview & review tracking" Must Have. Two small new tables (`admissionInterviews`, `admissionComments`) plus 3 fixed checklist booleans already added to `applicants` in section-01. All three sub-features reuse the existing `admissions.view`/`admissions.manage` capabilities — no new capability strings, per the decision made during planning to avoid unnecessary permission-model growth for sub-resources of the same admissions review workflow.

## Risk: green - small, additive, no overlap with the existing real admission-approval transaction
None of these three new pieces touch the existing `applicants` approval flow (matricule reservation, user creation, document copy, guardian linking, login provisioning) built earlier this session — they're independent reads/writes that happen to live on the same applicant record.

## Dependencies
- **Depends on:** section-01 (schema foundation)
- **Blocks:** none
- **Parallel batch:** 2

## TDD Test Stubs
- Test: Scheduling an interview for an applicant persists and is returned on GET; scheduling a second interview for the same applicant replaces the first (real single-interview-per-applicant constraint from the unique index in section-01), not creating a duplicate.
- Test: Posting a comment appends to the thread with the correct real author and timestamp; there is no edit/delete endpoint (append-only, matches the staff-notes-thread decision).
- Test: Toggling any of the 3 checklist booleans persists independent of the applicant's current `status` (works before and after approval/rejection, unlike the existing PATCH which is blocked once decided).
- Test: A user with `admissions.view` but not `admissions.manage` can read interviews/comments/checklist but any write attempt is rejected.

## Tasks

<task type="auto" id="06-01">
  <name>Build admission interview endpoint</name>
  <files>src/app/api/students/admissions/[id]/interview/route.ts</files>
  <action>
    New file. GET, cap `admissions.view`: returns the applicant's single `admissionInterviews` row if one exists, else `null`. PUT, cap `admissions.manage`, Zod `.strict()` schema `{scheduledAt, interviewerId?, location?, status?, notes?}`: validates the applicant belongs to the tenant and (if provided) the interviewer is a real tenant user; upserts by `applicantId` (update if a row exists, insert otherwise — the unique index from section-01 makes this a real single-interview-per-applicant guarantee, not just an application convention). Call `recordAudit()` on write.
  </action>
  <verify>PUT twice with different `scheduledAt` values leaves exactly one row for that applicant (confirmed via psql), reflecting the second value. GET on an applicant with no interview returns `null`, not an error.</verify>
  <done>A real, single, upsertable interview record exists per applicant, tenant-validated.</done>
</task>

<task type="auto" id="06-02">
  <name>Build admission comments endpoint</name>
  <files>src/app/api/students/admissions/[id]/comments/route.ts</files>
  <action>
    New file. GET, cap `admissions.view`: returns all `admissionComments` for the applicant ordered by `createdAt` ascending, with `authorId` resolved to a real staff name. POST, cap `admissions.manage`, Zod `.strict()` schema `{body}` (1-2000 chars): validates the applicant belongs to the tenant, inserts a new comment with `authorId` from context. No PATCH/DELETE — append-only by design.
  </action>
  <verify>POST a comment, then GET, shows it with the correct real author name and a real timestamp, in chronological order alongside any other comments.</verify>
  <done>A real, append-only, staff-only comment thread exists per applicant.</done>
</task>

<task type="auto" id="06-03">
  <name>Build admission checklist endpoint</name>
  <files>src/app/api/students/admissions/[id]/checklist/route.ts</files>
  <action>
    New file. PATCH handler, cap `admissions.manage`, Zod `.strict()` schema with any subset of `{checklistDocumentsReceived, checklistInterviewDone, checklistFileComplete}` (all boolean). Validates the applicant belongs to the tenant, updates only the provided fields on `applicants` — deliberately not gated by the applicant's `status` (unlike the main admissions PATCH), since a checklist should stay editable regardless of decision state. Call `recordAudit()`.
  </action>
  <verify>PATCH `{checklistInterviewDone: true}` on an already-approved applicant succeeds (no 409, unlike the main PATCH's decided-status block). Reload confirms the value persisted.</verify>
  <done>The 3 fixed checklist items can be toggled independent of the applicant's admission-decision status.</done>
</task>

<task type="auto" id="06-04">
  <name>Wire interview, comments, and checklist into admission detail UI</name>
  <files>src/features/students/ui/admission-requests-client.tsx</files>
  <action>
    Read the existing file in full. In the applicant detail panel, add: a real interview scheduler (date/time picker, interviewer select from real staff, location text, status select) wired to task 06-01's GET/PUT; a real staff-notes thread (list + a single-line add-comment input, no edit/delete UI since the API is append-only) wired to task 06-02; a real 3-item checklist with checkboxes (pièces reçues / entretien fait / dossier complet) wired to task 06-03, editable regardless of the applicant's current status. Handle empty states honestly: "Aucun entretien planifié" before one is scheduled, "Aucune note pour le moment" before any comment exists.
  </action>
  <verify>In the browser: schedule a real interview for an applicant, add a real comment, tick a checklist item on an already-decided applicant, reload, confirm all three persisted correctly.</verify>
  <done>The admission review page shows and edits a real interview, a real staff notes thread, and a real checklist per applicant.</done>
</task>
