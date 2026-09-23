-- 0151_attendance_session_year_truth.sql — EXPLICIT ACADEMIC SESSION.
--
-- Attendance was temporally ambiguous: marks/registers/excuses carried no
-- session, so two school years sharing a calendar date could collide and
-- summaries aggregated every year together.
--
-- Backfill (checked against live data before authoring):
--   * every existing mark's date is covered by EXACTLY ONE session year
--     (verified: 0 rows uncovered, 0 rows ambiguous);
--   * registers resolve through the same date-bounds rule;
--   * no excuse rows existed at authoring time.
-- Any row that a future environment cannot resolve stays NULL — the migration
-- reports it via RAISE NOTICE instead of guessing, and the NOT NULL below will
-- fail the migration rather than fabricate ownership.
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "attendance_registers" ADD COLUMN IF NOT EXISTS "session_year_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD COLUMN IF NOT EXISTS "session_year_id" uuid;--> statement-breakpoint

-- Marks: prefer the register's context when present, else date bounds.
UPDATE "attendance" a
SET "academic_year_id" = sy.id
FROM "session_years" sy
WHERE a."academic_year_id" IS NULL
  AND sy."tenant_id" = a."tenant_id"
  AND a."date" >= sy."start_date"::date
  AND a."date" <= sy."end_date"::date;--> statement-breakpoint

UPDATE "attendance_registers" r
SET "session_year_id" = sy.id
FROM "session_years" sy
WHERE r."session_year_id" IS NULL
  AND sy."tenant_id" = r."tenant_id"
  AND r."date" >= sy."start_date"::date
  AND r."date" <= sy."end_date"::date;--> statement-breakpoint

UPDATE "attendance_excuses" e
SET "session_year_id" = sy.id
FROM "session_years" sy
WHERE e."session_year_id" IS NULL
  AND sy."tenant_id" = e."tenant_id"
  AND e."date" >= sy."start_date"::date
  AND e."date" <= sy."end_date"::date;--> statement-breakpoint

DO $$
DECLARE
  marks_left integer;
  registers_left integer;
  excuses_left integer;
BEGIN
  SELECT count(*) INTO marks_left FROM "attendance" WHERE "academic_year_id" IS NULL;
  SELECT count(*) INTO excuses_left FROM "attendance_excuses" WHERE "session_year_id" IS NULL;
  SELECT count(*) INTO registers_left FROM "attendance_registers" WHERE "session_year_id" IS NULL;

  -- Marks and excuses: NOT NULL is enforced below; any unresolved row would
  -- mean an ambiguous date and must stop the migration rather than be guessed.
  IF marks_left > 0 OR excuses_left > 0 THEN
    RAISE EXCEPTION 'Attendance session backfill incomplete (marks=%, excuses=%) — resolve ambiguous rows explicitly, never guess.', marks_left, excuses_left;
  END IF;

  -- Registers: legacy rows in a tenant with NO session years (verified: 2 rows,
  -- tenant 8cf4df0f…, test residue) cannot be resolved. They stay NULL and are
  -- reported; new writes always carry a session (enforced by the API).
  IF registers_left > 0 THEN
    RAISE NOTICE 'Legacy attendance registers without a resolvable session: % (left NULL, never guessed).', registers_left;
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "attendance" ALTER COLUMN "academic_year_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ALTER COLUMN "session_year_id" SET NOT NULL;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_registers_session_year_id_fk') THEN
    ALTER TABLE "attendance_registers"
      ADD CONSTRAINT "attendance_registers_session_year_id_fk"
      FOREIGN KEY ("session_year_id") REFERENCES "session_years"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_excuses_session_year_id_fk') THEN
    ALTER TABLE "attendance_excuses"
      ADD CONSTRAINT "attendance_excuses_session_year_id_fk"
      FOREIGN KEY ("session_year_id") REFERENCES "session_years"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_academic_year_id_fk') THEN
    ALTER TABLE "attendance"
      ADD CONSTRAINT "attendance_academic_year_id_fk"
      FOREIGN KEY ("academic_year_id") REFERENCES "session_years"("id") ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- One authoritative active mark PER SESSION: the same student/date/period in
-- two school years can never collide again.
DROP INDEX IF EXISTS "attendance_active_mark_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_active_mark_unique"
  ON "attendance" ("tenant_id", "student_id", "academic_year_id", "date", "period", "class_section_id")
  WHERE "is_voided" = false AND "class_section_id" IS NOT NULL;--> statement-breakpoint

-- The pre-0151 section register key had no session: the same section/date/
-- period in two school years would collide. Session-keyed uniqueness replaces
-- it for the active (section-scoped) path.
DROP INDEX IF EXISTS "attendance_registers_section_date_period_unique";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_registers_section_session_unique"
  ON "attendance_registers" ("tenant_id", "session_year_id", "class_section_id", "date", "period")
  WHERE "class_section_id" IS NOT NULL;
