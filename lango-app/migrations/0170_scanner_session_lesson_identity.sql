-- 0170_scanner_session_lesson_identity.sql — A SCANNER SESSION NAMES A LESSON.
--
-- A scanner session used to name only a class section. So "which lesson is this
-- terminal scanning" had no answer in the data: verify-and-stage re-derived the
-- lesson from wall-clock time on every single scan. A session opened for the
-- 10:00 lesson silently accepted a 14:00 scan, and a badge from another section
-- had nothing to be wrong against.
--
-- Scanning has two homes (fix-plan-02), and this column is what tells them apart:
--
--   class_schedule_slot_id IS NOT NULL -> CLASSROOM session, bound to one
--     occurrence (slot x date). Scans must belong to that lesson's section.
--   class_schedule_slot_id IS NULL     -> ENTRANCE (portique) session. Any
--     student of the tenant/branch may badge in, and the scan records a campus
--     arrival only, never a lesson mark.
--
-- ADDITIVE AND NON-DESTRUCTIVE: both columns are nullable, so every existing
-- session row stays valid and keeps its present meaning ("no lesson identity"),
-- which is exactly the entrance reading. No row is rewritten or deleted. The
-- foreign key is ON DELETE SET NULL, so removing a timetable slot can never
-- destroy a scanning session or the scan events that point at it.
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "scanner_sessions" ADD COLUMN IF NOT EXISTS "class_schedule_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "scanner_sessions" ADD COLUMN IF NOT EXISTS "date" date;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "scanner_sessions"
    ADD CONSTRAINT "scanner_sessions_class_schedule_slot_id_fk"
    FOREIGN KEY ("class_schedule_slot_id") REFERENCES "class_schedule_slots"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ONE OPEN SESSION PER OCCURRENCE. Partial, so entrance sessions (NULL slot) and
-- closed sessions stay unconstrained: a terminal may open and close as often as
-- it likes across a day.
CREATE UNIQUE INDEX IF NOT EXISTS "scanner_sessions_occurrence_open_unique"
  ON "scanner_sessions" ("tenant_id", "class_schedule_slot_id", "date")
  WHERE "class_schedule_slot_id" IS NOT NULL AND "status" = 'active';--> statement-breakpoint

-- Lookup path for "the open session of this occurrence".
CREATE INDEX IF NOT EXISTS "scanner_sessions_slot_date_idx"
  ON "scanner_sessions" ("tenant_id", "class_schedule_slot_id", "date");--> statement-breakpoint

-- ONE OPEN ENTRANCE SESSION PER TERMINAL PER DAY. Same idea as the classroom
-- index above, for the other home: a gate terminal keeps one session open all
-- day and reuses it, so its counters mean "this terminal today" instead of
-- splitting in two if the page is reloaded. Keyed on the device when the
-- terminal is paired and on the operator when it is not, which is the only
-- identity an unpaired browser has. Still allow many sessions per day (they
-- may close and reopen), only one OPEN at a time.
CREATE UNIQUE INDEX IF NOT EXISTS "scanner_sessions_entrance_open_unique"
  ON "scanner_sessions" ("tenant_id", COALESCE("device_id"::text, "operator_id"), "date")
  WHERE "class_schedule_slot_id" IS NULL AND "status" = 'active';
