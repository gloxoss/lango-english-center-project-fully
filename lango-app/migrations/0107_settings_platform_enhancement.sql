-- Settings Platform Enhancement (hand-written, forward-only, idempotent).
-- Never regenerate with drizzle-kit generate. Safe to rerun.
--
-- Backs the settings-platform plan (future-implementation/settings-platform):
--   1. settingDefinitions + settingDefinitionVersions — runtime-editable catalog
--      synced from src/libs/settings/registry.ts (code-owned Zod validators stay
--      in code; only metadata is persisted).
--   2. settingDrafts + settingApprovals — maker/checker review workflow.
--   3. secretReferences — append-only cipher/rotation audit for secret keys.
--   4. numberingSeriesDefinitions + numberingSeriesVersions — invoice/matricule
--      numbering registries (FOR UPDATE + advisory-lock consumption in code).
--   5. customFieldDefinitions (+Versions) + customFieldValues — per-entity
--      custom attribute registry.
--   6. scheduledJobDefinitions + scheduledJobControls + scheduledJobRuns —
--      DB-backed scheduled jobs with an allowlisted handler worker.
--   7. loginEvents — email/password sign-in capture (success + failure).
--
-- Status/type columns are varchar (NOT Postgres enums) to match the rest of
-- the codebase; the TS-side literal unions are the source of truth.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setting_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(128) NOT NULL,
  "label" varchar(255) NOT NULL,
  "description" text,
  "namespace" varchar(100) NOT NULL,
  "scope" varchar(20) DEFAULT 'tenant' NOT NULL,
  "sensitivity" varchar(20) DEFAULT 'public' NOT NULL,
  "default_value" jsonb,
  "required_permission" varchar(128),
  "legacy_field" varchar(128),
  "is_active" boolean DEFAULT true NOT NULL,
  "is_code_owned" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "setting_definitions_tenant_key_unique" UNIQUE ("tenant_id", "key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_definitions" ADD CONSTRAINT "setting_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setting_definitions_tenant_ns_idx" ON "setting_definitions" ("tenant_id", "namespace");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setting_definition_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "definition_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "label" varchar(255) NOT NULL,
  "description" text,
  "namespace" varchar(100) NOT NULL,
  "scope" varchar(20) NOT NULL,
  "sensitivity" varchar(20) NOT NULL,
  "default_value" jsonb,
  "required_permission" varchar(128),
  "legacy_field" varchar(128),
  "actor_id" text,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_definition_versions" ADD CONSTRAINT "setting_definition_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_definition_versions" ADD CONSTRAINT "setting_definition_versions_definition_id_setting_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."setting_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setting_definition_versions_def_idx" ON "setting_definition_versions" ("definition_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setting_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(128) NOT NULL,
  "branch_id" uuid,
  "title" varchar(255) NOT NULL,
  "reason" text,
  "proposed_value" jsonb NOT NULL,
  "current_value" jsonb,
  "base_version" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "author_id" text NOT NULL,
  "approver_id" text,
  "rejection_reason" text,
  "reviewed_at" timestamp,
  "applied_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_drafts" ADD CONSTRAINT "setting_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_drafts" ADD CONSTRAINT "setting_drafts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setting_drafts_tenant_status_idx" ON "setting_drafts" ("tenant_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "setting_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "draft_id" uuid NOT NULL,
  "decision" varchar(20) NOT NULL,
  "approver_id" text NOT NULL,
  "comment" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_approvals" ADD CONSTRAINT "setting_approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_approvals" ADD CONSTRAINT "setting_approvals_draft_id_setting_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."setting_drafts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "setting_approvals" ADD CONSTRAINT "setting_approvals_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "setting_approvals_draft_idx" ON "setting_approvals" ("draft_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "secret_references" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(128) NOT NULL,
  "setting_value_id" uuid,
  "cipher" varchar(20) DEFAULT 'aes-256-gcm' NOT NULL,
  "rotated_at" timestamp NOT NULL,
  "rotated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "secret_references" ADD CONSTRAINT "secret_references_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "secret_references_tenant_key_idx" ON "secret_references" ("tenant_id", "key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "numbering_series_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(128) NOT NULL,
  "name" varchar(255) NOT NULL,
  "prefix" text,
  "suffix" text,
  "padding" integer DEFAULT 0 NOT NULL,
  "start" integer DEFAULT 1 NOT NULL,
  "current" integer DEFAULT 0 NOT NULL,
  "step" integer DEFAULT 1 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "numbering_series_definitions_tenant_key_unique" UNIQUE ("tenant_id", "key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "numbering_series_definitions" ADD CONSTRAINT "numbering_series_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "numbering_series_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "series_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "prefix" text,
  "suffix" text,
  "padding" integer NOT NULL,
  "start" integer NOT NULL,
  "current" integer NOT NULL,
  "step" integer NOT NULL,
  "actor_id" text,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "numbering_series_versions" ADD CONSTRAINT "numbering_series_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "numbering_series_versions" ADD CONSTRAINT "numbering_series_versions_series_id_numbering_series_definitions_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."numbering_series_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "numbering_series_versions_series_idx" ON "numbering_series_versions" ("series_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(128) NOT NULL,
  "label" varchar(255) NOT NULL,
  "entity_type" varchar(30) NOT NULL,
  "field_type" varchar(20) NOT NULL,
  "options" jsonb,
  "required" boolean DEFAULT false NOT NULL,
  "default_value" jsonb,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "custom_field_definitions_tenant_key_unique" UNIQUE ("tenant_id", "key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_definition_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "definition_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "label" varchar(255) NOT NULL,
  "entity_type" varchar(30) NOT NULL,
  "field_type" varchar(20) NOT NULL,
  "options" jsonb,
  "required" boolean NOT NULL,
  "default_value" jsonb,
  "sort_order" integer NOT NULL,
  "actor_id" text,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_field_definition_versions" ADD CONSTRAINT "custom_field_definition_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_field_definition_versions" ADD CONSTRAINT "custom_field_definition_versions_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_field_values" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "definition_id" uuid NOT NULL,
  "entity_id" text NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "custom_field_values_tenant_def_entity_unique" UNIQUE ("tenant_id", "definition_id", "entity_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_custom_field_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."custom_field_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_field_values_entity_idx" ON "custom_field_values" ("definition_id", "entity_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_job_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "key" varchar(128) NOT NULL,
  "name" varchar(255) NOT NULL,
  "handler" varchar(100) NOT NULL,
  "interval_minutes" integer,
  "cron" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_run_at" timestamp,
  "next_run_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "scheduled_job_definitions_tenant_key_unique" UNIQUE ("tenant_id", "key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_job_definitions" ADD CONSTRAINT "scheduled_job_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_job_definitions_due_idx" ON "scheduled_job_definitions" ("is_active", "next_run_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_job_controls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "action" varchar(30) NOT NULL,
  "actor_id" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_job_controls" ADD CONSTRAINT "scheduled_job_controls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_job_controls" ADD CONSTRAINT "scheduled_job_controls_job_id_scheduled_job_definitions_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scheduled_job_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduled_job_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "status" varchar(20) NOT NULL,
  "started_at" timestamp NOT NULL,
  "finished_at" timestamp,
  "duration_ms" integer,
  "error" text,
  "triggered_by" varchar(20) DEFAULT 'worker' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_job_id_scheduled_job_definitions_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scheduled_job_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_job_runs_job_idx" ON "scheduled_job_runs" ("job_id", "started_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "user_id" text,
  "email" varchar(255),
  "method" varchar(30) NOT NULL,
  "success" boolean NOT NULL,
  "failure_reason" text,
  "ip" varchar(45),
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "login_events" ADD CONSTRAINT "login_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_events_tenant_created_idx" ON "login_events" ("tenant_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_events_user_idx" ON "login_events" ("user_id", "created_at");
