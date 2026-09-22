-- 0146_subject_teacher_assignment_history.sql — TEACHER SUBJECT ASSIGNMENT HISTORY.
--
-- `subject_teachers` was a pure join row: no session-year scope, no lifecycle.
-- Reassignment therefore had to DELETE the previous row, erasing the only record
-- of who taught a subject to a section; and grade authorization could not tell a
-- current assignment from a historical one.
--
-- This migration adds the minimum history lifecycle:
--   * session_year_id — which school year the assignment belongs to
--   * starts_on / ends_on — assignment window
--   * status (existing enum) — active | inactive | archived
--
-- Reassignment becomes close-then-insert; current reads filter on
-- status='active' AND ends_on IS NULL/>= today AND session year = target.
-- Historical rows can coexist for the same (section, class-subject, teacher),
-- so the old unconditional unique constraint is replaced by a partial unique
-- index on ACTIVE rows only.
--
-- Hand-written, forward-only, idempotent.
-- Backfill order: offeringId -> academic_class_offerings.session_year_id, else
-- an unambiguous default session for the tenant. Rows that cannot be resolved
-- stay NULL and are reported by scripts/audit-subject-teacher-history (not
-- fabricated).

ALTER TABLE "subject_teachers" ADD COLUMN IF NOT EXISTS "session_year_id" uuid;--> statement-breakpoint
ALTER TABLE "subject_teachers" ADD COLUMN IF NOT EXISTS "starts_on" date;--> statement-breakpoint
ALTER TABLE "subject_teachers" ADD COLUMN IF NOT EXISTS "ends_on" date;--> statement-breakpoint
ALTER TABLE "subject_teachers" ADD COLUMN IF NOT EXISTS "status" "status" DEFAULT 'active' NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subject_teachers_session_year_id_session_years_id_fk') THEN
    ALTER TABLE "subject_teachers"
      ADD CONSTRAINT "subject_teachers_session_year_id_session_years_id_fk"
      FOREIGN KEY ("session_year_id") REFERENCES "session_years"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "subject_teachers" DROP CONSTRAINT IF EXISTS "subject_teachers_class_section_id_class_subject_id_teacher_id_unique";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "subject_teachers_active_unique"
  ON "subject_teachers" ("class_section_id", "class_subject_id", "teacher_id")
  WHERE "status" = 'active' AND "ends_on" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "subject_teachers_tenant_teacher_idx"
  ON "subject_teachers" ("tenant_id", "teacher_id", "status");--> statement-breakpoint

-- Backfill 1: session year from the linked class offering.
UPDATE "subject_teachers" st
SET "session_year_id" = aco."session_year_id"
FROM "academic_class_offerings" aco
WHERE st."session_year_id" IS NULL AND st."offering_id" = aco."id";--> statement-breakpoint

-- Backfill 2: the tenant's default session, only when it is unambiguous
-- (exactly one default). Ambiguous rows stay NULL on purpose.
UPDATE "subject_teachers" st
SET "session_year_id" = (
  SELECT sy."id" FROM "session_years" sy
  WHERE sy."tenant_id" = st."tenant_id" AND sy."is_default" = true
  LIMIT 1
)
WHERE st."session_year_id" IS NULL
  AND (SELECT count(*) FROM "session_years" sy WHERE sy."tenant_id" = st."tenant_id" AND sy."is_default" = true) = 1;--> statement-breakpoint

-- starts_on mirrors the original creation date.
UPDATE "subject_teachers" SET "starts_on" = "created_at"::date WHERE "starts_on" IS NULL;
