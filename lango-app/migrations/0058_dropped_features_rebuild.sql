-- future-implementation/dropped-features-rebuild/.ultraplan/sections/section-01-schema-foundation.md
-- Combined migration for all 6 rebuilt feature areas: households, classes, schedule, question bank, admission, transfers.

-- Households: guardian_students ranking/pickup, guardians comm-prefs
ALTER TABLE guardian_students ADD COLUMN IF NOT EXISTS emergency_priority integer;
ALTER TABLE guardian_students ADD COLUMN IF NOT EXISTS can_pickup boolean DEFAULT false NOT NULL;

ALTER TABLE guardians ADD COLUMN IF NOT EXISTS email_opt_in boolean DEFAULT true NOT NULL;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS sms_opt_in boolean DEFAULT true NOT NULL;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS preferred_language varchar(10);

CREATE INDEX IF NOT EXISTS guardian_students_student_id_idx ON guardian_students (student_id);
CREATE INDEX IF NOT EXISTS guardian_students_guardian_id_idx ON guardian_students (guardian_id);

-- Classes: cycle enum + field, class_sections capacity/home room
DO $$ BEGIN
  CREATE TYPE class_cycle AS ENUM ('maternelle', 'primaire', 'college', 'lycee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE classes ADD COLUMN IF NOT EXISTS cycle class_cycle;

ALTER TABLE class_sections ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE class_sections ADD COLUMN IF NOT EXISTS home_room_id uuid;

DO $$ BEGIN
  ALTER TABLE class_sections ADD CONSTRAINT class_sections_home_room_id_rooms_id_fk FOREIGN KEY (home_room_id) REFERENCES rooms(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Question bank: tagging fields on online_exam_questions + new decoupled bank tables
DO $$ BEGIN
  CREATE TYPE question_difficulty AS ENUM ('facile', 'moyen', 'difficile');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE online_exam_questions ADD COLUMN IF NOT EXISTS section_label varchar(255);
ALTER TABLE online_exam_questions ADD COLUMN IF NOT EXISTS difficulty question_difficulty;
ALTER TABLE online_exam_questions ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE online_exam_questions ADD COLUMN IF NOT EXISTS cycle class_cycle;

DO $$ BEGIN
  ALTER TABLE online_exam_questions ADD CONSTRAINT online_exam_questions_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS question_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  subject_id uuid,
  cycle class_cycle,
  difficulty question_difficulty,
  section_label varchar(255),
  question_text text NOT NULL,
  marks numeric(5, 2) DEFAULT 1 NOT NULL,
  created_by_id text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE question_bank_items ADD CONSTRAINT question_bank_items_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE question_bank_items ADD CONSTRAINT question_bank_items_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE question_bank_items ADD CONSTRAINT question_bank_items_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS question_bank_items_tenant_subject_idx ON question_bank_items (tenant_id, subject_id);

CREATE TABLE IF NOT EXISTS question_bank_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  question_bank_item_id uuid NOT NULL,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false NOT NULL
);

DO $$ BEGIN
  ALTER TABLE question_bank_item_options ADD CONSTRAINT question_bank_item_options_question_bank_item_id_fk FOREIGN KEY (question_bank_item_id) REFERENCES question_bank_items(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS question_bank_item_options_item_id_idx ON question_bank_item_options (question_bank_item_id);

-- Admission: interviews, comments, fixed checklist on applicants
DO $$ BEGIN
  CREATE TYPE admission_interview_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS admission_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  scheduled_at timestamp NOT NULL,
  interviewer_id text,
  location varchar(255),
  status admission_interview_status DEFAULT 'scheduled' NOT NULL,
  notes text,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE admission_interviews ADD CONSTRAINT admission_interviews_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admission_interviews ADD CONSTRAINT admission_interviews_applicant_id_applicants_id_fk FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admission_interviews ADD CONSTRAINT admission_interviews_interviewer_id_user_id_fk FOREIGN KEY (interviewer_id) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admission_interviews ADD CONSTRAINT admission_interviews_applicant_id_unique UNIQUE (applicant_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS admission_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  author_id text,
  body text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE admission_comments ADD CONSTRAINT admission_comments_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admission_comments ADD CONSTRAINT admission_comments_applicant_id_applicants_id_fk FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE admission_comments ADD CONSTRAINT admission_comments_author_id_user_id_fk FOREIGN KEY (author_id) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS admission_comments_applicant_id_idx ON admission_comments (applicant_id);

ALTER TABLE applicants ADD COLUMN IF NOT EXISTS checklist_documents_received boolean DEFAULT false NOT NULL;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS checklist_interview_done boolean DEFAULT false NOT NULL;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS checklist_file_complete boolean DEFAULT false NOT NULL;
