# Section 02: New Admission Fields (gender, academic year, nationality, mother tongue, city, blood group)

## Overview
Implements the PRD's "New student fields" requirement. Adds the 6 fields the source doc identified as genuinely earning their place, to both `applicants` (so they're captured during the wizard) and `user` (so they land on the real student record at approval). `gender` already exists on `user` but has never been set from anywhere — this section is what actually sets it.

## Risk: green - straightforward schema + form additions, no new patterns
Every field is either a plain text/varchar column or a foreign key to an existing table (`academicYears`). No new concepts, no new upload/storage mechanics.

## Dependencies
- **Depends on:** none
- **Blocks:** section-03 (matricule-fix-photo-copy) needs these columns present on `user` before it can copy them at approval
- **Parallel batch:** 1

## TDD Test Stubs
- Test: Submitting Step 1 with all 6 new fields filled in creates an applicant row with those exact values.
- Test: Blood Group can be left empty — it is never required, submission succeeds either way.
- Test: The Academic Year dropdown lists only real, active academic years for the current tenant.
- Test: At approval, a student's gender/nationality/motherTongue/city/bloodGroup/academicYearId match what was entered on the applicant.
- Test: An applicant with no Mother Tongue selected defaults to `null`, not a fabricated value.

## Tasks

<task type="auto" id="02-01">
  <name>Add new columns to applicants and user tables</name>
  <files>src/models/Schema.ts</files>
  <action>
    On `applicants`: add `gender: gender()` (reuse the existing `gender` pgEnum), `nationality: varchar({ length: 100 })`, `motherTongue: varchar('mother_tongue', { length: 50 })`, `city: varchar({ length: 100 })`, `bloodGroup: varchar('blood_group', { length: 10 })`, `academicYearId: uuid('academic_year_id')` with a foreign key to `academicYears.id`, all nullable. On `user`: add `nationality`, `motherTongue`, `city`, `bloodGroup`, `academicYearId` with the same types and the same FK — `gender` already exists there, don't re-add it. Follow this file's existing snake_case column-name convention.
  </action>
  <verify>Read both table definitions and confirm all 5-6 new columns are present with correct types and the academicYearId foreign key.</verify>
  <done>applicants and user tables both have the new fields defined in Schema.ts, nullable, with academicYearId as a real foreign key.</done>
</task>

<task type="auto" id="02-02">
  <name>Write migration for the new columns</name>
  <files>migrations/{NEXT}_add_admission_fields.sql, migrations/meta/_journal.json</files>
  <action>
    Re-check the true highest migration idx at execution time (same caveat as Task 01-02 — do not trust any number implied by this plan). Write `ALTER TABLE applicants ADD COLUMN IF NOT EXISTS ...` for each of the 6 new columns, `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ...` for the 5 new columns (gender already exists there), and the two `academic_year_id` foreign key constraints (wrap each in the `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` pattern already used in this repo's recent migrations, e.g. 0056, to stay safe if run twice). Add the journal entry.
  </action>
  <verify>Apply via `docker compose exec db psql -f -`, confirm via `\d applicants` and `\d "user"` that every new column and both foreign keys exist.</verify>
  <done>All 6 new columns exist on the real applicants table and 5 new columns plus 2 FKs exist on the real user table, migration registered in the drizzle ledger.</done>
</task>

<task type="auto" id="02-03">
  <name>Extend admission API schemas to accept the new fields</name>
  <files>src/app/api/students/admissions/route.ts, src/libs/api/validation.ts</files>
  <action>
    Find `applicantCreateSchema` (used by POST) in validation.ts and add the 6 new fields as optional: `gender: z.enum(['female','male','other']).optional()`, `nationality: z.string().max(100).optional()`, `motherTongue: z.string().max(50).optional()`, `city: z.string().max(100).optional()`, `bloodGroup: z.string().max(10).optional()`, `academicYearId: z.string().uuid().optional()`. Extend the PATCH schema added in Task 01-04 the same way (this is the "keep it additive" extension point that task's action comment called out). Pass all provided fields through on both POST insert and PATCH update.
  </action>
  <verify>POST and PATCH both accept and persist all 6 new fields; omitting them still succeeds (all optional).</verify>
  <done>The admission create/update API accepts and stores all 6 new fields on the applicant record.</done>
</task>

<task type="auto" id="02-04">
  <name>Build academic years list endpoint</name>
  <files>src/app/api/academics/academic-years/route.ts</files>
  <action>
    No route currently exposes `academicYears` at all — confirmed by grep, not assumed. Create GET /api/academics/academic-years: `requireRequestContext(request, ['school_admin', 'teacher', 'accountant'])` (read-only, broadly useful — matches the pattern used for other reference-data lists like /api/academics/classes), `requireTenant`, select `id`, `name`, `startDate`, `endDate`, `isActive` from `academicYears` where tenantId matches, order by `startDate desc`. No pagination needed — a school has a handful of academic years at most.
  </action>
  <verify>curl the endpoint as an authenticated school_admin, confirm it returns real academicYears rows for the tenant, empty array (not an error) if none exist yet.</verify>
  <done>GET /api/academics/academic-years returns real, tenant-scoped academic year rows.</done>
</task>

<task type="auto" id="02-05">
  <name>Add the 6 new fields to wizard Step 1</name>
  <files>src/features/students/ui/student-admission-view.tsx</files>
  <action>
    Extend the `FormState` type and `EMPTY_FORM` with gender, nationality, motherTongue, city, bloodGroup, academicYearId. Add form inputs to Step 1 "Informations élève": Gender as a select (Femme/Homme/Autre mapped to female/male/other), Academic Year as a select populated by fetching Task 02-04's new GET /api/academics/academic-years endpoint, Nationality as a plain text input, Mother Tongue as a select with exactly Arabic/Français/Tamazight/Anglais/Autre (mapped to arabic/french/tamazight/english/other or equivalent stored values), City as plain text, Blood Group as a select of standard blood types with a visible "(optionnel)" label and no required validation. Every new field has a real `<label htmlFor>` pairing (matches this app's existing form-field convention), and each select is keyboard-navigable via native `<select>` (no custom dropdown widget needed). Include all 6 in Task 01-05's Step 1 creation POST body.
  </action>
  <verify>Fill out Step 1 including all 6 new fields, advance to Step 2, confirm the created applicant row has all 6 values via a real query.</verify>
  <done>Step 1 of the admission wizard collects and saves all 6 new fields on the real applicant record.</done>
</task>
