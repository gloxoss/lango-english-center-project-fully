CREATE TABLE IF NOT EXISTS "student_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"session_year_id" uuid NOT NULL,
	"class_section_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'enrolled' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT true NOT NULL,
	"promoted_from_placement_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_placements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "student_placements_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "user"("id") ON DELETE cascade,
	CONSTRAINT "student_placements_session_year_id_session_years_id_fk" FOREIGN KEY ("session_year_id") REFERENCES "session_years"("id") ON DELETE cascade,
	CONSTRAINT "student_placements_class_section_id_class_sections_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "student_placements_tenant_student_idx" ON "student_placements" ("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "student_placements_student_session_idx" ON "student_placements" ("student_id", "session_year_id");
