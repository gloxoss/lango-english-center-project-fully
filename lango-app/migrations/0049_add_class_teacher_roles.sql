DO $$ BEGIN
 CREATE TYPE "public"."class_teacher_role" AS ENUM('primary', 'assistant', 'support');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "role" "class_teacher_role" DEFAULT 'primary' NOT NULL;
ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "starts_on" date DEFAULT CURRENT_DATE NOT NULL;
ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "ends_on" date;
ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "status" "status" DEFAULT 'active' NOT NULL;
ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "assigned_by" text;
ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "notes" text;

ALTER TABLE "class_teachers" DROP CONSTRAINT IF EXISTS "class_teachers_assigned_by_user_id_fk";
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

-- Drop legacy simple unique constraint to allow historical records & multiple assistants
ALTER TABLE "class_teachers" DROP CONSTRAINT IF EXISTS "class_teachers_class_section_id_teacher_id_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "class_teachers_single_active_primary_idx" ON "class_teachers" ("tenant_id", "offering_id") WHERE "role" = 'primary' AND "ends_on" IS NULL;
