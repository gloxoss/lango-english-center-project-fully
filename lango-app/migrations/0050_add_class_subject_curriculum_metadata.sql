ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "weekly_minutes" integer;
ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "display_order" integer DEFAULT 0 NOT NULL;
ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "coefficient" numeric(4, 2) DEFAULT '1.00' NOT NULL;
ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "pass_threshold" numeric(5, 2);
ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "curriculum_label" varchar(100);
