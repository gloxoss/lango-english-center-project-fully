ALTER TABLE "class_subjects" ADD COLUMN IF NOT EXISTS "offering_id" uuid;
ALTER TABLE "class_teachers" ADD COLUMN IF NOT EXISTS "offering_id" uuid;
ALTER TABLE "subject_teachers" ADD COLUMN IF NOT EXISTS "offering_id" uuid;
ALTER TABLE "class_schedule_slots" ADD COLUMN IF NOT EXISTS "offering_id" uuid;

ALTER TABLE "class_subjects" DROP CONSTRAINT IF EXISTS "class_subjects_offering_id_academic_class_offerings_id_fk";
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_offering_id_academic_class_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."academic_class_offerings"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "class_teachers" DROP CONSTRAINT IF EXISTS "class_teachers_offering_id_academic_class_offerings_id_fk";
ALTER TABLE "class_teachers" ADD CONSTRAINT "class_teachers_offering_id_academic_class_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."academic_class_offerings"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "subject_teachers" DROP CONSTRAINT IF EXISTS "subject_teachers_offering_id_academic_class_offerings_id_fk";
ALTER TABLE "subject_teachers" ADD CONSTRAINT "subject_teachers_offering_id_academic_class_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."academic_class_offerings"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "class_schedule_slots" DROP CONSTRAINT IF EXISTS "class_schedule_slots_offering_id_academic_class_offerings_id_fk";
ALTER TABLE "class_schedule_slots" ADD CONSTRAINT "class_schedule_slots_offering_id_academic_class_offerings_id_fk" FOREIGN KEY ("offering_id") REFERENCES "public"."academic_class_offerings"("id") ON DELETE set null ON UPDATE no action;

-- Backfill offering_id for class_teachers, subject_teachers, and class_schedule_slots from class_section_id
UPDATE "class_teachers" ct
SET "offering_id" = aco."id"
FROM "class_sections" csec
INNER JOIN "academic_class_offerings" aco ON aco."tenant_id" = csec."tenant_id" AND aco."class_id" = csec."class_id" AND aco."section_id" = csec."section_id"
WHERE ct."class_section_id" = csec."id" AND ct."offering_id" IS NULL;

UPDATE "subject_teachers" st
SET "offering_id" = aco."id"
FROM "class_sections" csec
INNER JOIN "academic_class_offerings" aco ON aco."tenant_id" = csec."tenant_id" AND aco."class_id" = csec."class_id" AND aco."section_id" = csec."section_id"
WHERE st."class_section_id" = csec."id" AND st."offering_id" IS NULL;

UPDATE "class_schedule_slots" css
SET "offering_id" = aco."id"
FROM "class_sections" csec
INNER JOIN "academic_class_offerings" aco ON aco."tenant_id" = csec."tenant_id" AND aco."class_id" = csec."class_id" AND aco."section_id" = csec."section_id"
WHERE css."class_section_id" = csec."id" AND css."offering_id" IS NULL;

UPDATE "class_subjects" cs
SET "offering_id" = aco."id"
FROM "academic_class_offerings" aco
WHERE cs."tenant_id" = aco."tenant_id" AND cs."class_id" = aco."class_id" AND cs."offering_id" IS NULL;
