-- Role Portals Foundation — shared portal data (core feature, no addon)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Server-owned active-role context, portal preferences and portal activity
-- audit. active_role is varchar (reuses AppRole values), tenant_id is uuid
-- (matches the rest of the schema). See
-- future-implementation/role-portals-foundation/.implementation-plan/PLAN.md.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portal_active_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"active_role" varchar(30) NOT NULL,
	"active_branch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_active_contexts" ADD CONSTRAINT "portal_active_contexts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_active_contexts" ADD CONSTRAINT "portal_active_contexts_session_id_unique" UNIQUE ("session_id");
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE INDEX IF NOT EXISTS "portal_active_contexts_user_idx" ON "portal_active_contexts" ("user_id");
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portal_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"pref_key" varchar(120) NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_preferences" ADD CONSTRAINT "portal_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_preferences" ADD CONSTRAINT "portal_preferences_tenant_user_key_unique" UNIQUE ("tenant_id","user_id","pref_key");
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "portal_activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(30) NOT NULL,
	"action" varchar(60) NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_activity_events" ADD CONSTRAINT "portal_activity_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE INDEX IF NOT EXISTS "portal_activity_events_tenant_user_created_idx" ON "portal_activity_events" ("tenant_id","user_id","created_at");
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
