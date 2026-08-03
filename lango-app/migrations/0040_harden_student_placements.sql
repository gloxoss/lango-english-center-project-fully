-- Add self-referencing FK on promoted_from_placement_id
DO $$ BEGIN
 ALTER TABLE "student_placements" ADD CONSTRAINT "student_placements_promoted_from_placement_id_fk" 
 FOREIGN KEY ("promoted_from_placement_id") REFERENCES "public"."student_placements"("id") ON DELETE set null;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Enforce partial unique index: at most ONE active current placement per student per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "student_placements_unique_current_idx" 
ON "student_placements" ("tenant_id", "student_id") 
WHERE is_current = true;

-- Enforce date range sanity check
DO $$ BEGIN
 ALTER TABLE "student_placements" ADD CONSTRAINT "student_placements_date_range_check" 
 CHECK (end_date IS NULL OR end_date > start_date);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- A current row is necessarily open-ended; historical rows must be closed.
DO $$ BEGIN
 ALTER TABLE "student_placements" ADD CONSTRAINT "student_placements_current_date_check"
 CHECK ((is_current = true AND end_date IS NULL) OR (is_current = false AND end_date IS NOT NULL));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Foreign keys on IDs alone cannot prove that all referenced records belong to
-- the placement tenant. Keep that invariant in PostgreSQL as well as the API.
CREATE OR REPLACE FUNCTION enforce_student_placement_tenant_scope()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id = NEW.student_id AND u.tenant_id = NEW.tenant_id AND u.role = 'student') THEN
    RAISE EXCEPTION 'student placement references a student outside its tenant' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_years sy WHERE sy.id = NEW.session_year_id AND sy.tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'student placement references a session year outside its tenant' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM class_sections cs WHERE cs.id = NEW.class_section_id AND cs.tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'student placement references a class section outside its tenant' USING ERRCODE = '23514';
  END IF;
  IF NEW.promoted_from_placement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM student_placements predecessor
    WHERE predecessor.id = NEW.promoted_from_placement_id
      AND predecessor.tenant_id = NEW.tenant_id
      AND predecessor.student_id = NEW.student_id
  ) THEN
    RAISE EXCEPTION 'placement predecessor is outside the student timeline' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_placements_tenant_scope_trigger ON student_placements;
CREATE TRIGGER student_placements_tenant_scope_trigger
BEFORE INSERT OR UPDATE ON student_placements
FOR EACH ROW EXECUTE FUNCTION enforce_student_placement_tenant_scope();

CREATE INDEX IF NOT EXISTS "student_placements_tenant_student_start_idx"
ON "student_placements" ("tenant_id", "student_id", "start_date" DESC);
CREATE INDEX IF NOT EXISTS "student_placements_tenant_session_idx"
ON "student_placements" ("tenant_id", "session_year_id");

-- Safe Backfill: Populate current student placements for active students who have a classSectionId
INSERT INTO "student_placements" (
  "id", "tenant_id", "student_id", "session_year_id", "class_section_id", "status", "start_date", "is_current", "created_at", "updated_at"
)
SELECT 
  gen_random_uuid(),
  u."tenant_id",
  u."id",
  sy."id",
  u."class_section_id",
  'enrolled'::enrollment_status,
  CURRENT_DATE,
  true,
  now(),
  now()
FROM "user" u
JOIN "session_years" sy ON sy."tenant_id" = u."tenant_id" AND sy."is_default" = true
JOIN "class_sections" cs ON cs."id" = u."class_section_id" AND cs."tenant_id" = u."tenant_id"
WHERE u."role" = 'student' 
  AND u."class_section_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "student_placements" sp 
    WHERE sp."tenant_id" = u."tenant_id" AND sp."student_id" = u."id" AND sp."is_current" = true
  );
