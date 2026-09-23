-- 0142_homework_attachments_and_syllabus.sql
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
ALTER TABLE "homework_details" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "class_subject_syllabi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"class_subject_id" uuid NOT NULL,
	"chapters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "class_subject_syllabi_tenant_subj_uq" ON "class_subject_syllabi" ("tenant_id", "class_subject_id");
