-- 0153_attendance_excuse_scope.sql — EXACT EXCUSE SCOPE.
--
-- Approving an excuse previously rewrote EVERY attendance row for a
-- (student, date) across all periods and sections. The authoritative mark key
-- is (tenant, student, date, period, class_section), so an excuse now carries
-- the exact section + period it justifies; approval mutates only that mark.
--
-- Legacy rows keep NULL scope: they are never broad-applied again (the API
-- refuses to auto-approve an unscoped historical excuse rather than guessing).
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "attendance_excuses" ADD COLUMN IF NOT EXISTS "class_section_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD COLUMN IF NOT EXISTS "period" integer;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_excuses_class_section_id_fk') THEN
    ALTER TABLE "attendance_excuses"
      ADD CONSTRAINT "attendance_excuses_class_section_id_fk"
      FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attendance_excuses_scope_idx"
  ON "attendance_excuses" ("tenant_id", "student_id", "date", "period", "class_section_id");
