DO $$ BEGIN
 CREATE TYPE "certificate_event_kind" AS ENUM('issued', 'replaced', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "certificate_job_item_status" AS ENUM('pending', 'success', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "certificate_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "certificate_request_status" AS ENUM('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'issued', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "certificate_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "issued_certificate_status" AS ENUM('valid', 'replaced', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "certificate_definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"field_allowlist" jsonb NOT NULL,
	"template_schema" jsonb NOT NULL,
	"pdfme_base_pdf" jsonb NOT NULL,
	"status" "certificate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"allowed_target_type" varchar(50) NOT NULL,
	"status" "certificate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"issued_certificate_id" uuid NOT NULL,
	"event_kind" "certificate_event_kind" NOT NULL,
	"actor_id" uuid NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"status" "certificate_job_item_status" DEFAULT 'pending' NOT NULL,
	"error_reason" text,
	"issued_certificate_id" uuid
);

CREATE TABLE IF NOT EXISTS "certificate_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"status" "certificate_job_status" DEFAULT 'pending' NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"status" "certificate_request_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_signatories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"title" varchar(255) NOT NULL,
	"signature_image_id" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"template_schema" jsonb NOT NULL,
	"pdfme_base_pdf" jsonb NOT NULL,
	"status" "certificate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "certificate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS "issued_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"request_id" uuid,
	"serial_number" varchar(100) NOT NULL,
	"verification_token" varchar(255) NOT NULL,
	"verification_token_hash" varchar(255) NOT NULL,
	"status" "issued_certificate_status" DEFAULT 'valid' NOT NULL,
	"evidence_snapshot" jsonb NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"issued_by" uuid NOT NULL
);

CREATE INDEX IF NOT EXISTS "certificate_definitions_tenant_idx" ON "certificate_definitions" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_definition_versions_tenant_definition_version_idx" ON "certificate_definition_versions" ("tenant_id","definition_id","version_number");
CREATE INDEX IF NOT EXISTS "certificate_templates_tenant_idx" ON "certificate_templates" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_template_versions_tenant_template_version_idx" ON "certificate_template_versions" ("tenant_id","template_id","version_number");
CREATE INDEX IF NOT EXISTS "certificate_requests_tenant_idx" ON "certificate_requests" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "issued_certificates_tenant_serial_idx" ON "issued_certificates" ("tenant_id","serial_number");
CREATE UNIQUE INDEX IF NOT EXISTS "issued_certificates_tenant_token_idx" ON "issued_certificates" ("tenant_id","verification_token_hash");
CREATE INDEX IF NOT EXISTS "certificate_jobs_tenant_idx" ON "certificate_jobs" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_job_items_tenant_job_recipient_idx" ON "certificate_job_items" ("tenant_id","job_id","recipient_id");

DO $$ BEGIN
 ALTER TABLE "certificate_definition_versions" ADD CONSTRAINT "certificate_definition_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_definition_versions" ADD CONSTRAINT "certificate_definition_versions_definition_id_certificate_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "certificate_definitions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_definitions" ADD CONSTRAINT "certificate_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_events" ADD CONSTRAINT "certificate_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_events" ADD CONSTRAINT "certificate_events_issued_certificate_id_issued_certificates_id_fk" FOREIGN KEY ("issued_certificate_id") REFERENCES "issued_certificates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_job_items" ADD CONSTRAINT "certificate_job_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_job_items" ADD CONSTRAINT "certificate_job_items_job_id_certificate_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "certificate_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_jobs" ADD CONSTRAINT "certificate_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_requests" ADD CONSTRAINT "certificate_requests_definition_id_certificate_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "certificate_definitions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_signatories" ADD CONSTRAINT "certificate_signatories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_template_versions" ADD CONSTRAINT "certificate_template_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_template_versions" ADD CONSTRAINT "certificate_template_versions_template_id_certificate_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "certificate_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_definition_id_certificate_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "certificate_definitions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "issued_certificates" ADD CONSTRAINT "issued_certificates_version_id_certificate_definition_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "certificate_definition_versions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
