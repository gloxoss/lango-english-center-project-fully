-- Advanced HR & Employee Management add-on
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
CREATE TABLE IF NOT EXISTS "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(120) NOT NULL,
	"code" varchar(20),
	"head_employee_id" uuid,
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_head_employee_id_employee_profiles_id_fk" FOREIGN KEY ("head_employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_name_unique" UNIQUE ("tenant_id","name");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "designations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"department_id" uuid,
	"title" varchar(120) NOT NULL,
	"code" varchar(20),
	"description" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designations" ADD CONSTRAINT "designations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designations" ADD CONSTRAINT "designations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "designations" ADD CONSTRAINT "designations_tenant_title_unique" UNIQUE ("tenant_id","title");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"file_size" integer NOT NULL,
	"issued_at" date,
	"expiry_date" date,
	"visibility" varchar(20) DEFAULT 'private' NOT NULL,
	"uploaded_by_id" text,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_employment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"effective_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_employment_events" ADD CONSTRAINT "employee_employment_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_employment_events" ADD CONSTRAINT "employee_employment_events_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_employment_events" ADD CONSTRAINT "employee_employment_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"invited_email" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"consumed_at" timestamp,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_invitations" ADD CONSTRAINT "employee_invitations_token_hash_unique" UNIQUE ("token_hash");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- employee_profiles: allow employees without a login account
ALTER TABLE "employee_profiles" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
-- Preserve the profile if a user row is ever hard-deleted: cascade -> set null
ALTER TABLE "employee_profiles" DROP CONSTRAINT IF EXISTS "employee_profiles_user_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "branch_id" uuid;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "employee_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "department_id" uuid;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "designation_id" uuid;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "manager_employee_id" uuid;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "employment_type" varchar(20);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "employment_status" varchar(20) DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "hire_date" date;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "probation_end_date" date;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "contract_start_date" date;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "contract_end_date" date;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "workload_hours" integer;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "archived_by_id" text;
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "archived_reason" text;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_designation_id_designations_id_fk" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_manager_employee_id_employee_profiles_id_fk" FOREIGN KEY ("manager_employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_archived_by_id_user_id_fk" FOREIGN KEY ("archived_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_tenant_employee_id_unique" UNIQUE ("tenant_id","employee_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Resolve the global user.employee_id uniqueness mismatch: tenant-scoped
-- uniqueness now lives on employee_profiles. The user.employee_id column stays
-- as a read-only legacy mirror for teacher/roster UIs (see MIGRATION-NOTES.md).
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_employee_id_unique";
--> statement-breakpoint
-- Backfill: one employee_profiles row per existing staff user, idempotently.
-- Employee IDs are tenant-scoped sequential EMP-{year}-{NNNN}, mirrored back
-- into user.employee_id for compatibility.
WITH staff AS (
	SELECT
		u.id AS user_id,
		u.tenant_id,
		u.hire_date,
		u.created_at,
		ROW_NUMBER() OVER (PARTITION BY u.tenant_id ORDER BY u.created_at, u.id) AS seq
	FROM "user" u
	WHERE u.tenant_id IS NOT NULL
	  AND u.role::text IN ('school_admin','teacher','accountant','receptionist','guard')
	  AND u.user_status IN ('active','inactive','archived')
),
candidates AS (
	SELECT s.*
	FROM staff s
	LEFT JOIN employee_profiles ep ON ep.tenant_id = s.tenant_id AND ep.user_id = s.user_id
	WHERE ep.id IS NULL
)
INSERT INTO employee_profiles (tenant_id, user_id, employee_id, hire_date, employment_status, contract_type, dependants_count)
SELECT
	c.tenant_id,
	c.user_id,
	'EMP-' || to_char(now(), 'YYYY') || '-' || LPAD(c.seq::text, 4, '0'),
	c.hire_date,
	'active',
	'cdi',
	0
FROM candidates c;
--> statement-breakpoint
UPDATE "user" u
SET employee_id = ep.employee_id
FROM employee_profiles ep
WHERE ep.tenant_id = u.tenant_id
  AND ep.user_id = u.id
  AND u.employee_id IS NULL;
--> statement-breakpoint
-- Seed the EMP naming series so future app-generated ids do not collide with
-- backfilled ones. Shared counter across tenants is intentional: uniqueness is
-- enforced tenant-scoped on employee_profiles.tenant_id + employee_id.
WITH agg AS (
	SELECT
		(SELECT tenant_id FROM employee_profiles WHERE employee_id LIKE 'EMP-%' ORDER BY created_at LIMIT 1) AS tid,
		COALESCE(MAX(seq), 0) AS max_seq
	FROM (SELECT CAST(SPLIT_PART(employee_id, '-', 3) AS INTEGER) AS seq FROM employee_profiles WHERE employee_id LIKE 'EMP-%') x
)
INSERT INTO naming_series (prefix, tenant_id, current_val)
SELECT 'EMP-' || to_char(now(), 'YYYY') || '-', tid, max_seq
FROM agg
WHERE tid IS NOT NULL
ON CONFLICT (prefix) DO UPDATE SET current_val = GREATEST(naming_series.current_val, EXCLUDED.current_val);
