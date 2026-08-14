CREATE TABLE IF NOT EXISTS accounting_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  document_type varchar(30) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'draft',
  document_date date NOT NULL,
  reference varchar(160),
  counterparty varchar(255),
  description text NOT NULL,
  currency varchar(10) NOT NULL DEFAULT 'MAD',
  total_amount numeric(14,2) NOT NULL,
  source_version integer NOT NULL DEFAULT 1,
  created_by_id text NOT NULL,
  approved_by_id text,
  journal_entry_id uuid,
  submitted_at timestamp,
  approved_at timestamp,
  posted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_documents_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_documents_type_check CHECK (document_type IN ('deposit','expense','manual_journal')),
  CONSTRAINT accounting_documents_status_check CHECK (status IN ('draft','pending_approval','approved','rejected','posted','voided','reversed')),
  CONSTRAINT accounting_documents_amount_check CHECK (total_amount > 0),
  CONSTRAINT accounting_documents_currency_check CHECK (currency = 'MAD'),
  CONSTRAINT accounting_documents_version_check CHECK (source_version > 0),
  CONSTRAINT accounting_documents_entry_fk FOREIGN KEY (tenant_id, journal_entry_id) REFERENCES journal_entries(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_documents_tenant_type_status_idx ON accounting_documents(tenant_id, document_type, status);
CREATE INDEX IF NOT EXISTS accounting_documents_tenant_date_idx ON accounting_documents(tenant_id, document_date);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_documents_supplier_reference_unique
  ON accounting_documents(tenant_id, document_type, lower(coalesce(counterparty,'')), reference)
  WHERE reference IS NOT NULL AND status NOT IN ('rejected','voided');

CREATE TABLE IF NOT EXISTS accounting_document_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  account_id uuid NOT NULL,
  debit_amount numeric(14,2) NOT NULL DEFAULT 0,
  credit_amount numeric(14,2) NOT NULL DEFAULT 0,
  memo text,
  CONSTRAINT accounting_document_lines_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES accounting_documents(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT accounting_document_lines_one_side_check CHECK ((debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0))
);
CREATE INDEX IF NOT EXISTS accounting_document_lines_tenant_document_idx ON accounting_document_lines(tenant_id, document_id);

DO $$ BEGIN
  ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_tenant_id_unique UNIQUE (tenant_id, id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
ALTER TABLE accounting_document_lines DROP CONSTRAINT IF EXISTS accounting_document_lines_account_fk;
DO $$ BEGIN
  ALTER TABLE accounting_document_lines ADD CONSTRAINT accounting_document_lines_account_fk
    FOREIGN KEY (tenant_id, account_id) REFERENCES chart_of_accounts(tenant_id, id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS accounting_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL,
  event_type varchar(40) NOT NULL,
  actor_id text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_document_events_document_fk FOREIGN KEY (tenant_id, document_id) REFERENCES accounting_documents(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_document_events_type_check CHECK (event_type IN ('created','submitted','approved','rejected','posted','reversed','voided'))
);
CREATE INDEX IF NOT EXISTS accounting_document_events_tenant_document_idx ON accounting_document_events(tenant_id, document_id, created_at);

CREATE OR REPLACE FUNCTION prevent_accounting_document_event_mutation()
RETURNS trigger AS $$ BEGIN
  RAISE EXCEPTION 'accounting document events are immutable' USING ERRCODE='55000';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_document_events_immutable_trigger ON accounting_document_events;
CREATE TRIGGER accounting_document_events_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_document_events
FOR EACH ROW EXECUTE FUNCTION prevent_accounting_document_event_mutation();

CREATE OR REPLACE FUNCTION prevent_posted_accounting_document_mutation()
RETURNS trigger AS $$ BEGIN
  IF OLD.status = 'reversed' OR (OLD.status = 'posted' AND (TG_OP = 'DELETE' OR NEW.status <> 'reversed')) THEN
    RAISE EXCEPTION 'posted accounting documents are immutable' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_documents_posted_immutable_trigger ON accounting_documents;
CREATE TRIGGER accounting_documents_posted_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_documents
FOR EACH ROW EXECUTE FUNCTION prevent_posted_accounting_document_mutation();
