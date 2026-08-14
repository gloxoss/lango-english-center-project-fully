-- Parent / Guardian Portal — relationship lifecycle + rights (core feature)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Adds the effective-relationship state and per-relationship access rights to
-- guardian_students so a guardian portal can authorize each child request on an
-- *effective* link, and a feature-owned table for one-time guardian self-link
-- tokens (never a password). See
-- future-implementation/parent-guardian-portal/.implementation-plan/PLAN.md.

--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'active';
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "effective_from" timestamp;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "effective_to" timestamp;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "can_access_academic" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "can_access_attendance" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "can_access_finance" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "can_access_medical" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "can_access_communication" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "is_financially_responsible" boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "has_pickup_authority" boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "custody_restriction" varchar(50);
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guardian_students" ADD COLUMN "sensitive_contact_hidden" boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guardian_students_tenant_status_idx" ON "guardian_students" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guardian_students_guardian_status_eff_idx" ON "guardian_students" ("guardian_id","status","effective_from");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parent_guardian_link_tokens" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "guardian_id" uuid NOT NULL,
  "token" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_by" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "parent_guardian_link_tokens_token_unique" UNIQUE ("token"),
  CONSTRAINT "parent_guardian_link_tokens_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "parent_guardian_link_tokens_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parent_guardian_link_tokens_guardian_idx" ON "parent_guardian_link_tokens" ("guardian_id");
