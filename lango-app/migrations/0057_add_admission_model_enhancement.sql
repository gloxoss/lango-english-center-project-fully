-- future-implementation/admission-and-student-model/ADMISSION-AND-STUDENT-MODEL-ENHANCEMENT.md
-- Combined migration for sections 01, 02, 04, 05 of that plan.

-- Section 01: applicant_documents
CREATE TABLE IF NOT EXISTS applicant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  applicant_id uuid NOT NULL,
  document_type student_document_type NOT NULL,
  file_ext varchar(10) NOT NULL,
  uploaded_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE applicant_documents ADD CONSTRAINT
    applicant_documents_applicant_id_document_type_unique
    UNIQUE (applicant_id, document_type);
EXCEPTION
  WHEN duplicate_object OR duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE applicant_documents ADD CONSTRAINT applicant_documents_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE applicant_documents ADD CONSTRAINT applicant_documents_applicant_id_applicants_id_fk FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS applicant_documents_tenant_applicant_idx ON applicant_documents (tenant_id, applicant_id);

-- Section 02: new fields on applicants and user
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS gender gender;
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS nationality varchar(100);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS mother_tongue varchar(50);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS blood_group varchar(10);
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS academic_year_id uuid;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS nationality varchar(100);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS mother_tongue varchar(50);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS city varchar(100);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS blood_group varchar(10);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS academic_year_id uuid;

DO $$ BEGIN
  ALTER TABLE applicants ADD CONSTRAINT applicants_academic_year_id_academic_years_id_fk FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user" ADD CONSTRAINT user_academic_year_id_academic_years_id_fk FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Section 04: applicants.guardian_id
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS guardian_id uuid;

DO $$ BEGIN
  ALTER TABLE applicants ADD CONSTRAINT applicants_guardian_id_guardians_id_fk FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS applicants_guardian_id_idx ON applicants (guardian_id);

-- Section 05: login access setting + account setup tokens
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS login_access_method varchar(20) DEFAULT 'invite_link' NOT NULL;

CREATE TABLE IF NOT EXISTS account_setup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  user_id text NOT NULL,
  token varchar(64) NOT NULL,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE account_setup_tokens ADD CONSTRAINT account_setup_tokens_token_unique UNIQUE (token);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE account_setup_tokens ADD CONSTRAINT account_setup_tokens_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE account_setup_tokens ADD CONSTRAINT account_setup_tokens_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS account_setup_tokens_user_id_idx ON account_setup_tokens (user_id);
