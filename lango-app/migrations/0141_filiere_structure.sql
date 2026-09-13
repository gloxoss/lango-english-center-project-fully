-- 0141_filiere_structure.sql — filières become a real structure.
--
-- `streams` was a tenant id and a name. A Moroccan filière also determines:
--   * which cycle it belongs to (a collège class cannot be "Sciences Maths"),
--   * the national Bac series code printed on the relevé de notes,
--   * the subject coefficients its students' moyenne générale is computed on.
--
-- The last of those is why class_subjects.coefficient alone was not enough: it is
-- per class, so it cannot say "Maths counts 7 in Sciences Maths and 3 in Lettres"
-- without duplicating the filière's rules into every class by hand.
--
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "code" varchar(20);
--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "cycle" "class_cycle";
--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "bac_series_code" varchar(20);
--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "display_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
-- Codes are optional, so uniqueness is partial: many filières may have no code,
-- but two filières in one school may not share one.
CREATE UNIQUE INDEX IF NOT EXISTS "streams_tenant_code_unique"
  ON "streams" ("tenant_id", "code") WHERE "code" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stream_subject_coefficients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "stream_id" uuid NOT NULL,
  "subject_id" uuid NOT NULL,
  "coefficient" numeric(4, 2) NOT NULL,
  "is_core" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "stream_subject_coefficients_unique" UNIQUE ("tenant_id", "stream_id", "subject_id")
);
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" DROP CONSTRAINT IF EXISTS "stream_subject_coefficients_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" ADD CONSTRAINT "stream_subject_coefficients_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" DROP CONSTRAINT IF EXISTS "stream_subject_coefficients_stream_id_streams_id_fk";
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" ADD CONSTRAINT "stream_subject_coefficients_stream_id_streams_id_fk"
  FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" DROP CONSTRAINT IF EXISTS "stream_subject_coefficients_subject_id_subjects_id_fk";
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" ADD CONSTRAINT "stream_subject_coefficients_subject_id_subjects_id_fk"
  FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- A coefficient of 0 would silently drop a subject from the average, which is
-- what marking it inactive is for; a negative one is meaningless.
ALTER TABLE "stream_subject_coefficients" DROP CONSTRAINT IF EXISTS "stream_subject_coefficients_coefficient_positive";
--> statement-breakpoint
ALTER TABLE "stream_subject_coefficients" ADD CONSTRAINT "stream_subject_coefficients_coefficient_positive"
  CHECK ("coefficient" > 0);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stream_subject_coefficients_stream_idx"
  ON "stream_subject_coefficients" ("tenant_id", "stream_id");
