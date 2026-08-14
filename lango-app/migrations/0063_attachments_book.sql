-- Migration 0063: Attachments Book Add-on
-- Tenant-scoped academic resource library: attachment types, versioned digital assets, targeting, tags, usage links, access events

DO $$ BEGIN
  CREATE TYPE "asset_lifecycle_status" AS ENUM ('draft', 'uploading', 'quarantined', 'processing', 'ready', 'published', 'archived', 'upload_failed', 'scan_failed', 'infected', 'processing_failed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "asset_target_kind" AS ENUM ('school', 'role', 'class_offering', 'class_section', 'class_subject', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "attachment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"icon" text,
	"color" text,
	"allowed_mime_families" jsonb NOT NULL,
	"max_size_bytes" integer DEFAULT 26214400 NOT NULL,
	"student_visible" boolean DEFAULT true NOT NULL,
	"downloadable" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_attachment_types_tenant_code" UNIQUE("tenant_id", "code")
);

CREATE INDEX IF NOT EXISTS "idx_attachment_types_tenant" ON "attachment_types" ("tenant_id");

CREATE TABLE IF NOT EXISTS "digital_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"attachment_type_id" uuid NOT NULL REFERENCES "attachment_types"("id"),
	"owner_id" text NOT NULL,
	"language" text,
	"status" "asset_lifecycle_status" DEFAULT 'draft' NOT NULL,
	"current_version_id" uuid,
	"publish_at" timestamp,
	"unpublish_at" timestamp,
	"downloadable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_digital_assets_tenant_status" ON "digital_assets" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_digital_assets_owner" ON "digital_assets" ("owner_id");

CREATE TABLE IF NOT EXISTS "digital_asset_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "digital_assets"("id") ON DELETE CASCADE,
	"version_number" integer NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"safe_filename" text NOT NULL,
	"detected_mime" text NOT NULL,
	"extension" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"scan_status" text DEFAULT 'pending' NOT NULL, -- pending, clean, infected, error
	"uploader_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_digital_asset_versions_asset_version" UNIQUE("asset_id", "version_number")
);

CREATE INDEX IF NOT EXISTS "idx_digital_asset_versions_asset" ON "digital_asset_versions" ("asset_id");

CREATE TABLE IF NOT EXISTS "digital_asset_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "digital_assets"("id") ON DELETE CASCADE,
	"target_kind" "asset_target_kind" NOT NULL,
	"target_role_value" text,
	"target_ref_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_digital_asset_targets_asset" ON "digital_asset_targets" ("asset_id");

CREATE TABLE IF NOT EXISTS "digital_asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_digital_asset_tags_tenant_name" UNIQUE("tenant_id", "name")
);

CREATE TABLE IF NOT EXISTS "digital_asset_tag_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "digital_assets"("id") ON DELETE CASCADE,
	"tag_id" uuid NOT NULL REFERENCES "digital_asset_tags"("id") ON DELETE CASCADE,
	CONSTRAINT "uq_digital_asset_tag_links" UNIQUE("asset_id", "tag_id")
);

CREATE TABLE IF NOT EXISTS "digital_asset_derivatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL REFERENCES "digital_asset_versions"("id") ON DELETE CASCADE,
	"derivative_type" text NOT NULL, -- preview, thumbnail, text_extraction
	"storage_key" text,
	"generator_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "digital_asset_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "digital_assets"("id") ON DELETE CASCADE,
	"url" text NOT NULL,
	"provider" text,
	"validation_state" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "digital_asset_usage_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "digital_assets"("id") ON DELETE CASCADE,
	"usage_type" text NOT NULL, -- homework, announcement, live_class
	"usage_ref_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_digital_asset_usage_links_ref" ON "digital_asset_usage_links" ("usage_type", "usage_ref_id");
CREATE INDEX IF NOT EXISTS "idx_digital_asset_usage_links_asset" ON "digital_asset_usage_links" ("asset_id");

CREATE TABLE IF NOT EXISTS "digital_asset_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "digital_assets"("id") ON DELETE CASCADE,
	"actor_id" text NOT NULL,
	"event_type" text NOT NULL, -- preview, download
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_digital_asset_access_events_asset_date" ON "digital_asset_access_events" ("asset_id", "created_at");
