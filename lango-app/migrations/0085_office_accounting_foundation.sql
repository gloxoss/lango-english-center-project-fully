-- Office Accounting foundation: evolves the existing double-entry ledger.
-- No ledger tables are replaced and no operational source data is rewritten.

CREATE TABLE IF NOT EXISTS accounting_journals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  code varchar(20) NOT NULL,
  name varchar(160) NOT NULL,
  journal_type varchar(30) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_journals_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT accounting_journals_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_journals_type_check CHECK (journal_type IN ('sales','cash','bank','purchase','general','opening','closing'))
);
CREATE INDEX IF NOT EXISTS accounting_journals_tenant_type_idx ON accounting_journals(tenant_id, journal_type);

CREATE TABLE IF NOT EXISTS accounting_voucher_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  journal_id uuid NOT NULL,
  code varchar(30) NOT NULL,
  name varchar(160) NOT NULL,
  source_module varchar(60),
  requires_approval boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_voucher_types_tenant_code_unique UNIQUE (tenant_id, code),
  CONSTRAINT accounting_voucher_types_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_voucher_types_journal_fk FOREIGN KEY (tenant_id, journal_id)
    REFERENCES accounting_journals(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_voucher_types_tenant_journal_idx ON accounting_voucher_types(tenant_id, journal_id);

CREATE TABLE IF NOT EXISTS accounting_numbering_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  journal_id uuid NOT NULL,
  fiscal_year integer NOT NULL,
  prefix varchar(30) NOT NULL,
  next_value integer NOT NULL DEFAULT 1,
  padding integer NOT NULL DEFAULT 6,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_numbering_tenant_journal_year_unique UNIQUE (tenant_id, journal_id, fiscal_year),
  CONSTRAINT accounting_numbering_journal_fk FOREIGN KEY (tenant_id, journal_id)
    REFERENCES accounting_journals(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_numbering_values_check CHECK (fiscal_year BETWEEN 1900 AND 9999 AND next_value > 0 AND padding BETWEEN 1 AND 12)
);

CREATE TABLE IF NOT EXISTS accounting_posting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  source_module varchar(60) NOT NULL,
  source_document_id text NOT NULL,
  source_version integer NOT NULL,
  idempotency_key varchar(160) NOT NULL,
  payload_digest varchar(64) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'processing',
  journal_entry_id uuid,
  error_code varchar(80),
  created_by_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp,
  CONSTRAINT accounting_posting_requests_tenant_key_unique UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT accounting_posting_requests_source_version_unique UNIQUE (tenant_id, source_module, source_document_id, source_version),
  CONSTRAINT accounting_posting_requests_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_posting_requests_status_check CHECK (status IN ('processing','succeeded','failed')),
  CONSTRAINT accounting_posting_requests_version_check CHECK (source_version > 0),
  CONSTRAINT accounting_posting_requests_digest_check CHECK (payload_digest ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS accounting_posting_requests_tenant_status_idx ON accounting_posting_requests(tenant_id, status);

DO $$ BEGIN
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_tenant_id_id_unique UNIQUE (tenant_id, id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE accounting_posting_requests ADD CONSTRAINT accounting_posting_requests_entry_fk
    FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS accounting_journal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  voucher_type_id uuid NOT NULL,
  posting_request_id uuid NOT NULL,
  reversal_of_entry_id uuid,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_journal_links_entry_unique UNIQUE (journal_entry_id),
  CONSTRAINT accounting_journal_links_request_unique UNIQUE (posting_request_id),
  CONSTRAINT accounting_journal_links_reversal_unique UNIQUE (reversal_of_entry_id),
  CONSTRAINT accounting_journal_links_entry_fk FOREIGN KEY (tenant_id, journal_entry_id)
    REFERENCES journal_entries(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_journal_links_journal_fk FOREIGN KEY (tenant_id, journal_id)
    REFERENCES accounting_journals(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_journal_links_voucher_type_fk FOREIGN KEY (tenant_id, voucher_type_id)
    REFERENCES accounting_voucher_types(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_journal_links_request_fk FOREIGN KEY (tenant_id, posting_request_id)
    REFERENCES accounting_posting_requests(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_journal_links_reversal_fk FOREIGN KEY (tenant_id, reversal_of_entry_id)
    REFERENCES journal_entries(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_journal_links_tenant_journal_idx ON accounting_journal_links(tenant_id, journal_id);

CREATE TABLE IF NOT EXISTS accounting_voucher_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL,
  event_type varchar(40) NOT NULL,
  actor_id text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_voucher_events_entry_fk FOREIGN KEY (tenant_id, journal_entry_id)
    REFERENCES journal_entries(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_voucher_events_type_check CHECK (event_type IN ('posted','reversed','migration_linked'))
);
CREATE INDEX IF NOT EXISTS accounting_voucher_events_tenant_entry_idx ON accounting_voucher_events(tenant_id, journal_entry_id, created_at);

CREATE OR REPLACE FUNCTION prevent_accounting_event_mutation()
RETURNS trigger AS $$ BEGIN
  RAISE EXCEPTION 'accounting voucher events are immutable' USING ERRCODE='55000';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_voucher_events_immutable_trigger ON accounting_voucher_events;
CREATE TRIGGER accounting_voucher_events_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_voucher_events
FOR EACH ROW EXECUTE FUNCTION prevent_accounting_event_mutation();

CREATE OR REPLACE FUNCTION prevent_succeeded_posting_request_mutation()
RETURNS trigger AS $$ BEGIN
  IF OLD.status='succeeded' THEN
    RAISE EXCEPTION 'succeeded accounting posting requests are immutable' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_posting_requests_immutable_trigger ON accounting_posting_requests;
CREATE TRIGGER accounting_posting_requests_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_posting_requests
FOR EACH ROW EXECUTE FUNCTION prevent_succeeded_posting_request_mutation();
