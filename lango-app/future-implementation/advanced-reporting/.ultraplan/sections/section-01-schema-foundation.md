# Section 01: Schema & Migration Foundation

## Overview
Every feature in the Advanced Reporting Add-on relies on reporting metadata, execution logs, generated export artifacts, background schedules, immutable period snapshots, and projection freshness watermarks. This section creates migration `0059_advanced_reporting_addon.sql`, updates `src/addons/registry.ts`, updates `src/libs/api/permissions.ts` (adding `'reports.manage'` and `'reports.schedule'`), creates `src/addons/advanced-reporting/models/reporting-schema.ts`, and re-exports definitions in `src/models/Schema.ts`.

## Risk: yellow - 15 new database tables & enums
Creating 15 reporting tables in PostgreSQL. Low risk of data corruption since all are new tables, but requires accurate FK references to `tenants(id)`, `branches(id)`, `"user"(id)`, and proper indexes for query performance.

## Dependencies
- **Depends on:** none
- **Blocks:** section-02 (catalog), section-03 (run engine)
- **Parallel batch:** 1

## TDD Test Stubs
- Test: Migration 0059 applies cleanly via psql with 0 syntax errors.
- Test: `report_definitions`, `report_runs`, `report_artifacts`, `report_schedules`, `report_snapshots`, and `report_projection_watermarks` tables are queryable in psql.
- Test: `src/models/Schema.ts` and `src/addons/advanced-reporting/models/reporting-schema.ts` export clean Drizzle table definitions and typecheck cleanly with `npx tsc --noEmit`.

## Tasks

<task type="auto" id="01-01">
  <name>Author migration 0059_advanced_reporting_addon.sql</name>
  <files>migrations/0059_advanced_reporting_addon.sql</files>
  <action>
    Create plain SQL migration with idempotent `CREATE TABLE IF NOT EXISTS` and `CREATE TYPE IF NOT EXISTS` statements:
    1. New enum `report_run_status` ('queued', 'running', 'completed', 'failed', 'cancelled', 'expired').
    2. New enum `report_export_format` ('csv', 'xlsx', 'pdf').
    3. New table `report_definitions`: `key varchar(100) PRIMARY KEY`, `domain varchar(50) NOT NULL`, `current_version integer NOT NULL DEFAULT 1`, `title varchar(255) NOT NULL`, `description text`, `sensitivity_level varchar(50) NOT NULL DEFAULT 'standard'`, `freshness_type varchar(50) NOT NULL DEFAULT 'realtime'`, `execution_adapter varchar(100) NOT NULL`, `parameters_schema jsonb`, `columns_schema jsonb`, `supported_formats text[] NOT NULL DEFAULT ARRAY['csv']`, `required_permissions text[] NOT NULL DEFAULT ARRAY[]::text[]`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamp NOT NULL DEFAULT now()`, `updated_at timestamp NOT NULL DEFAULT now()`.
    4. New table `report_definition_versions`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `report_key varchar(100) NOT NULL REFERENCES report_definitions(key) ON DELETE CASCADE`, `version integer NOT NULL`, `query_adapter varchar(100) NOT NULL`, `sql_template text`, `columns_schema jsonb`, `parameters_schema jsonb`, `checksum varchar(64)`, `published_at timestamp NOT NULL DEFAULT now()`, `published_by_id text REFERENCES "user"(id) ON DELETE SET NULL`.
    5. New table `report_saved_views`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `report_key varchar(100) NOT NULL REFERENCES report_definitions(key) ON DELETE CASCADE`, `name varchar(255) NOT NULL`, `description text`, `owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`, `is_shared boolean NOT NULL DEFAULT false`, `parameters jsonb NOT NULL DEFAULT '{}'`, `created_at timestamp NOT NULL DEFAULT now()`, `updated_at timestamp NOT NULL DEFAULT now()`.
    6. New table `report_favorites`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`, `report_key varchar(100) NOT NULL REFERENCES report_definitions(key) ON DELETE CASCADE`, `created_at timestamp NOT NULL DEFAULT now()`.
    7. New table `report_runs`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `branch_id uuid REFERENCES branches(id) ON DELETE SET NULL`, `report_key varchar(100) NOT NULL REFERENCES report_definitions(key) ON DELETE CASCADE`, `version integer NOT NULL DEFAULT 1`, `requester_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`, `status report_run_status NOT NULL DEFAULT 'queued'`, `parameters jsonb NOT NULL DEFAULT '{}'`, `as_of_date timestamp NOT NULL DEFAULT now()`, `source_watermarks jsonb NOT NULL DEFAULT '{}'`, `row_count integer NOT NULL DEFAULT 0`, `execution_time_ms integer`, `error_message text`, `created_at timestamp NOT NULL DEFAULT now()`, `finished_at timestamp`.
    8. New table `report_run_events`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE`, `event_type varchar(50) NOT NULL`, `message text NOT NULL`, `metadata jsonb NOT NULL DEFAULT '{}'`, `created_at timestamp NOT NULL DEFAULT now()`.
    9. New table `report_artifacts`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `run_id uuid NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE`, `format report_export_format NOT NULL`, `file_path text NOT NULL`, `file_size_bytes integer NOT NULL DEFAULT 0`, `checksum_sha256 varchar(64) NOT NULL`, `download_count integer NOT NULL DEFAULT 0`, `expires_at timestamp NOT NULL`, `created_at timestamp NOT NULL DEFAULT now()`.
    10. New table `report_schedules`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `branch_id uuid REFERENCES branches(id) ON DELETE SET NULL`, `report_key varchar(100) NOT NULL REFERENCES report_definitions(key) ON DELETE CASCADE`, `name varchar(255) NOT NULL`, `cron_expression varchar(100) NOT NULL`, `timezone varchar(50) NOT NULL DEFAULT 'UTC'`, `format report_export_format NOT NULL DEFAULT 'csv'`, `parameters jsonb NOT NULL DEFAULT '{}'`, `is_active boolean NOT NULL DEFAULT true`, `created_by_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE`, `last_run_at timestamp`, `next_run_at timestamp`, `created_at timestamp NOT NULL DEFAULT now()`, `updated_at timestamp NOT NULL DEFAULT now()`.
    11. New table `report_schedule_recipients`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `schedule_id uuid NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE`, `recipient_type varchar(20) NOT NULL`, `recipient_target text NOT NULL`, `created_at timestamp NOT NULL DEFAULT now()`.
    12. New table `report_snapshots`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `report_key varchar(100) NOT NULL REFERENCES report_definitions(key) ON DELETE CASCADE`, `period_key varchar(100) NOT NULL`, `snapshot_data jsonb NOT NULL`, `checksum_sha256 varchar(64) NOT NULL`, `created_at timestamp NOT NULL DEFAULT now()`, `created_by_id text REFERENCES "user"(id) ON DELETE SET NULL`.
    13. New table `report_snapshot_sources`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `snapshot_id uuid NOT NULL REFERENCES report_snapshots(id) ON DELETE CASCADE`, `source_table varchar(100) NOT NULL`, `max_source_id text`, `watermark_timestamp timestamp NOT NULL`.
    14. New table `report_projection_watermarks`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`, `projection_name varchar(100) NOT NULL`, `last_watermark timestamp NOT NULL`, `row_count bigint NOT NULL DEFAULT 0`, `updated_at timestamp NOT NULL DEFAULT now()`.
    15. New table `report_delivery_events`: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `schedule_id uuid NOT NULL REFERENCES report_schedules(id) ON DELETE CASCADE`, `run_id uuid REFERENCES report_runs(id) ON DELETE SET NULL`, `recipient text NOT NULL`, `delivery_status varchar(50) NOT NULL`, `sent_at timestamp NOT NULL DEFAULT now()`, `failure_reason text`.
    16. Performance indexes:
        `CREATE INDEX IF NOT EXISTS report_runs_tenant_key_idx ON report_runs(tenant_id, report_key);`
        `CREATE INDEX IF NOT EXISTS report_runs_requester_idx ON report_runs(requester_id);`
        `CREATE INDEX IF NOT EXISTS report_artifacts_run_idx ON report_artifacts(run_id);`
        `CREATE INDEX IF NOT EXISTS report_schedules_tenant_active_idx ON report_schedules(tenant_id, is_active);`
        `CREATE INDEX IF NOT EXISTS report_snapshots_tenant_period_idx ON report_snapshots(tenant_id, period_key);`
  </action>
  <verify>Read back `migrations/0059_advanced_reporting_addon.sql` and verify syntax, FK targets, and idempotent clauses.</verify>
  <done>Migration SQL file created with all 15 tables and performance indexes.</done>
