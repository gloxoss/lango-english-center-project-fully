# Section 01: Schema & Migration Foundation

## Overview
Every other section in this plan reads or writes columns/tables that don't exist yet. This section is the single combined migration (`0058`) and matching `Schema.ts` update covering all six feature areas, applied and verified before any route code depends on it. Implements the schema side of PRD "What It Does" (all Must Have items). No new permission strings are introduced anywhere in this plan — every new route reuses an existing capability already governing the same resource domain (`guardians.manage`/`guardians.read`, `academics.manage`, `grading.manage`/`grading.read`, `admissions.manage`/`admissions.view`, `students.read`) — confirmed sufficient during research, so `src/libs/api/permissions.ts` (the closed `PermissionKey` union) is not touched by this plan.

## Risk: yellow - many small DDL changes across 6 unrelated tables in one migration
Individually each change is a single nullable column or a small new table — low risk in isolation. The risk is coordination: a mistake in any one of the ~14 DDL statements (wrong FK target, wrong `ON DELETE` behavior, enum typo) blocks every downstream section until fixed. Mitigated by applying and verifying against the real database (not just `tsc --noEmit`) before any other section starts, per this session's established discipline.

## Dependencies
- **Depends on:** none
- **Blocks:** section-02 (households), section-03 (classes), section-05 (question bank), section-06 (admission)
- **Parallel batch:** 1

