-- Advanced Reporting Add-on Migration: 0059_advanced_reporting_addon.sql

DO $$ BEGIN
  CREATE TYPE "report_run_status" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "report_export_format" AS ENUM ('csv', 'xlsx', 'pdf');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "report_definitions" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "domain" varchar(50) NOT NULL,
  "current_version" integer DEFAULT 1 NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "sensitivity_level" varchar(50) DEFAULT 'standard' NOT NULL,
  "freshness_type" varchar(50) DEFAULT 'realtime' NOT NULL,
  "execution_adapter" varchar(100) NOT NULL,
  "parameters_schema" jsonb,
  "columns_schema" jsonb,
  "supported_formats" text[] DEFAULT ARRAY['csv']::text[] NOT NULL,
  "required_permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_definition_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_key" varchar(100) NOT NULL REFERENCES "report_definitions"("key") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "query_adapter" varchar(100) NOT NULL,
  "sql_template" text,
  "columns_schema" jsonb,
  "parameters_schema" jsonb,
  "checksum" varchar(64),
  "published_at" timestamp DEFAULT now() NOT NULL,
  "published_by_id" text REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "report_saved_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "report_key" varchar(100) NOT NULL REFERENCES "report_definitions"("key") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "description" text,
  "owner_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "is_shared" boolean DEFAULT false NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_favorites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "report_key" varchar(100) NOT NULL REFERENCES "report_definitions"("key") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "report_key" varchar(100) NOT NULL REFERENCES "report_definitions"("key") ON DELETE CASCADE,
  "version" integer DEFAULT 1 NOT NULL,
  "requester_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" "report_run_status" DEFAULT 'queued' NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "as_of_date" timestamp DEFAULT now() NOT NULL,
  "source_watermarks" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "row_count" integer DEFAULT 0 NOT NULL,
  "execution_time_ms" integer,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp
);

CREATE TABLE IF NOT EXISTS "report_run_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "report_runs"("id") ON DELETE CASCADE,
  "event_type" varchar(50) NOT NULL,
  "message" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "report_runs"("id") ON DELETE CASCADE,
  "format" "report_export_format" NOT NULL,
  "file_path" text NOT NULL,
  "file_size_bytes" integer DEFAULT 0 NOT NULL,
  "checksum_sha256" varchar(64) NOT NULL,
  "download_count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "report_key" varchar(100) NOT NULL REFERENCES "report_definitions"("key") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "cron_expression" varchar(100) NOT NULL,
  "timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
  "format" "report_export_format" DEFAULT 'csv' NOT NULL,
  "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_schedule_recipients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schedule_id" uuid NOT NULL REFERENCES "report_schedules"("id") ON DELETE CASCADE,
  "recipient_type" varchar(20) NOT NULL,
  "recipient_target" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "report_key" varchar(100) NOT NULL REFERENCES "report_definitions"("key") ON DELETE CASCADE,
  "period_key" varchar(100) NOT NULL,
  "snapshot_data" jsonb NOT NULL,
  "checksum_sha256" varchar(64) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by_id" text REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "report_snapshot_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "snapshot_id" uuid NOT NULL REFERENCES "report_snapshots"("id") ON DELETE CASCADE,
  "source_table" varchar(100) NOT NULL,
  "max_source_id" text,
  "watermark_timestamp" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_projection_watermarks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "projection_name" varchar(100) NOT NULL,
  "last_watermark" timestamp NOT NULL,
  "row_count" bigint DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "report_delivery_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "schedule_id" uuid NOT NULL REFERENCES "report_schedules"("id") ON DELETE CASCADE,
  "run_id" uuid REFERENCES "report_runs"("id") ON DELETE SET NULL,
  "recipient" text NOT NULL,
  "delivery_status" varchar(50) NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "failure_reason" text
);

CREATE INDEX IF NOT EXISTS "report_runs_tenant_key_idx" ON "report_runs" ("tenant_id", "report_key");
CREATE INDEX IF NOT EXISTS "report_runs_requester_idx" ON "report_runs" ("requester_id");
CREATE INDEX IF NOT EXISTS "report_artifacts_run_idx" ON "report_artifacts" ("run_id");
CREATE INDEX IF NOT EXISTS "report_schedules_tenant_active_idx" ON "report_schedules" ("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "report_snapshots_tenant_period_idx" ON "report_snapshots" ("tenant_id", "period_key");