</task>

<task type="auto" id="01-02">
  <name>Create reporting schema Drizzle definitions and update permissions.ts</name>
  <files>src/addons/advanced-reporting/models/reporting-schema.ts, src/models/Schema.ts, src/libs/api/permissions.ts</files>
  <action>
    Define Drizzle table exports in `src/addons/advanced-reporting/models/reporting-schema.ts` matching migration `0059` exactly. Re-export table objects in `src/models/Schema.ts`. Update `src/libs/api/permissions.ts` to add `'reports.manage'` and `'reports.schedule'` to `PERMISSIONS` dictionary and default role mappings for `super_admin`, `school_admin`, `accountant`.
  </action>
  <verify>Run `npx tsc --noEmit` to confirm zero TypeScript compilation errors in schema and permissions files.</verify>
  <done>Drizzle schema definitions and reporting permission keys created and exported cleanly.</done>
</task>

<task type="auto" id="01-03">
  <name>Enable advanced-reporting in addon registry</name>
  <files>src/addons/registry.ts</files>
  <action>
    In `src/addons/registry.ts`, locate the `advanced-reporting` addon entry and set `enabled: true`.
  </action>
  <verify>Check `src/addons/registry.ts` and confirm `advanced-reporting` definition has `enabled: true`.</verify>
  <done>Addon registry updated with enabled status for advanced-reporting.</done>
</task>

<task type="auto" id="01-04">
  <name>Apply migration 0059 and update journal</name>
  <files>migrations/meta/_journal.json</files>
  <action>
    Apply `migrations/0059_advanced_reporting_addon.sql` via `psql` to the running database container and append journal entry to `migrations/meta/_journal.json`.
  </action>
  <verify>Run `psql` table checks (`\d report_definitions`, `\d report_runs`, etc.) to confirm table creation.</verify>
  <done>Migration 0059 applied to database and recorded in Drizzle journal.</done>
</task>
