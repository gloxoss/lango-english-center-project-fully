# Section 01: Schema & Role Foundation

## Overview
Every other section depends on the `alumni` role existing and being usable end-to-end, plus the new tables this plan needs. This section is the combined migration (`0061`), the `Schema.ts` update, and — critically — the three non-database touch points research found: `APP_ROLES` (`src/libs/api/context.ts`), `DEFAULT_ROLE_PERMISSIONS` (`src/libs/api/permissions.ts`), and `ROLE_TO_UI`/`ROLE_TO_DB` (`src/models/userMapping.ts`). Missing any of the three silently breaks alumni logins even though the database side looks complete — this section treats all four as one atomic unit of work, not optional follow-ups.

## Risk: yellow - a missed non-DB touch point breaks logins with no compiler error on two of the three
`ROLE_TO_DB` in particular is not exhaustive-checked by TypeScript — forgetting it compiles cleanly and only fails at runtime. Mitigated by a dedicated verification task that actually logs in as a test alumni user before this section is considered done, not just a code read-through.

## Dependencies
- **Depends on:** none
- **Blocks:** section-02, section-03, section-04, section-05, section-06, section-07, section-08
- **Parallel batch:** 1

## TDD Test Stubs
- Test: After migration, the `role` enum accepts `'alumni'` as a real value on a `user` row.
- Test: A request authenticated as a real `alumni`-role user is NOT rejected by `requireRequestContext` with `ROLE_NOT_ALLOWED`.
- Test: `DEFAULT_ROLE_PERMISSIONS` has a real (even if minimal) entry for `alumni` — the project fails to typecheck otherwise.
- Test: The UI never crashes rendering an `alumni`-role user's name/role badge anywhere staff already see role labels (confirms `ROLE_TO_UI` covers it).
- Test: All new tables (`alumni_documents`, `alumni_events`, `alumni_event_rsvps`, `alumni_directory_consent`, `alumni_mentor_listings`, `alumni_requests`) exist with the correct columns, verified via psql.
- Test: The verification-code naming-series entry can be reserved twice concurrently without producing the same code (confirms the advisory-lock fix, not the unlocked `reserveMatricule` shape).

## Tasks

