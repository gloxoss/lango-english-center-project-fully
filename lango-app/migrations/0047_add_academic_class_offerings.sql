CREATE TABLE IF NOT EXISTS "academic_class_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_year_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"capacity" integer,
	"status" "status" DEFAULT 'active' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_class_offerings_unique" UNIQUE("tenant_id","session_year_id","class_id","section_id")
);

ALTER TABLE "academic_class_offerings" DROP CONSTRAINT IF EXISTS "academic_class_offerings_tenant_id_tenants_id_fk";
ALTER TABLE "academic_class_offerings" ADD CONSTRAINT "academic_class_offerings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "academic_class_offerings" DROP CONSTRAINT IF EXISTS "academic_class_offerings_session_year_id_session_years_id_fk";
ALTER TABLE "academic_class_offerings" ADD CONSTRAINT "academic_class_offerings_session_year_id_session_years_id_fk" FOREIGN KEY ("session_year_id") REFERENCES "public"."session_years"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "academic_class_offerings" DROP CONSTRAINT IF EXISTS "academic_class_offerings_class_id_classes_id_fk";
ALTER TABLE "academic_class_offerings" ADD CONSTRAINT "academic_class_offerings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "academic_class_offerings" DROP CONSTRAINT IF EXISTS "academic_class_offerings_section_id_sections_id_fk";
ALTER TABLE "academic_class_offerings" ADD CONSTRAINT "academic_class_offerings_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;

-- Backfill: insert 1 offering per existing class_sections row in tenant's default session year
INSERT INTO "academic_class_offerings" ("id", "tenant_id", "session_year_id", "class_id", "section_id", "capacity", "status", "display_order", "created_at", "updated_at")
SELECT 
	gen_random_uuid(),
	cs.tenant_id,
	sy.id AS session_year_id,
	cs.class_id,
	cs.section_id,
	NULL AS capacity,
	'active'::"status",
	0,
	now(),
	now()
FROM "class_sections" cs
INNER JOIN "session_years" sy ON sy.tenant_id = cs.tenant_id AND sy.is_default = true
ON CONFLICT ("tenant_id", "session_year_id", "class_id", "section_id") DO NOTHING;
