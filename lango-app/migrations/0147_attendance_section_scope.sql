-- 0147_attendance_section_scope.sql — ATTENDANCE SECTION SCOPE.
--
-- Registers were keyed by (tenant, class, date, period). The attendance UI
-- submits a class SECTION while the API resolved it to the parent class, so
-- Section A and Section B of the same level shared one register: submitting
-- Section A LOCKED Section B, and reading Section B returned Section A rows.
--
-- This migration makes new writes section-aware without fabricating history:
--   * attendance_registers.class_section_id — operating section of the register
--   * attendance.class_section_id — operating section of each mark
--   * uniqueness: section-keyed for new rows; legacy rows (null section) keep
--     the old class-level key so they cannot collide with section rows.
--
-- Historical rows intentionally keep NULL class_section_id: the section a
-- student belonged to at marking time was never stored and must not be guessed.
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "attendance_registers" ADD COLUMN IF NOT EXISTS "class_section_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "class_section_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_registers_class_section_id_fk') THEN
    ALTER TABLE "attendance_registers"
      ADD CONSTRAINT "attendance_registers_class_section_id_fk"
      FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_class_section_id_class_sections_id_fk') THEN
    ALTER TABLE "attendance"
      ADD CONSTRAINT "attendance_class_section_id_class_sections_id_fk"
      FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- Replace the class-level unique key with section-aware keys.
ALTER TABLE "attendance_registers" DROP CONSTRAINT IF EXISTS "attendance_registers_class_date_period_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "attendance_registers_class_date_period_unique";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_registers_section_date_period_unique"
  ON "attendance_registers" ("tenant_id", "class_section_id", "date", "period")
  WHERE "class_section_id" IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_registers_legacy_class_date_period_unique"
  ON "attendance_registers" ("tenant_id", "class_id", "date", "period")
  WHERE "class_section_id" IS NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attendance_registers_tenant_section_idx"
  ON "attendance_registers" ("tenant_id", "class_section_id", "date");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attendance_tenant_section_date_idx"
  ON "attendance" ("tenant_id", "class_section_id", "date");
