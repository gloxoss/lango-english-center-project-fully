DO $$ BEGIN
 CREATE TYPE "public"."document_template_type" AS ENUM('student_id', 'employee_id', 'admit_card');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_template_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."issued_document_status" AS ENUM('active', 'expired', 'revoked', 'replaced');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_subject_type" AS ENUM('student', 'employee', 'exam_candidate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_generation_job_status" AS ENUM('queued', 'processing', 'partially_completed', 'completed', 'failed', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_generation_item_status" AS ENUM('pending', 'success', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."document_event_kind" AS ENUM('issued', 'downloaded', 'printed', 'reprinted', 'replaced', 'revoked', 'verified');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "document_template_type" NOT NULL,
	"status" "document_template_status" DEFAULT 'draft' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"page_width_mm" integer NOT NULL,
	"page_height_mm" integer NOT NULL,
	"orientation" varchar(20) NOT NULL,
	"schema_json" jsonb NOT NULL,
	"storage_key" varchar(255),
	"published_by_id" uuid,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issued_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "document_template_type" NOT NULL,
	"template_version_id" uuid NOT NULL,
	"subject_type" "document_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"exam_candidate_id" uuid,
	"public_token_hash" varchar(255) NOT NULL,
	"status" "issued_document_status" DEFAULT 'active' NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"render_data_snapshot" jsonb NOT NULL,
	"issued_by_id" uuid NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"replaced_document_id" uuid,
	"revoked_at" timestamp,
	"revoked_by_id" uuid,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "document_template_type" NOT NULL,
	"template_version_id" uuid NOT NULL,
	"filters_snapshot" jsonb NOT NULL,
	"status" "document_generation_job_status" DEFAULT 'queued' NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_generation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"subject_type" "document_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"issued_document_id" uuid,
	"status" "document_generation_item_status" DEFAULT 'pending' NOT NULL,
	"error_code" varchar(50),
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"issued_document_id" uuid NOT NULL,
	"event_kind" "document_event_kind" NOT NULL,
	"actor_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issued_documents" ADD CONSTRAINT "issued_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "issued_documents" ADD CONSTRAINT "issued_documents_template_version_id_document_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."document_template_versions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_generation_jobs" ADD CONSTRAINT "document_generation_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_generation_jobs" ADD CONSTRAINT "document_generation_jobs_template_version_id_document_template_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."document_template_versions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_generation_items" ADD CONSTRAINT "document_generation_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_generation_items" ADD CONSTRAINT "document_generation_items_job_id_document_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."document_generation_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_events" ADD CONSTRAINT "document_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_events" ADD CONSTRAINT "document_events_issued_document_id_issued_documents_id_fk" FOREIGN KEY ("issued_document_id") REFERENCES "public"."issued_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_templates_tenant_idx" ON "document_templates" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_template_versions_tenant_template_version_idx" ON "document_template_versions" USING btree ("tenant_id", "template_id", "version_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issued_documents_tenant_token_idx" ON "issued_documents" USING btree ("tenant_id", "public_token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_generation_jobs_tenant_idx" ON "document_generation_jobs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_generation_items_tenant_job_subject_idx" ON "document_generation_items" USING btree ("tenant_id", "job_id", "subject_type", "subject_id");
