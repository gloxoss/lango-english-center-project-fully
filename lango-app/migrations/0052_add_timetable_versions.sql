DO $$ BEGIN
 CREATE TYPE "public"."timetable_version_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "timetable_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_year_id" uuid NOT NULL,
	"status" "timetable_version_status" DEFAULT 'draft' NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"created_by" text NOT NULL,
	"published_by" text,
	"published_at" timestamp,
	"copied_from_version_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "timetable_versions" DROP CONSTRAINT IF EXISTS "timetable_versions_tenant_id_tenants_id_fk";
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "timetable_versions" DROP CONSTRAINT IF EXISTS "timetable_versions_session_year_id_session_years_id_fk";
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_session_year_id_session_years_id_fk" FOREIGN KEY ("session_year_id") REFERENCES "public"."session_years"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "timetable_versions" DROP CONSTRAINT IF EXISTS "timetable_versions_created_by_user_id_fk";
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "timetable_versions" DROP CONSTRAINT IF EXISTS "timetable_versions_published_by_user_id_fk";
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "timetable_versions_single_published_idx" ON "timetable_versions" ("tenant_id", "session_year_id") WHERE "status" = 'published';

-- Add version_id to class_schedule_slots
ALTER TABLE "class_schedule_slots" ADD COLUMN IF NOT EXISTS "version_id" uuid;

ALTER TABLE "class_schedule_slots" DROP CONSTRAINT IF EXISTS "class_schedule_slots_version_id_timetable_versions_id_fk";
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_version_id_timetable_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."timetable_versions"("id") ON DELETE cascade ON UPDATE no action;

-- Backfill synthetic "published v1" version for tenant+session_years with existing slots
WITH target_sessions AS (
	SELECT DISTINCT
		css.tenant_id,
		COALESCE(aco.session_year_id, sy.id) AS session_year_id
	FROM class_schedule_slots css
	LEFT JOIN academic_class_offerings aco ON aco.id = css.offering_id
	LEFT JOIN session_years sy ON sy.tenant_id = css.tenant_id AND sy.is_default = true
	WHERE css.version_id IS NULL AND COALESCE(aco.session_year_id, sy.id) IS NOT NULL
),
created_versions AS (
	INSERT INTO timetable_versions (id, tenant_id, session_year_id, status, version_number, created_by, published_by, published_at)
	SELECT 
		gen_random_uuid(),
		ts.tenant_id,
		ts.session_year_id,
		'published'::timetable_version_status,
		1,
		COALESCE((SELECT id FROM "user" u WHERE u.tenant_id = ts.tenant_id AND u.role = 'school_admin' LIMIT 1), 'USR-001'),
		COALESCE((SELECT id FROM "user" u WHERE u.tenant_id = ts.tenant_id AND u.role = 'school_admin' LIMIT 1), 'USR-001'),
		now()
	FROM target_sessions ts
	ON CONFLICT DO NOTHING
	RETURNING id, tenant_id, session_year_id
)
UPDATE class_schedule_slots css
SET version_id = cv.id
FROM created_versions cv
WHERE css.tenant_id = cv.tenant_id AND css.version_id IS NULL;
