-- 0130_class_teacher_role_substitute.sql — §6.14 substitute-teacher workflow.
-- class_teachers.role gains 'substitute' so an admin can cover a class-section
-- with a stand-in teacher ("professeur remplaçant") alongside the titular.
-- Idempotent, hand-written.
DO $$ BEGIN
  ALTER TYPE "class_teacher_role" ADD VALUE IF NOT EXISTS 'substitute';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
