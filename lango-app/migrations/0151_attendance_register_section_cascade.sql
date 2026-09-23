-- 0151_attendance_register_section_cascade.sql — REGISTER OWNERSHIP.
--
-- 0147 keyed attendance registers per (tenant, section, date, period) and made
-- the legacy class-level unique index partial (WHERE class_section_id IS NULL).
-- Deleting a class section then hit a real conflict: ON DELETE SET NULL pushed
-- every register of that class to NULL, and two section registers for the same
-- (class, date, period) collided on the partial legacy unique index.
--
-- A register is an operational artifact OF its section: the marks it carries
-- are the academic history, and any mark blocks section deletion before we get
-- here. The register itself therefore belongs to the section and goes with it.
-- Marks keep ON DELETE SET NULL (they must survive; deletion is blocked anyway).
--
-- Hand-written, forward-only, idempotent.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attendance_registers_class_section_id_fk') THEN
    ALTER TABLE "attendance_registers" DROP CONSTRAINT "attendance_registers_class_section_id_fk";
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "attendance_registers"
  ADD CONSTRAINT "attendance_registers_class_section_id_fk"
  FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE cascade ON UPDATE no action;
