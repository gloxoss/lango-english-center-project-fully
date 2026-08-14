-- Lead CRM + Broadcast Messaging add-ons.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Part A extends the authoritative `inquiries` table (tags + ad sources + pipeline
-- indexes). Part B adds the broadcast-messaging schema (connections, consent,
-- suppressions, segments, versioned templates, campaigns, recipient snapshots,
-- deliveries + immutable events, automations/runs).

--> statement-breakpoint
ALTER TYPE "public"."inquiry_source" ADD VALUE IF NOT EXISTS 'facebook_ads';
--> statement-breakpoint
ALTER TYPE "public"."inquiry_source" ADD VALUE IF NOT EXISTS 'google_ads';
--> statement-breakpoint
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_tenant_status_idx" ON "inquiries" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_tenant_source_idx" ON "inquiries" ("tenant_id","source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiries_tenant_phone_idx" ON "inquiries" ("tenant_id","phone");

-- ---------------------------------------------------------------------------
-- Broadcast enums (idempotent)
-- ---------------------------------------------------------------------------
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."broadcast_channel" AS ENUM('sms','email','whatsapp','telegram','messenger');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_connection_status" AS ENUM('connected','disconnected','error');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_template_status" AS ENUM('draft','published','archived');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_provider_approval_status" AS ENUM('not_required','draft','pending','approved','rejected');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_campaign_status" AS ENUM('draft','pending_approval','scheduled','queued','sending','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_recipient_status" AS ENUM('pending','queued','skipped','sent','failed');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_delivery_status" AS ENUM('queued','sent','delivered','failed','bounced','complained');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_delivery_event_type" AS ENUM('queued','sent','delivered','failed','bounced','complained','retry','webhook_received');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_recipient_kind" AS ENUM('inquiry','student','guardian','staff','alumni','external');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_automation_kind" AS ENUM('birthday_student','birthday_staff');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_automation_run_status" AS ENUM('pending','running','completed','failed');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."communication_automation_recipient_status" AS ENUM('queued','skipped','sent','failed');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- Channel connections
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"channel" "public"."broadcast_channel" NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider" varchar(60) NOT NULL,
	"config_json" jsonb DEFAULT '{}' NOT NULL,
	"status" "public"."communication_connection_status" DEFAULT 'disconnected' NOT NULL,
	"last_tested_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_connections" ADD CONSTRAINT "communication_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_connections" ADD CONSTRAINT "communication_connections_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_connections" ADD CONSTRAINT "communication_connections_tenant_channel_unique" UNIQUE ("tenant_id","channel");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_connections_tenant_idx" ON "communication_connections" ("tenant_id");

-- ---------------------------------------------------------------------------
-- Consent & suppression
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_kind" "public"."communication_recipient_kind" NOT NULL,
	"recipient_id" text NOT NULL,
	"channel" "public"."broadcast_channel" NOT NULL,
	"granted" boolean DEFAULT true NOT NULL,
	"source" varchar(60) DEFAULT 'admin' NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_consents" ADD CONSTRAINT "communication_consents_tenant_recipient_channel_unique" UNIQUE ("tenant_id","recipient_kind","recipient_id","channel");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_consents_tenant_kind_idx" ON "communication_consents" ("tenant_id","recipient_kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_kind" "public"."communication_recipient_kind" NOT NULL,
	"recipient_id" text NOT NULL,
	"channel" "public"."broadcast_channel",
	"reason" varchar(255),
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_suppressions" ADD CONSTRAINT "communication_suppressions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_suppressions" ADD CONSTRAINT "communication_suppressions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communication_suppressions_global_unique" ON "communication_suppressions" ("tenant_id","recipient_kind","recipient_id") WHERE channel IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communication_suppressions_channel_unique" ON "communication_suppressions" ("tenant_id","recipient_kind","recipient_id","channel") WHERE channel IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_suppressions_tenant_kind_idx" ON "communication_suppressions" ("tenant_id","recipient_kind");

-- ---------------------------------------------------------------------------
-- Saved segments
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(120) NOT NULL,
	"description" text,
	"definition" jsonb DEFAULT '{}' NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"last_computed_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_segments" ADD CONSTRAINT "communication_segments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_segments" ADD CONSTRAINT "communication_segments_tenant_name_unique" UNIQUE ("tenant_id","name");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_segments_tenant_idx" ON "communication_segments" ("tenant_id");

-- ---------------------------------------------------------------------------
-- Versioned templates
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"channel" "public"."broadcast_channel" NOT NULL,
	"category" varchar(60) DEFAULT 'general' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_tenant_channel_name_unique" UNIQUE ("tenant_id","channel","name");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_templates_tenant_idx" ON "communication_templates" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"subject" varchar(255),
	"body_text" text NOT NULL,
	"body_html" text,
	"variable_schema" jsonb DEFAULT '[]' NOT NULL,
	"locale" varchar(10) DEFAULT 'fr' NOT NULL,
	"status" "public"."communication_template_status" DEFAULT 'draft' NOT NULL,
	"provider_approval_status" "public"."communication_provider_approval_status" DEFAULT 'not_required' NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_template_versions" ADD CONSTRAINT "communication_template_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_template_versions" ADD CONSTRAINT "communication_template_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."communication_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_template_versions" ADD CONSTRAINT "communication_template_versions_tenant_template_version_unique" UNIQUE ("tenant_id","template_id","version");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_template_versions_tenant_template_idx" ON "communication_template_versions" ("tenant_id","template_id");

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(120) NOT NULL,
	"channel" "public"."broadcast_channel" NOT NULL,
	"connection_id" uuid,
	"segment_id" uuid,
	"template_id" uuid,
	"template_version_id" uuid,
	"subject" varchar(255),
	"body_text" text NOT NULL,
	"body_html" text,
	"schedule_at" timestamp,
	"timezone" varchar(60) DEFAULT 'Africa/Casablanca' NOT NULL,
	"status" "public"."communication_campaign_status" DEFAULT 'draft' NOT NULL,
	"targeted_count" integer DEFAULT 0 NOT NULL,
	"excluded_count" integer DEFAULT 0 NOT NULL,
	"invalid_count" integer DEFAULT 0 NOT NULL,
	"dedup_count" integer DEFAULT 0 NOT NULL,
	"consent_excluded_count" integer DEFAULT 0 NOT NULL,
	"suppression_excluded_count" integer DEFAULT 0 NOT NULL,
	"enqueued_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"delivered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"estimated_cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"idempotency_key" varchar(120),
	"created_by" text,
	"approved_by" text,
	"approved_at" timestamp,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."communication_connections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."communication_segments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."communication_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaigns" ADD CONSTRAINT "communication_campaigns_template_version_id_versions_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."communication_template_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communication_campaigns_tenant_idempotency_unique" ON "communication_campaigns" ("tenant_id","idempotency_key") WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_campaigns_tenant_status_idx" ON "communication_campaigns" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_campaigns_tenant_created_idx" ON "communication_campaigns" ("tenant_id","created_at");

-- ---------------------------------------------------------------------------
-- Recipient snapshot + deliveries + immutable events
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"recipient_kind" "public"."communication_recipient_kind" NOT NULL,
	"recipient_id" text NOT NULL,
	"contact_name" varchar(255),
	"phone" varchar(50),
	"email" varchar(255),
	"status" "public"."communication_recipient_status" DEFAULT 'pending' NOT NULL,
	"skip_reason" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaign_recipients" ADD CONSTRAINT "communication_campaign_recipients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaign_recipients" ADD CONSTRAINT "communication_campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."communication_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_campaign_recipients" ADD CONSTRAINT "communication_campaign_recipients_tenant_campaign_recipient_unique" UNIQUE ("tenant_id","campaign_id","recipient_kind","recipient_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_campaign_recipients_campaign_status_idx" ON "communication_campaign_recipients" ("campaign_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"channel" "public"."broadcast_channel" NOT NULL,
	"provider" varchar(60) NOT NULL,
	"status" "public"."communication_delivery_status" DEFAULT 'queued' NOT NULL,
	"provider_ref" varchar(255),
	"failure_reason" varchar(255),
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"locked_until" timestamp,
	"idempotency_key" varchar(200),
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_deliveries" ADD CONSTRAINT "communication_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_deliveries" ADD CONSTRAINT "communication_deliveries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."communication_campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_deliveries" ADD CONSTRAINT "communication_deliveries_recipient_id_campaign_recipients_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."communication_campaign_recipients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communication_deliveries_tenant_idempotency_unique" ON "communication_deliveries" ("tenant_id","idempotency_key") WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_deliveries_campaign_status_idx" ON "communication_deliveries" ("campaign_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_deliveries_tenant_status_idx" ON "communication_deliveries" ("tenant_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_delivery_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"campaign_id" uuid,
	"event_type" "public"."communication_delivery_event_type" NOT NULL,
	"status" varchar(40),
	"detail" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_delivery_events" ADD CONSTRAINT "communication_delivery_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_delivery_events" ADD CONSTRAINT "communication_delivery_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."communication_deliveries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_delivery_events_delivery_created_idx" ON "communication_delivery_events" ("delivery_id","created_at");

-- ---------------------------------------------------------------------------
-- Automations + runs + per-person dedup
-- ---------------------------------------------------------------------------
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(120) NOT NULL,
	"kind" "public"."communication_automation_kind" NOT NULL,
	"channel" "public"."broadcast_channel" NOT NULL,
	"connection_id" uuid,
	"template_id" uuid,
	"audience_kind" varchar(30) DEFAULT 'student' NOT NULL,
	"timezone" varchar(60) DEFAULT 'Africa/Casablanca' NOT NULL,
	"send_time" varchar(5) NOT NULL,
	"quiet_hours_start" varchar(5),
	"quiet_hours_end" varchar(5),
	"approval_mode" varchar(20) DEFAULT 'auto' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automations" ADD CONSTRAINT "communication_automations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_automations_tenant_kind_idx" ON "communication_automations" ("tenant_id","kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"run_date" varchar(10) NOT NULL,
	"status" "public"."communication_automation_run_status" DEFAULT 'pending' NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"queued_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automation_runs" ADD CONSTRAINT "communication_automation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automation_runs" ADD CONSTRAINT "communication_automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."communication_automations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automation_runs" ADD CONSTRAINT "communication_automation_runs_tenant_automation_date_unique" UNIQUE ("tenant_id","automation_id","run_date");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_automation_runs_tenant_idx" ON "communication_automation_runs" ("tenant_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communication_automation_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"person_id" text NOT NULL,
	"channel" "public"."broadcast_channel" NOT NULL,
	"status" "public"."communication_automation_recipient_status" DEFAULT 'queued' NOT NULL,
	"skip_reason" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automation_recipients" ADD CONSTRAINT "communication_automation_recipients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automation_recipients" ADD CONSTRAINT "communication_automation_recipients_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."communication_automation_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "communication_automation_recipients" ADD CONSTRAINT "communication_automation_recipients_tenant_run_person_channel_unique" UNIQUE ("tenant_id","run_id","person_id","channel");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "communication_automation_recipients_run_idx" ON "communication_automation_recipients" ("run_id");

-- DOWN (dev/test only): drop broadcast tables in reverse dependency order.
-- DROP TABLE IF EXISTS "communication_automation_recipients";
-- DROP TABLE IF EXISTS "communication_automation_runs";
-- DROP TABLE IF EXISTS "communication_automations";
-- DROP TABLE IF EXISTS "communication_delivery_events";
-- DROP TABLE IF EXISTS "communication_deliveries";
-- DROP TABLE IF EXISTS "communication_campaign_recipients";
-- DROP TABLE IF EXISTS "communication_campaigns";
-- DROP TABLE IF EXISTS "communication_template_versions";
-- DROP TABLE IF EXISTS "communication_templates";
-- DROP TABLE IF EXISTS "communication_segments";
-- DROP TABLE IF EXISTS "communication_suppressions";
-- DROP TABLE IF EXISTS "communication_consents";
-- DROP TABLE IF EXISTS "communication_connections";
-- DROP INDEX IF EXISTS "inquiries_tenant_status_idx"; DROP INDEX IF EXISTS "inquiries_tenant_source_idx"; DROP INDEX IF EXISTS "inquiries_tenant_phone_idx";
-- ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "tags";
