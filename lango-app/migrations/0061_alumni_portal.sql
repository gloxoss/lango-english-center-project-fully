-- future-implementation/alumni-portal/.ultraplan/sections/section-01-schema-and-role-foundation.md
-- Combined migration: alumni role + records/verification + events + directory + mentoring + requests.

-- 1. Real new role value
ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'alumni' AFTER 'student';

-- 2. Graduation transition fields on user
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS graduation_cohort_session_year_id uuid;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS alumni_transitioned_at timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS alumni_transitioned_by text;

DO $$ BEGIN
  ALTER TABLE "user" ADD CONSTRAINT user_graduation_cohort_session_year_id_fk FOREIGN KEY (graduation_cohort_session_year_id) REFERENCES session_years(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "user" ADD CONSTRAINT user_alumni_transitioned_by_user_id_fk FOREIGN KEY (alumni_transitioned_by) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3-4. Alumni documents (with real issuance history for verification-code revocation)
DO $$ BEGIN
  CREATE TYPE alumni_document_status AS ENUM ('active', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS alumni_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  alumnus_id text NOT NULL,
  document_type varchar(50) NOT NULL,
  file_ext varchar(10) NOT NULL,
  verification_code varchar(32) NOT NULL,
  status alumni_document_status DEFAULT 'active' NOT NULL,
  issued_at timestamp DEFAULT now() NOT NULL,
  superseded_at timestamp,
  issued_by text,
  CONSTRAINT alumni_documents_verification_code_unique UNIQUE (verification_code)
);

DO $$ BEGIN
  ALTER TABLE alumni_documents ADD CONSTRAINT alumni_documents_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_documents ADD CONSTRAINT alumni_documents_alumnus_id_user_id_fk FOREIGN KEY (alumnus_id) REFERENCES "user"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_documents ADD CONSTRAINT alumni_documents_issued_by_user_id_fk FOREIGN KEY (issued_by) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS alumni_documents_alumnus_type_status_idx ON alumni_documents (alumnus_id, document_type, status);

-- 5-7. Alumni events + RSVPs
DO $$ BEGIN
  CREATE TYPE alumni_event_rsvp_status AS ENUM ('going', 'not_going', 'maybe');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS alumni_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  title varchar(255) NOT NULL,
  description text,
  location varchar(255),
  starts_at timestamp NOT NULL,
  ends_at timestamp,
  created_by text,
  created_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE alumni_events ADD CONSTRAINT alumni_events_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_events ADD CONSTRAINT alumni_events_created_by_user_id_fk FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS alumni_event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  event_id uuid NOT NULL,
  alumnus_id text NOT NULL,
  status alumni_event_rsvp_status NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT alumni_event_rsvps_event_alumnus_unique UNIQUE (event_id, alumnus_id)
);

DO $$ BEGIN
  ALTER TABLE alumni_event_rsvps ADD CONSTRAINT alumni_event_rsvps_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_event_rsvps ADD CONSTRAINT alumni_event_rsvps_event_id_alumni_events_id_fk FOREIGN KEY (event_id) REFERENCES alumni_events(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_event_rsvps ADD CONSTRAINT alumni_event_rsvps_alumnus_id_user_id_fk FOREIGN KEY (alumnus_id) REFERENCES "user"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Directory consent (per-field opt-in)
CREATE TABLE IF NOT EXISTS alumni_directory_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  alumnus_id text NOT NULL,
  show_name boolean DEFAULT false NOT NULL,
  show_cohort boolean DEFAULT false NOT NULL,
  show_current_employer boolean DEFAULT false NOT NULL,
  show_contact_info boolean DEFAULT false NOT NULL,
  current_employer varchar(255),
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT alumni_directory_consent_alumnus_unique UNIQUE (alumnus_id)
);

DO $$ BEGIN
  ALTER TABLE alumni_directory_consent ADD CONSTRAINT alumni_directory_consent_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_directory_consent ADD CONSTRAINT alumni_directory_consent_alumnus_id_user_id_fk FOREIGN KEY (alumnus_id) REFERENCES "user"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Mentor listings (opt-in only, no matching engine)
CREATE TABLE IF NOT EXISTS alumni_mentor_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  alumnus_id text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  offering text NOT NULL,
  contact_preference varchar(50),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT alumni_mentor_listings_alumnus_unique UNIQUE (alumnus_id)
);

DO $$ BEGIN
  ALTER TABLE alumni_mentor_listings ADD CONSTRAINT alumni_mentor_listings_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_mentor_listings ADD CONSTRAINT alumni_mentor_listings_alumnus_id_user_id_fk FOREIGN KEY (alumnus_id) REFERENCES "user"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Correction/reissue/data-access/deletion request queue
DO $$ BEGIN
  CREATE TYPE alumni_request_type AS ENUM ('correction', 'reissue', 'data_access', 'deletion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE alumni_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS alumni_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  alumnus_id text NOT NULL,
  type alumni_request_type NOT NULL,
  status alumni_request_status DEFAULT 'pending' NOT NULL,
  note text NOT NULL,
  related_document_id uuid,
  decided_by text,
  decided_at timestamp,
  decision_note text,
  created_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE alumni_requests ADD CONSTRAINT alumni_requests_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_requests ADD CONSTRAINT alumni_requests_alumnus_id_user_id_fk FOREIGN KEY (alumnus_id) REFERENCES "user"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_requests ADD CONSTRAINT alumni_requests_related_document_id_fk FOREIGN KEY (related_document_id) REFERENCES alumni_documents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alumni_requests ADD CONSTRAINT alumni_requests_decided_by_user_id_fk FOREIGN KEY (decided_by) REFERENCES "user"(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS alumni_requests_tenant_status_idx ON alumni_requests (tenant_id, status);
