-- Migration: 0147_applicants_branch_session_and_lifecycle.sql
-- Architecture correction: Separate Admission Decision from Student Enrollment.
-- Adds authoritative branch_id, session_year_id, national_id (Code Massar),
-- and decision/enrollment lifecycle audit timestamps to `applicants`.
-- Conservative backfill for converted students; legacy academic_year_id is deprecated.

ALTER TABLE "applicants"
  ADD COLUMN IF NOT EXISTS "branch_id" uuid,
  ADD COLUMN IF NOT EXISTS "session_year_id" uuid,
  ADD COLUMN IF NOT EXISTS "national_id" varchar(100),
  ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "approved_by_id" text,
  ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "rejected_by_id" text,
  ADD COLUMN IF NOT EXISTS "rejection_reason" text,
  ADD COLUMN IF NOT EXISTS "enrolled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "enrolled_by_id" text;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_branch_id_branches_id_fk') THEN
    ALTER TABLE "applicants" ADD CONSTRAINT "applicants_branch_id_branches_id_fk"
      FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_session_year_id_session_years_id_fk') THEN
    ALTER TABLE "applicants" ADD CONSTRAINT "applicants_session_year_id_session_years_id_fk"
      FOREIGN KEY ("session_year_id") REFERENCES "session_years"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_approved_by_id_user_id_fk') THEN
    ALTER TABLE "applicants" ADD CONSTRAINT "applicants_approved_by_id_user_id_fk"
      FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_rejected_by_id_user_id_fk') THEN
    ALTER TABLE "applicants" ADD CONSTRAINT "applicants_rejected_by_id_user_id_fk"
      FOREIGN KEY ("rejected_by_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applicants_enrolled_by_id_user_id_fk') THEN
    ALTER TABLE "applicants" ADD CONSTRAINT "applicants_enrolled_by_id_user_id_fk"
      FOREIGN KEY ("enrolled_by_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "applicants_tenant_branch_idx" ON "applicants" ("tenant_id", "branch_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applicants_tenant_session_idx" ON "applicants" ("tenant_id", "session_year_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applicants_tenant_status_idx" ON "applicants" ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applicants_national_id_idx" ON "applicants" ("tenant_id", "national_id");
--> statement-breakpoint

-- Conservative backfill: for applicants already converted to students,
-- backfill branch_id from user.branch_id and session_year_id from the student's active placement.
-- For converted applicants with status 'approved', align status to 'enrolled'.
UPDATE "applicants" a
SET
  "branch_id" = COALESCE(a."branch_id", u."branch_id"),
  "national_id" = COALESCE(a."national_id", u."national_id"),
  "status" = CASE WHEN a."status" = 'approved' AND a."converted_user_id" IS NOT NULL THEN 'enrolled' ELSE a."status" END,
  "enrolled_at" = COALESCE(a."enrolled_at", a."application_date")
FROM "user" u
WHERE a."converted_user_id" = u."id";
--> statement-breakpoint

UPDATE "applicants" a
SET "session_year_id" = COALESCE(a."session_year_id", sp."session_year_id")
FROM "student_placements" sp
WHERE a."converted_user_id" = sp."student_id" AND sp."is_current" = true;
--> statement-breakpoint