<task type="auto" id="01-01">
  <name>Author combined migration 0061</name>
  <files>migrations/0061_alumni_portal.sql</files>
  <action>
    Write one migration file, matching the idempotent style of `migrations/0058_dropped_features_rebuild.sql` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` for constraints/enums):
    1. Add the role value: `ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'alumni' AFTER 'student';` (bare statement, no DO wrapper — matches migration 0003's exact idiom, `ADD VALUE IF NOT EXISTS` is already idempotent).
    2. `user` table: add `graduation_cohort_session_year_id uuid` (nullable, FK to `session_years(id)` ON DELETE SET NULL — NOT `academic_years`, which is the dead LMS-chain table), `alumni_transitioned_at timestamp` (nullable), `alumni_transitioned_by text` (nullable, FK to `user(id)` ON DELETE SET NULL).
    3. New enum `alumni_document_status`: `('active', 'superseded')`.
    4. New table `alumni_documents`: `id uuid PK default gen_random_uuid()`, `tenant_id uuid NOT NULL FK tenants(id) CASCADE`, `alumnus_id text NOT NULL FK user(id) CASCADE`, `document_type varchar(50) NOT NULL`, `file_ext varchar(10) NOT NULL`, `verification_code varchar(32) NOT NULL`, `status alumni_document_status NOT NULL DEFAULT 'active'`, `issued_at timestamp NOT NULL DEFAULT now()`, `superseded_at timestamp`, `issued_by text FK user(id) SET NULL`. Unique index on `verification_code`. Index on `(alumnus_id, document_type, status)`.
    5. New enum `alumni_event_rsvp_status`: `('going', 'not_going', 'maybe')`.
    6. New table `alumni_events`: `id uuid PK`, `tenant_id uuid NOT NULL FK tenants(id) CASCADE`, `title varchar(255) NOT NULL`, `description text`, `location varchar(255)`, `starts_at timestamp NOT NULL`, `ends_at timestamp`, `created_by text FK user(id) SET NULL`, `created_at timestamp NOT NULL DEFAULT now()`.
    7. New table `alumni_event_rsvps`: `id uuid PK`, `tenant_id uuid NOT NULL FK tenants(id) CASCADE`, `event_id uuid NOT NULL FK alumni_events(id) CASCADE`, `alumnus_id text NOT NULL FK user(id) CASCADE`, `status alumni_event_rsvp_status NOT NULL`, `updated_at timestamp NOT NULL DEFAULT now()`. Unique on `(event_id, alumnus_id)`.
    8. New table `alumni_directory_consent`: `id uuid PK`, `tenant_id uuid NOT NULL FK tenants(id) CASCADE`, `alumnus_id text NOT NULL FK user(id) CASCADE`, `show_name boolean NOT NULL DEFAULT false`, `show_cohort boolean NOT NULL DEFAULT false`, `show_current_employer boolean NOT NULL DEFAULT false`, `show_contact_info boolean NOT NULL DEFAULT false`, `current_employer varchar(255)`, `updated_at timestamp NOT NULL DEFAULT now()`. Unique on `alumnus_id`.
    9. New table `alumni_mentor_listings`: `id uuid PK`, `tenant_id uuid NOT NULL FK tenants(id) CASCADE`, `alumnus_id text NOT NULL FK user(id) CASCADE`, `is_active boolean NOT NULL DEFAULT true`, `offering text NOT NULL`, `contact_preference varchar(50)`, `created_at timestamp NOT NULL DEFAULT now()`, `updated_at timestamp NOT NULL DEFAULT now()`. Unique on `alumnus_id`.
    10. New enums `alumni_request_type` (`'correction', 'reissue', 'data_access', 'deletion'`) and `alumni_request_status` (`'pending', 'approved', 'rejected'`). New table `alumni_requests`: `id uuid PK`, `tenant_id uuid NOT NULL FK tenants(id) CASCADE`, `alumnus_id text NOT NULL FK user(id) CASCADE`, `type alumni_request_type NOT NULL`, `status alumni_request_status NOT NULL DEFAULT 'pending'`, `note text NOT NULL`, `related_document_id uuid FK alumni_documents(id) SET NULL`, `decided_by text FK user(id) SET NULL`, `decided_at timestamp`, `decision_note text`, `created_at timestamp NOT NULL DEFAULT now()`. Index on `(tenant_id, status)`.
  </action>
  <verify>Read the file back and confirm every statement is idempotent-safe and every FK target table is confirmed real by research (tenants, user, session_years, alumni_events, alumni_documents).</verify>
  <done>migrations/0061_alumni_portal.sql exists with all 10 DDL groups above, idempotent and stylistically consistent with prior migrations.</done>
</task>

<task type="auto" id="01-02">
  <name>Update Schema.ts to match migration 0061</name>
  <files>src/models/Schema.ts</files>
  <action>
    Add `'alumni'` to the existing `role` pgEnum's array literal itself (`pgEnum('role', [...])`) — the DB-level `ALTER TYPE ... ADD VALUE` from task 01-01 does NOT automatically update Drizzle's TypeScript-side enum definition; both sides must be edited or `userMapping.ts`'s `Role`-derived types fail to compile. Add Drizzle definitions matching every other DDL statement in task 01-01 exactly. Add `alumniDocumentStatus`, `alumniEventRsvpStatus`, `alumniRequestType`, `alumniRequestStatus` pgEnum exports near the other enum definitions. Add `graduationCohortSessionYearId`, `alumniTransitionedAt`, `alumniTransitionedById` columns to the existing `user` table definition. Add new table definitions (`alumniDocuments`, `alumniEvents`, `alumniEventRsvps`, `alumniDirectoryConsent`, `alumniMentorListings`, `alumniRequests`) — placement order doesn't matter for FK resolution (confirmed forward-references work fine in this file, e.g. `applicants` already references `guardians` defined 800+ lines later), but group them together near `sessionYears`/`user` for readability.
  </action>
  <verify>Run `npx tsc --noEmit` — 0 errors.</verify>
  <done>src/models/Schema.ts exports Drizzle definitions for every table/column/enum added in migration 0061, and the project typechecks cleanly.</done>
</task>

<task type="auto" id="01-03">
  <name>Register the alumni role in the three non-DB touch points</name>
  <files>src/libs/api/context.ts, src/libs/api/permissions.ts, src/models/userMapping.ts</files>
  <action>
    In `context.ts`: add `'alumni'` to the `APP_ROLES` array. In `permissions.ts`: add `alumni: []` to `DEFAULT_ROLE_PERMISSIONS` — deliberately empty, since every alumni-facing route in this plan is self-scoped (role='alumni' + own userId), not gated by a module capability; no new `PERMISSIONS` keys needed (execution-time simplification over the original plan text, which proposed 7 unused capability strings — corrected to match what the routes actually check). In `userMapping.ts`: add `alumni` to both `ROLE_TO_UI` (`'Ancien(ne) élève'`) and `ROLE_TO_DB` (`'Ancien(ne) élève'` reverse mapping) — `ROLE_TO_DB` is NOT exhaustive-checked by the compiler, so this must be added deliberately, not assumed automatic.
  </action>
  <verify>`npx tsc --noEmit` passes (confirms `DEFAULT_ROLE_PERMISSIONS` and `ROLE_TO_UI` are complete). Grep `userMapping.ts` to manually confirm `ROLE_TO_DB` has the new entry too, since nothing will force this one.</verify>
  <done>The alumni role is fully registered in APP_ROLES, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_TO_UI, and ROLE_TO_DB.</done>
</task>

<task type="auto" id="01-04">
  <name>Build advisory-lock-safe verification-code generator</name>
  <files>src/libs/services/alumni-verification-code.ts</files>
  <action>
    New file. Export `reserveVerificationCode(db, tenantId): Promise&lt;string&gt;`, modeled on `src/libs/services/matricule.ts`'s `reserveMatricule()` but adding a `pg_advisory_xact_lock` call (same pattern as `src/libs/services/student-placement.ts:125`) keyed on a hash of `tenantId + prefix` before the read-then-increment `namingSeries` logic, so two concurrent calls for the same tenant can never produce the same code. Prefix format `VER-${year}-`, zero-padded to 6 digits (longer than matricule's 4, since this is a security-relevant identifier with a larger expected volume over a school's lifetime).
  </action>
  <verify>Call the function twice concurrently (e.g. `Promise.all([reserveVerificationCode(...), reserveVerificationCode(...)])`) against a real tenant and confirm two distinct codes are returned, not a duplicate.</verify>
  <done>A real, concurrency-safe verification-code generator exists, reusing the proven namingSeries + advisory-lock pattern.</done>
</task>

<task type="auto" id="01-05">
  <name>Apply, register, and Docker-verify migration 0061</name>
  <files>migrations/meta/_journal.json</files>
  <action>
    Following this session's established procedure: apply `migrations/0061_alumni_portal.sql` directly via `psql` against the running `db` container, then add the corresponding entry to `migrations/meta/_journal.json` (re-check the file immediately before editing — a concurrent session may have appended its own next migration after 0059 already). Then run `docker compose build app` and `docker compose build migrate` in the foreground, and `docker compose up -d --no-deps app`.
  </action>
  <verify>psql `\d user` shows the 3 new columns; `\d alumni_documents`, `\d alumni_events`, `\d alumni_event_rsvps`, `\d alumni_directory_consent`, `\d alumni_mentor_listings`, `\d alumni_requests` all show the correct columns. Both Docker images build with 0 errors. A real login as a seeded `school_admin` still works after the rebuild (regression check on the role-enum change specifically, since it touches a type every existing login already depends on).</verify>
  <done>Migration 0060 is live in the database, registered in the journal, and both Docker images are rebuilt and verified working.</done>
</task>
