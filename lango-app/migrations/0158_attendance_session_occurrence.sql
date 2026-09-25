-- 0158_attendance_session_occurrence.sql — EXACT SESSION IDENTITY.
--
-- Until now a register was identified by (class_section, date, period), where
-- `period` was a hand-picked number 1..8. That number comes from no timetable:
-- it cannot tell you WHICH lesson was registered, so "does this section have a
-- register today" was the strongest question the data could answer. One marked
-- period therefore hid every other unmarked lesson of the same section, and
-- "registres manquants" could never name the lesson that was actually missing.
--
-- The canonical identity is now the scheduled session occurrence:
--
--     class_schedule_slots  x  date   (under the published effective version)
--
-- A slot already carries section, subject, teacher, start/end, room and
-- version, so (slot, date) identifies the occurrence without materialising a
-- row per school day. Exceptions (cancellation, substitution, room change,
-- reschedule — phase 6) attach to that same identity.
--
-- ADDITIVE AND NON-DESTRUCTIVE:
--   * every column is nullable, so no existing row is invalidated;
--   * `period` and every legacy column are kept exactly as they are, so
--     historical registers stay readable and answerable;
--   * no row is rewritten, migrated or deleted;
--   * foreign keys are ON DELETE SET NULL, so removing a timetable slot can
--     never destroy attendance history.
--
-- Legacy rows keep class_schedule_slot_id NULL and continue to be matched by
-- the legacy (section, date, period) key. The partial unique index below only
-- governs session-keyed rows, so the two key spaces cannot collide.
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "attendance_registers" ADD COLUMN IF NOT EXISTS "class_schedule_slot_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_registers" ADD COLUMN IF NOT EXISTS "timetable_version_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "attendance_registers"
    ADD CONSTRAINT "attendance_registers_class_schedule_slot_id_fk"
    FOREIGN KEY ("class_schedule_slot_id") REFERENCES "class_schedule_slots"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "attendance_registers"
    ADD CONSTRAINT "attendance_registers_timetable_version_id_fk"
    FOREIGN KEY ("timetable_version_id") REFERENCES "timetable_versions"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ONE REGISTER PER OCCURRENCE. Partial: legacy rows (NULL slot) are untouched
-- and keep relying on the legacy (section, date, period) index.
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_registers_session_unique"
  ON "attendance_registers" ("tenant_id", "class_schedule_slot_id", "date")
  WHERE "class_schedule_slot_id" IS NOT NULL;--> statement-breakpoint

-- Lookup path for "the register of this occurrence" and for the missing-register
-- scan, which walks ended occurrences of a date.
CREATE INDEX IF NOT EXISTS "attendance_registers_slot_date_idx"
  ON "attendance_registers" ("tenant_id", "class_schedule_slot_id", "date");