## TDD Test Stubs
- Test: After migration, `guardian_students` has real `emergency_priority` and `can_pickup` columns queryable via psql.
- Test: After migration, `guardians` has real `email_opt_in`/`sms_opt_in`/`preferred_language` columns with sane defaults (opt-in defaults true, matching "on by default" school-communication norms).
- Test: After migration, `classes.cycle` and `class_sections.max_students`/`home_room_id` exist, with `home_room_id` rejecting a room ID from another tenant at the FK level being impossible to express — confirmed instead at the application layer in section-03, not the DB layer (FK alone can't cross-check tenant).
- Test: After migration, `question_bank_items` + `question_bank_item_options` exist and can hold a real question with 2+ options.
- Test: After migration, `admission_interviews` and `admission_comments` exist, both FK-cascading on `applicantId` deletion.
- Test: After migration, `applicants` has the 3 new checklist boolean columns, all defaulting to `false`.
- Test: `docker compose build migrate` succeeds and the migration applies cleanly against a fresh database, not just the already-migrated dev database.

## Tasks

<task type="auto" id="01-01">
  <name>Author combined migration 0058</name>
  <files>migrations/0058_dropped_features_rebuild.sql</files>
  <action>
    Write one migration file with these DDL statements, matching this repo's existing migration style (plain SQL, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` where altering existing tables, `CREATE TABLE IF NOT EXISTS` for new ones, explicit enum `CREATE TYPE` statements before any column that uses them):
    1. `guardian_students`: add `emergency_priority integer`, `can_pickup boolean NOT NULL DEFAULT false`.
    2. `guardians`: add `email_opt_in boolean NOT NULL DEFAULT true`, `sms_opt_in boolean NOT NULL DEFAULT true`, `preferred_language varchar(10)`.
    3. New enum `class_cycle` with values `'maternelle','primaire','college','lycee'`. `classes`: add `cycle class_cycle`.
    4. `class_sections`: add `max_students integer`, `home_room_id uuid REFERENCES rooms(id) ON DELETE SET NULL`.
    5. New enum `question_difficulty` with values `'facile','moyen','difficile'`. `online_exam_questions`: add `section_label varchar(255)`, `difficulty question_difficulty`, `subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL`, `cycle class_cycle`.
    6. New table `question_bank_items`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL`, `cycle class_cycle`, `difficulty question_difficulty`, `section_label varchar(255)`, `question_text text NOT NULL`, `marks numeric(5,2) NOT NULL DEFAULT 1`, `created_by_id text REFERENCES "user"(id) ON DELETE SET NULL`, `created_at timestamp NOT NULL DEFAULT now()`, `updated_at timestamp NOT NULL DEFAULT now()`.
    7. New table `question_bank_item_options`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `question_bank_item_id uuid NOT NULL REFERENCES question_bank_items(id) ON DELETE CASCADE`, `option_text text NOT NULL`, `is_correct boolean NOT NULL DEFAULT false`.
    8. New enum `admission_interview_status` with values `'scheduled','completed','cancelled'`. New table `admission_interviews`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE`, `scheduled_at timestamp NOT NULL`, `interviewer_id text REFERENCES "user"(id) ON DELETE SET NULL`, `location varchar(255)`, `status admission_interview_status NOT NULL DEFAULT 'scheduled'`, `notes text`, `created_at timestamp NOT NULL DEFAULT now()`, `updated_at timestamp NOT NULL DEFAULT now()`. Add a unique index on `applicant_id` (one interview per applicant, per the discovery decision).
    9. New table `admission_comments`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `applicant_id uuid NOT NULL REFERENCES applicants(id) ON DELETE CASCADE`, `author_id text REFERENCES "user"(id) ON DELETE SET NULL`, `body text NOT NULL`, `created_at timestamp NOT NULL DEFAULT now()`.
    10. `applicants`: add `checklist_documents_received boolean NOT NULL DEFAULT false`, `checklist_interview_done boolean NOT NULL DEFAULT false`, `checklist_file_complete boolean NOT NULL DEFAULT false`.
    11. Indexes (Postgres does not auto-index FK columns, and several new query paths hit these hot): `CREATE INDEX IF NOT EXISTS admission_comments_applicant_id_idx ON admission_comments(applicant_id)`, `CREATE INDEX IF NOT EXISTS question_bank_items_tenant_subject_idx ON question_bank_items(tenant_id, subject_id)`, `CREATE INDEX IF NOT EXISTS question_bank_item_options_item_id_idx ON question_bank_item_options(question_bank_item_id)`, `CREATE INDEX IF NOT EXISTS guardian_students_student_id_idx ON guardian_students(student_id)`, `CREATE INDEX IF NOT EXISTS guardian_students_guardian_id_idx ON guardian_students(guardian_id)` (the last two are defensive — research found no existing index on either column despite both being on an already-hot query path for guardian linking and the new co-guardian lookups in section-02).
    Check existing enum-naming and table-naming conventions in `migrations/0057_add_admission_model_enhancement.sql` and match them exactly (snake_case, quoting style).
  </action>
  <verify>Read the file back and confirm every statement uses `IF NOT EXISTS`/idempotent-safe syntax matching the style of migration 0057, and that every new FK references a table confirmed to exist in `src/models/Schema.ts` by the research pass (tenants, rooms, subjects, applicants, "user").</verify>
  <done>migrations/0058_dropped_features_rebuild.sql exists with all 10 DDL groups above, idempotent and stylistically consistent with prior migrations in this repo.</done>
</task>

<task type="auto" id="01-02">
  <name>Update Schema.ts to match migration 0058</name>
  <files>src/models/Schema.ts</files>
  <action>
    Add Drizzle table/enum definitions matching every DDL statement in 0058-01 exactly (same column names, types, nullability, defaults, FK behavior). Add `classCycle` and `questionDifficulty` and `admissionInterviewStatus` pgEnum exports near the other enum definitions in the file (follow the existing enum-declaration pattern used for e.g. `smsMessageStatus`). Add new columns to the existing `guardianStudents`, `guardians`, `classes`, `classSections`, `onlineExamQuestions`, `applicants` table definitions in place (don't move existing columns). Add new table definitions for `questionBankItems`, `questionBankItemOptions`, `admissionInterviews`, `admissionComments` near their most related existing tables (e.g. `questionBankItems` near `onlineExamQuestions`, `admissionInterviews`/`admissionComments` near `applicants`).
  </action>
  <verify>Run `npx tsc --noEmit` — 0 errors. Confirm every new Drizzle column/table name and JS property name matches what section-02 through section-06 will reference (cross-check against this section file's own DDL list).</verify>
  <done>src/models/Schema.ts exports Drizzle definitions for every table/column/enum added in migration 0058, and the project typechecks cleanly.</done>
</task>

<task type="auto" id="01-03">
  <name>Apply and register migration 0058</name>
  <files>migrations/meta/_journal.json</files>
  <action>
    Following this session's established procedure (raw `psql` execution against the running `db` container, then manual journal registration matching the pattern used for migration 0057): apply `migrations/0058_dropped_features_rebuild.sql` directly via `psql`, then compute its hash and add the corresponding entry to `migrations/meta/_journal.json` so Drizzle's own migration runner considers it already applied and doesn't attempt to re-run it.
  </action>
  <verify>Run `psql` queries (`\d guardian_students`, `\d guardians`, `\d classes`, `\d class_sections`, `\d online_exam_questions`, `\d question_bank_items`, `\d question_bank_item_options`, `\d admission_interviews`, `\d admission_comments`, `\d applicants`) and confirm every new column/table from task 01-01 is present with the correct type.</verify>
  <done>Migration 0058 is applied to the live database and registered in the drizzle journal, verified via direct psql inspection of every new table/column.</done>
</task>

<task type="auto" id="01-04">
  <name>Rebuild Docker images and confirm clean build</name>
  <files>none</files>
  <action>
    Run `docker compose build app` and `docker compose build migrate` in the foreground (not just `tsc --noEmit`, per this session's standing discipline that only a real Docker build is authoritative). Bring up `app` via `docker compose up -d --no-deps app` if the `migrate` service is still in its known-broken state from the concurrent session's unrelated ledger inconsistency (0044/0053 gap) — do not attempt to fix that unrelated gap as part of this task.
  </action>
  <verify>Both images build with 0 errors. `docker compose up -d --no-deps app` starts successfully and the app responds to a basic authenticated request (e.g. `GET /api/settings/branches`).</verify>
  <done>app and migrate Docker images both build cleanly on top of the new schema, and the app container is confirmed running and responsive.</done>
</task>
