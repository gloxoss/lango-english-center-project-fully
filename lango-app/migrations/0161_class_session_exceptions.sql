-- 0161_class_session_exceptions.sql — ONE DAY IS NOT THE TIMETABLE.
--
-- class_schedule_slots is a WEEKLY RECURRENCE. It has no date, so it cannot
-- express "this Tuesday's lesson is cancelled" or "Mme X is replaced today".
-- Without that, a cancelled lesson was counted as a missing register and the
-- substitute teacher could not take a roll call they were actually covering.
--
-- An exception is a dated deviation from the recurrence:
--
--   (class_schedule_slot_id, date) -> cancelled | substitute | room change | reschedule
--
-- It attaches to the same occurrence identity phase 1 introduced, so the whole
-- attendance path (Appel du jour, teacher current lesson, missing registers,
-- alerts, the kiosk) sees the effective session without any of them knowing
-- exceptions exist.
--
-- The base timetable is NEVER mutated: cancelling a lesson for one day must not
-- rewrite the school's weekly schedule, and the exception keeps its own actor,
-- reason and timestamp as history.
--
-- ADDITIVE: a new table only. No existing table is altered and no row is touched.
--
-- Hand-written, forward-only, idempotent.

CREATE TABLE IF NOT EXISTS "class_session_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "class_schedule_slot_id" uuid NOT NULL,
  "date" date NOT NULL,
  "type" varchar(20) NOT NULL,
  -- Only the field the exception type actually changes is populated, so a
  -- ROOM_CHANGE cannot silently carry a stale substitute.
  "substitute_teacher_id" text,
  "room_label" varchar(100),
  "start_time" varchar(5),
  "end_time" varchar(5),
  "reason" text NOT NULL,
  "created_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "class_session_exceptions"
    ADD CONSTRAINT "class_session_exceptions_tenant_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "class_session_exceptions"
    ADD CONSTRAINT "class_session_exceptions_slot_id_fk"
    FOREIGN KEY ("class_schedule_slot_id") REFERENCES "class_schedule_slots"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- ONE EXCEPTION PER OCCURRENCE. A lesson cancelled for a day cannot also be
-- substituted that day: the row is the single answer for that occurrence, and
-- a second write updates it rather than accumulating contradictory ones.
CREATE UNIQUE INDEX IF NOT EXISTS "class_session_exceptions_occurrence_unique"
  ON "class_session_exceptions" ("tenant_id", "class_schedule_slot_id", "date");--> statement-breakpoint

-- The read path: "every exception on this date", loaded once per day view.
CREATE INDEX IF NOT EXISTS "class_session_exceptions_tenant_date_idx"
  ON "class_session_exceptions" ("tenant_id", "date");
