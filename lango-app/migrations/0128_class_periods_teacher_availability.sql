DO $$ BEGIN
  CREATE TYPE "academic_period_type" AS ENUM ('semester', 'trimester', 'month');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "period_type" "academic_period_type" NOT NULL DEFAULT 'semester';
UPDATE "classes" SET "period_type" = CASE WHEN "include_semesters" THEN 'semester'::"academic_period_type" ELSE 'trimester'::"academic_period_type" END;

CREATE TABLE IF NOT EXISTS "teacher_availability" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "teacher_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "day_of_week" "day_of_week" NOT NULL,
  "start_time" varchar(5) NOT NULL,
  "end_time" varchar(5) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "teacher_availability_teacher_day_times_unique" UNIQUE("teacher_id", "day_of_week", "start_time", "end_time"),
  CONSTRAINT "teacher_availability_valid_time_check" CHECK ("start_time" < "end_time")
);
CREATE INDEX IF NOT EXISTS "teacher_availability_tenant_teacher_idx" ON "teacher_availability" ("tenant_id", "teacher_id");
