# Section 01: Schema & Seeding Foundation

## Overview
Unblocks the entire addon by seeding `report_definitions` from the existing in-memory catalog, closing the foreign-key violation that currently makes every `report_runs`/`report_favorites`/`report_saved_views`/`report_schedules` insert fail. Implements the PRD's "What It Does NOT Do" decision to formally drop the 4 unbuilt Platform/Audit reports from scope. Also adds the durable-export-storage and file-retention columns needed by later sections.

## Risk: green - straightforward idempotent seeding, well-understood migration pattern already used successfully all session

## Dependencies
- Depends on: none
- Blocks: section-02, section-04, section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: Running the seed migration twice does not error and does not create duplicate rows.
- Test: After seeding, `report_definitions` contains exactly 27 rows (not 31 - the 4 dropped Platform/Audit reports are absent).
- Test: A real `report_runs` insert referencing any of the 27 seeded keys succeeds (no more FK violation).
- Test: Each seeded row's `domain` and `sensitivityLevel` exactly match the corresponding entry in `catalog-definitions.ts`.

## Tasks

<task type="auto" id="01-01">
  <name>Write idempotent report_definitions seed migration</name>
  <files>migrations/00XX_seed_report_definitions.sql</files>
  <action>
    Read `src/addons/advanced-reporting/services/catalog-definitions.ts` in full to get the exact current values for all 27 report keys (excluding the 4 Platform/Audit ones that were planned but never built). Write a new migration file (numbered one past the current highest migration in `migrations/`) containing `INSERT INTO report_definitions (key, domain, title, description, sensitivity_level, freshness_type, execution_adapter, supported_formats, current_version, is_active) VALUES (...) ON CONFLICT (key) DO UPDATE SET domain = EXCLUDED.domain, title = EXCLUDED.title, description = EXCLUDED.description, sensitivity_level = EXCLUDED.sensitivity_level` for all 27 rows, using the real values read from the catalog file (never invented placeholder values).
  </action>
  <verify>Apply the migration via `docker compose run --rm migrate` twice in a row; second run must not error. Query `select count(*) from report_definitions;` and confirm it returns 27.</verify>
  <done>report_definitions is seeded with exactly the 27 in-scope reports, safe to re-apply, and the FK blocker on dependent tables is resolved.</done>
</task>

<task type="auto" id="01-02">
  <name>Confirm existing report_artifacts schema covers retention (no migration needed)</name>
  <files>none</files>
  <action>
    Correction found during execution: `report_artifacts` (a separate table from `report_runs`, already in the schema) already has `filePath`, `fileSizeBytes`, `checksumSha256`, and a NOT NULL `expiresAt` column - exactly what section-05 needs for durable storage and retention. No new columns or migration are needed. Retention/cleanup works by DELETING the `report_artifacts` row once `expiresAt` has passed (section-05, task 05-04) while `report_runs` itself is never touched, satisfying the PRD's "keep run metadata indefinitely, expire files only" decision without any schema change. This task exists only to record that correction so it isn't rediscovered as a false gap later - no code changes.
  </action>
  <verify>Run `\d report_artifacts` in psql and confirm `file_path`, `file_size_bytes`, `checksum_sha256`, `expires_at` all already exist.</verify>
  <done>Confirmed the existing schema already supports file retention; no migration work needed for this task.</done>
</task>

<task type="auto" id="01-03">
  <name>Document the 4 dropped Platform/Audit reports as out of scope</name>
  <files>future-implementation/advanced-reporting/.ultraplan-remediation/PLAN.md</files>
  <action>
    Add a short note to the "What It Does NOT Do" area of the technical plan (or a dedicated "Scope Decisions" note) recording that the 4 Platform/Audit reports named in the original plan were never built and are formally cut from scope by this remediation, per the PRD. No code changes needed for this task - it is a documentation-only closure of a known gap so it is never silently rediscovered as "missing" later.
  </action>
  <verify>The note is present and references the specific decision.</verify>
  <done>The 4 dropped reports are documented as an explicit, deliberate scope decision, not a silent gap.</done>
</task>
