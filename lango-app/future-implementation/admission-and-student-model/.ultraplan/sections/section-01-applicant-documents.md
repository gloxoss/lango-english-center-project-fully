# Section 01: Applicant Documents (real upload during the wizard)

## Overview
Implements the PRD's "Working document upload" requirement. The admission wizard's Step 3 currently has zero upload code — nothing typed or attached there is saved. This section adds a small `applicantDocuments` table (mirrors the real `studentDocuments` table exactly) plus a GET/POST route pair, so files uploaded while there's still only an `applicants` row (no `user` row yet) actually persist. This is the foundation Section 03 depends on to copy the photo forward at approval.

## Risk: green - well-trodden pattern, mirrors an existing working feature exactly
The shape (table, upload route, shared `saveUploadedFile` helper) already exists and works for `studentDocuments` — this section is a structural copy with `applicantId` instead of `studentId`, not a new pattern.

## Dependencies
- **Depends on:** none
- **Blocks:** section-03 (matricule-fix-photo-copy)
- **Parallel batch:** 1

## Design decision: when does the applicant record get created?

Document upload needs a real `applicantId` to attach to, but the wizard currently
only creates the `applicants` row at the very last step (Step 4 "Validation &
envoi"). Resolved here rather than left to the task executor: the applicant
record is now created right when Step 1 validates (moving from Step 1 to
Step 2) using the existing `POST /api/students/admissions` schema (firstName/
lastName/email/phone/dateOfBirth — everything Step 1 already collects;
guardian fields stay empty at this point, Wave 1 doesn't touch guardian
handling). This gives Step 3 a real ID to upload against. Step 4's "Envoyer"
action then needs to update the already-created applicant's guardian text
fields instead of creating a second one — see Task 01-05 for the small PATCH
endpoint this requires.

## TDD Test Stubs
- Test: Completing Step 1 and clicking "Next" creates a real, minimal applicant row (status `applied`) before Step 2 ever renders.
- Test: Uploading a "Photo d'identité" file for that in-progress applicant saves it, and a follow-up GET for that applicant shows `photo: uploaded: true`.
- Test: Uploading the same document type twice for the same applicant replaces the first file, not duplicates it.
- Test: Uploading a document type outside the 5 allowed types (photo, birth_certificate, school_certificate, guardian_cni, bulletin) is rejected with a clear error.
- Test: Uploading a file larger than 5MB or a disallowed MIME type is rejected, same limits as the existing student-documents upload.
- Test: An applicant from a different tenant cannot be referenced — tenant isolation holds.
- Test: GET for an applicant with zero uploads returns all 5 document types marked `uploaded: false`, not an error.
- Test: Completing Step 4 updates the existing applicant's guardian fields rather than creating a second applicant row.

## Tasks

<task type="auto" id="01-01">
  <name>Add applicantDocuments table to schema</name>
  <files>src/models/Schema.ts</files>
  <action>
    Directly below the `applicants` table definition, add a new `applicantDocuments` pgTable named `'applicant_documents'` with the exact same shape as `studentDocuments` (find it near `studentDocuments = pgTable('student_documents', ...)`), except the foreign key column is `applicantId: uuid('applicant_id').notNull()` referencing `applicants.id` with `.onDelete('cascade')` instead of `studentId` referencing `user.id`. Keep the same `documentType` pgEnum reuse (photo/birth_certificate/school_certificate/guardian_cni/bulletin), `fileExt`, and `uploadedAt` columns. Add a tenant FK the same way `studentDocuments` does. Add an index on `(tenantId, applicantId)` — this table is always queried by applicant, same as `studentDocuments`' existing index pattern.
  </action>
  <verify>Read the new table definition and confirm it matches studentDocuments' column shape exactly except for the applicantId/studentId swap.</verify>
  <done>applicantDocuments table exists in Schema.ts with the same shape as studentDocuments, keyed to applicants instead of user.</done>
</task>

<task type="auto" id="01-02">
  <name>Write migration for applicant_documents table</name>
  <files>migrations/{NEXT}_add_applicant_documents.sql, migrations/meta/_journal.json</files>
  <action>
    Before writing, re-check migrations/meta/_journal.json's true highest idx and migrations/*.sql's true highest number at execution time — do not trust any number implied by this plan, since a concurrent session may have taken the next number first (this repo has a known live inconsistency: 0044 exists on disk unjournaled, 0053 is journaled but missing on disk — do not touch either side of that, just find the real next free number). Write a plain CREATE TABLE applicant_documents matching Task 01-01's Drizzle definition (uuid id default gen_random_uuid, tenant_id uuid not null with FK cascade, applicant_id uuid not null with FK cascade to applicants(id), document_type using the existing document_type enum, file_ext varchar, uploaded_at timestamp default now). Add the corresponding journal entry.
  </action>
  <verify>Apply the migration via `docker compose exec db psql -f -` (or the compose migrate service if it's healthy) and confirm via `\d applicant_documents` that the table and both foreign keys exist.</verify>
  <done>applicant_documents table exists in the real database with correct columns and foreign keys, migration registered in the drizzle ledger.</done>
</task>

<task type="auto" id="01-03">
  <name>Build applicant documents upload route</name>
  <files>src/app/api/students/admissions/documents/route.ts</files>
  <action>
    Create a new route mirroring src/app/api/students/documents/route.ts exactly, but operating on applicantDocuments/applicantId instead of studentDocuments/studentId. GET accepts ?applicantId= and returns the same 5-document-type upload-status shape. POST accepts multipart form data (applicantId, documentType, file), validates the applicant exists for the current tenant (query applicants table, not user), reuses the same saveUploadedFile helper with a distinct storage path prefix like `applicant-documents/${applicantId}/${documentType}.{ext}` so it never collides with real student document paths, deletes any existing row for that applicant+documentType before inserting the new one (same replace-not-duplicate behavior as the original route). Role gate: requireRequestContext(request, ['school_admin']) plus requireCapability(context, 'admissions.manage') — matches the wizard's own POST /api/students/admissions gate, not the broader school_admin+teacher gate the enrolled-student version uses (only admins run the admission wizard).
  </action>
  <verify>curl a real file upload with a real applicant ID as school_admin: 200 with success. Same request as a role without admissions.manage: 403. GET with the applicantId returns the uploaded document marked true.</verify>
  <done>POST /api/students/admissions/documents and GET /api/students/admissions/documents both work against real applicant rows, tenant-scoped, capability-gated.</done>
</task>

<task type="auto" id="01-04">
  <name>Add PATCH endpoint for editable applicant fields</name>
  <files>src/app/api/students/admissions/route.ts</files>
  <action>
    Add a new PATCH handler to this route, separate from the existing PUT (which is exclusively the approve/reject status transition — do not touch it in this task). PATCH accepts `{ id, guardianName?, guardianPhone?, guardianEmail? }` (Wave 1 scope only — Section 02 will extend this schema with the new fields, Section 04 will replace guardianName/Phone/Email with real guardian linking; keep this handler additive so later sections can extend the same schema object rather than replacing it). Validate the applicant exists for the tenant and its status is still `applied` (reject with a clear error if it's already `approved`/`rejected` — an applicant mid-decision shouldn't be edited). Update only the fields provided. Same role/capability gate as POST: `requireRequestContext(['school_admin'])` + `requireCapability('admissions.manage')`.
  </action>
  <verify>PATCH a real applicant's guardian fields, confirm via GET that they changed. PATCH an already-approved applicant, confirm it's rejected with a clear error instead of silently succeeding.</verify>
  <done>PATCH /api/students/admissions updates an existing pending applicant's editable fields without touching the approval transaction.</done>
</task>

<task type="auto" id="01-05">
  <name>Create the applicant record at Step 1 completion</name>
  <files>src/features/students/ui/student-admission-view.tsx</files>
  <action>
    Change the "Next" action on Step 1 (currently just increments `step`) so that the first time it fires, it POSTs to /api/students/admissions with the Step 1 fields (firstName/lastName/email/phone/dateOfBirth) and stores the returned applicant `id` in component state. Subsequent Step 1→2 navigation (e.g. if the user goes back and forward again) should not create a second applicant — guard on whether an applicant ID already exists in state. If the POST fails, show the error and do not advance to Step 2.
  </action>
  <verify>Walk Step 1, click Next, confirm a real applicant row now exists in the database with status `applied` before Step 2 renders. Go back to Step 1 and forward again; confirm no second applicant row was created.</verify>
  <done>The admission wizard creates a real applicant record as soon as Step 1 is completed, not at final submission.</done>
</task>

<task type="auto" id="01-06">
  <name>Wire wizard Step 3 to the new upload route</name>
  <files>src/features/students/ui/student-admission-view.tsx</files>
  <action>
    In the "Documents & consentements" step (the DOCUMENTS constant and its render block), replace the decorative file-picker UI with real file inputs per document type. Each input's onChange immediately POSTs to /api/students/admissions/documents using the applicant ID created in Task 01-05. Show a per-document-type loading spinner while the upload is in flight, a checkmark once it succeeds, and a visible inline error (not a silent failure) if the POST rejects — matching the existing DOCUMENTS list's required/optional labels. Every file input keeps a real `<label>` associated with it (not just placeholder text) so screen readers announce which document type it's for. Remove the ponytail comment that previously disclosed this step as non-functional.
  </action>
  <verify>Manually walk the wizard: fill Step 1, reach Step 3, upload a real photo file, confirm a checkmark appears and a real row now exists in applicant_documents via a psql query.</verify>
  <done>Step 3 of the admission wizard uploads real files against a real applicant record, with visible upload confirmation per document type.</done>
</task>

<task type="auto" id="01-07">
  <name>Wire wizard Step 4 to PATCH guardian fields instead of creating a new applicant</name>
  <files>src/features/students/ui/student-admission-view.tsx</files>
  <action>
    Update `handleSubmit` (currently POSTs to /api/students/admissions to create the applicant) to instead PATCH /api/students/admissions with the existing applicant ID and the Step 2 guardian fields (guardianName/guardianPhone/guardianEmail). The success/submitted UI stays the same; only the underlying call changes from create to update.
  </action>
  <verify>Complete all 4 steps of the wizard for a real applicant, confirm the same applicant row (not a new one) now has guardian fields populated, confirm total applicant row count only increased by 1 for this run-through.</verify>
  <done>Completing the admission wizard results in exactly one applicant row, created at Step 1 and updated at Step 4, with real uploaded documents attached throughout.</done>
</task>
