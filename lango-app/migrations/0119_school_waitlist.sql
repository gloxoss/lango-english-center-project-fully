-- Super-admin school waitlist (bug 1.2): schools that requested early access
-- from the public marketing form before onboarding as tenants. Global table —
-- no tenant_id, because an entry exists before any tenant does.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.

CREATE TABLE IF NOT EXISTS "school_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_name" varchar(255) NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"city" varchar(100),
	"student_count" varchar(20),
	"phone" varchar(50),
	"email" varchar(255),
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"notes" text,
	"converted_tenant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "school_access_requests" ADD CONSTRAINT "school_access_requests_converted_tenant_id_tenants_id_fk" FOREIGN KEY ("converted_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "school_access_requests_status_idx" ON "school_access_requests" ("status");
