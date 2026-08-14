# Section 03: Approval Transaction Fixes (real matricule, copy new fields, copy documents)

## Overview
Implements the PRD's "Correct student ID numbers" and "Profile picture from admission" requirements, plus completes the field-copy half of Section 02. All three fixes land in the same function — `PUT /api/students/admissions`'s approval transaction — so they're grouped into one section instead of three separate edits to the same critical code.

## Risk: yellow - touches the one transaction every other section in this plan also depends on
Not individually complex, but it's the highest-traffic file in this whole plan (Section 04 and Section 05 both extend this same transaction next) and it moves file-copy logic onto disk inside a DB transaction — if the file copy fails, the DB transaction should not silently succeed with a missing photo.

## Dependencies
- **Depends on:** section-01 (applicant-documents — needs applicantDocuments rows to copy from), section-02 (student-new-fields — needs the new user/applicants columns to exist)
- **Blocks:** section-04 (guardian-search-link)
- **Parallel batch:** 2

## TDD Test Stubs
- Test: Approving an applicant produces a student with a real `STD-{year}-####` matricule, never a random `M-####` value.
- Test: Approving two applicants back-to-back produces two different, sequential matricules — no collisions.
- Test: Approving an applicant with gender/nationality/motherTongue/city/bloodGroup/academicYearId set copies every one of those values onto the new user row exactly.
- Test: Approving an applicant who uploaded a photo during the wizard results in the new student having `photoUrl` set and the same image retrievable via the existing student-photos GET route.
- Test: Approving an applicant who uploaded a birth certificate or other non-photo document results in that document appearing in the new student's real `studentDocuments`, not just the photo.
- Test: Approving an applicant who uploaded zero documents still succeeds — the copy step handles "nothing to copy" without erroring the whole approval.
- Test: If the file-copy step fails for one document, the approval transaction rolls back entirely rather than leaving a half-created student.
- Test: Two simultaneous approval requests for the same applicant result in exactly one student created and one request receiving a clear "already decided" error, not two students.

## Tasks

<task type="auto" id="03-01">
  <name>Replace random matricule with real naming-series reservation, close approval race window</name>
  <files>src/app/api/students/admissions/route.ts</files>
  <action>
    Inside the approval transaction's student-creation block, replace `const matricule = \`M-${Math.floor(1000 + Math.random() * 9000)}\`;` with a call to the same naming-series reservation logic already used by GET /api/students/matricules (prefix `STD-{currentYear}-`, read-then-increment `namingSeries` row inside this same transaction using `tx` instead of `db` so it's part of the same atomic operation — do not call the separate HTTP endpoint from inside this transaction, inline the same read/increment/insert logic using the transaction client). Use the resulting sequential value as the new student's `matricule` field. Separately: the applicant is currently fetched once, outside the transaction, before the `if (body.status === 'approved')` branch — this leaves a window where two concurrent approval requests for the same applicant could both pass that check and both create a student. Re-fetch the applicant *inside* the transaction (using `tx`) as the first step of the approval branch, and re-verify `status === 'applied'` there; if it's already `approved`/`rejected`, throw a clear conflict error instead of proceeding.
  </action>
  <verify>Approve two real applicants in immediate succession, confirm both get real, sequential STD-{year}-#### matricules with no collision, confirm the same namingSeries row that /api/students/matricules already uses reflects the incremented value afterward.</verify>
  <done>Approving an admission assigns a real, sequential, correctly formatted matricule instead of a random one.</done>
</task>

<task type="auto" id="03-02">
  <name>Copy new applicant fields onto the created student</name>
  <files>src/app/api/students/admissions/route.ts</files>
  <action>
    In the same transaction's `tx.insert(user).values({...})` call, add the 5 new fields from Section 02 (gender, nationality, motherTongue, city, bloodGroup) and academicYearId, reading them from the `applicant` row already fetched at the top of the PUT handler.
  </action>
  <verify>Approve a real applicant that has all 6 new fields set, confirm the resulting student row has the exact same values via a direct query.</verify>
  <done>Approval copies every new admission field from the applicant onto the created student record.</done>
</task>

<task type="auto" id="03-03">
  <name>Copy uploaded documents from applicant to student at approval</name>
  <files>src/app/api/students/admissions/route.ts, src/libs/api/uploads.ts</files>
  <action>
    After the new student row is created inside the transaction, query `applicantDocuments` for the approved applicant's tenant+applicantId. For each row found, copy the underlying file on disk from its applicant-scoped path to the equivalent student-scoped path (add a small `copyUploadedFile(tenantId, fromPath, toPath)` helper to uploads.ts if one doesn't already exist, reusing the same base-directory logic `saveUploadedFile`/`readUploadedFile` already use — read the source file's bytes and write them to the destination path, do not assume a filesystem `rename`/`copy` primitive is safe across the same logic those helpers already validate), then insert a matching `studentDocuments` row. If the copied document's type is `photo`, additionally set the new student's `photoUrl` column to the new student-scoped path/filename inside the same transaction. If the file copy throws, let the transaction fail and roll back rather than catching and continuing.
  </action>
  <verify>Approve a real applicant with a real uploaded photo and a real uploaded birth certificate, confirm both files exist at their new student-scoped paths, confirm the new student's photoUrl is set, confirm GET /api/students/photos?id={newStudentId} returns the actual image bytes.</verify>
  <done>Approving an admission moves every document the applicant uploaded during the wizard onto the real student record, including setting the profile photo.</done>
</task>
