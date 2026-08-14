DO $$ BEGIN
  ALTER TABLE bank_reconciliations ADD CONSTRAINT bank_reconciliations_tenant_id_unique UNIQUE (tenant_id, id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE journal_entry_lines ADD CONSTRAINT journal_entry_lines_tenant_id_unique UNIQUE (tenant_id, id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

CREATE TABLE IF NOT EXISTS accounting_reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  reconciliation_id uuid NOT NULL,
  journal_line_id uuid NOT NULL,
  matched_amount numeric(14,2) NOT NULL,
  matched_by_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_reconciliation_matches_line_unique UNIQUE (tenant_id, journal_line_id),
  CONSTRAINT accounting_reconciliation_matches_amount_check CHECK (matched_amount <> 0),
  CONSTRAINT accounting_reconciliation_matches_reconciliation_fk FOREIGN KEY (tenant_id, reconciliation_id) REFERENCES bank_reconciliations(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_reconciliation_matches_line_fk FOREIGN KEY (tenant_id, journal_line_id) REFERENCES journal_entry_lines(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_reconciliation_matches_reconciliation_idx ON accounting_reconciliation_matches(tenant_id, reconciliation_id);

CREATE OR REPLACE FUNCTION prevent_completed_reconciliation_match_mutation()
RETURNS trigger AS $$
DECLARE reconciliation_status text;
BEGIN
  SELECT status INTO reconciliation_status FROM bank_reconciliations
  WHERE tenant_id=OLD.tenant_id AND id=OLD.reconciliation_id;
  IF reconciliation_status='completed' THEN
    RAISE EXCEPTION 'completed reconciliation matches are immutable' USING ERRCODE='55000';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_reconciliation_matches_closed_trigger ON accounting_reconciliation_matches;
CREATE TRIGGER accounting_reconciliation_matches_closed_trigger
BEFORE UPDATE OR DELETE ON accounting_reconciliation_matches
FOR EACH ROW EXECUTE FUNCTION prevent_completed_reconciliation_match_mutation();
