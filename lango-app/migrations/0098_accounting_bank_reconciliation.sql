-- 0098_accounting_bank_reconciliation.sql
-- WA4 — Finish bank/cash reconciliation. Adds, on top of migration 0090
-- (accounting_reconciliation_matches):
--   * accounting_statement_imports  : replay-safe CSV import batches. Each import
--     stores the SHA-256 fingerprint of the raw file; UNIQUE(tenant_id,
--     reconciliation_id, content_fingerprint) rejects re-imports of identical
--     content (idempotent network retries / accidental double uploads).
--   * accounting_statement_lines    : bounded, validated statement lines with a
--     draft lifecycle (unmatched -> partial -> matched). Each line is one-sided
--     (debit XOR credit) via a row CHECK, mirroring the journal line rule.
--   * accounting_statement_matches  : statement-line <-> journal-line matches.
--     Pair-unique per (statement_line, journal_line); BOTH sides are multi-match
--     capable (split = one statement line across several journal lines; merge =
--     several statement lines onto one journal line). matched_amount > 0.
--   * accounting_reconciliation_events: immutable audit trail for every
--     import/match/unmatch/split/merge/fee/interest/close decision.
--   * bank_reconciliations.reconciled_at: timestamp recorded on signed close.
-- Invariants enforced at the DB layer:
--   * Once a reconciliation is 'completed', its statement lines, matches and
--     import batches become immutable (no INSERT/UPDATE/DELETE) — the same
--     closed-immutability rule migration 0090 already applies to matches.
--   * accounting_reconciliation_events is immutable, period (no exception).
--   * All rows are tenant-composite keyed (UNIQUE(tenant_id, id)) and reference
--     bank_reconciliations via (tenant_id, id) composite FKs.

-- bank_reconciliations gains a signed-close timestamp (additive).
DO $$ BEGIN
  ALTER TABLE bank_reconciliations ADD COLUMN IF NOT EXISTS reconciled_at timestamp;
EXCEPTION WHEN duplicate_column THEN null; END $$;

CREATE TABLE IF NOT EXISTS accounting_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  reconciliation_id uuid NOT NULL,
  filename varchar(255) NOT NULL,
  content_fingerprint varchar(64) NOT NULL,
  rows_imported integer NOT NULL DEFAULT 0,
  imported_by_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_statement_imports_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_statement_imports_replay_unique UNIQUE (tenant_id, reconciliation_id, content_fingerprint),
  CONSTRAINT accounting_statement_imports_rows_check CHECK (rows_imported >= 0),
  CONSTRAINT accounting_statement_imports_reconciliation_fk FOREIGN KEY (tenant_id, reconciliation_id) REFERENCES bank_reconciliations(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_statement_imports_reconciliation_idx ON accounting_statement_imports(tenant_id, reconciliation_id);

CREATE TABLE IF NOT EXISTS accounting_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  reconciliation_id uuid NOT NULL,
  line_date date NOT NULL,
  description text NOT NULL,
  reference varchar(120),
  debit_amount numeric(14,2) NOT NULL DEFAULT 0,
  credit_amount numeric(14,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'unmatched',
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_statement_lines_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_statement_lines_one_side_positive CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR (credit_amount > 0 AND debit_amount = 0)
  ),
  CONSTRAINT accounting_statement_lines_status_check CHECK (status IN ('unmatched','partial','matched')),
  CONSTRAINT accounting_statement_lines_reconciliation_fk FOREIGN KEY (tenant_id, reconciliation_id) REFERENCES bank_reconciliations(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_statement_lines_reconciliation_idx ON accounting_statement_lines(tenant_id, reconciliation_id);

CREATE TABLE IF NOT EXISTS accounting_statement_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  reconciliation_id uuid NOT NULL,
  statement_line_id uuid NOT NULL,
  journal_line_id uuid NOT NULL,
  matched_amount numeric(14,2) NOT NULL,
  matched_by_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_statement_matches_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_statement_matches_pair_unique UNIQUE (tenant_id, statement_line_id, journal_line_id),
  CONSTRAINT accounting_statement_matches_amount_check CHECK (matched_amount > 0),
  CONSTRAINT accounting_statement_matches_statement_fk FOREIGN KEY (tenant_id, statement_line_id) REFERENCES accounting_statement_lines(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_statement_matches_journal_fk FOREIGN KEY (tenant_id, journal_line_id) REFERENCES journal_entry_lines(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_statement_matches_reconciliation_fk FOREIGN KEY (tenant_id, reconciliation_id) REFERENCES bank_reconciliations(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_statement_matches_statement_idx ON accounting_statement_matches(tenant_id, statement_line_id);
CREATE INDEX IF NOT EXISTS accounting_statement_matches_journal_idx ON accounting_statement_matches(tenant_id, journal_line_id);
CREATE INDEX IF NOT EXISTS accounting_statement_matches_reconciliation_idx ON accounting_statement_matches(tenant_id, reconciliation_id);

CREATE TABLE IF NOT EXISTS accounting_reconciliation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  reconciliation_id uuid NOT NULL,
  event_type varchar(40) NOT NULL,
  actor_id text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_reconciliation_events_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_reconciliation_events_type_check CHECK (event_type IN ('imported','matched','unmatched','split','merged','fee_posted','interest_posted','closed')),
  CONSTRAINT accounting_reconciliation_events_reconciliation_fk FOREIGN KEY (tenant_id, reconciliation_id) REFERENCES bank_reconciliations(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS accounting_reconciliation_events_reconciliation_idx ON accounting_reconciliation_events(tenant_id, reconciliation_id, created_at);

-- Once a reconciliation is completed, none of its statement artifacts may be
-- added, edited or removed. Covers INSERT too (COALESCE OLD/NEW for the tenant
-- and reconciliation ids, since OLD is empty on INSERT).
CREATE OR REPLACE FUNCTION prevent_completed_reconciliation_statement_mutation()
RETURNS trigger AS $$
DECLARE reconciliation_status text;
BEGIN
  SELECT status INTO reconciliation_status FROM bank_reconciliations
  WHERE tenant_id = COALESCE(OLD.tenant_id, NEW.tenant_id)
    AND id = COALESCE(OLD.reconciliation_id, NEW.reconciliation_id);
  IF reconciliation_status = 'completed' THEN
    RAISE EXCEPTION 'completed reconciliation artifacts are immutable' USING ERRCODE='55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accounting_statement_lines_closed_trigger ON accounting_statement_lines;
CREATE TRIGGER accounting_statement_lines_closed_trigger
BEFORE INSERT OR UPDATE OR DELETE ON accounting_statement_lines
FOR EACH ROW EXECUTE FUNCTION prevent_completed_reconciliation_statement_mutation();

DROP TRIGGER IF EXISTS accounting_statement_matches_closed_trigger ON accounting_statement_matches;
CREATE TRIGGER accounting_statement_matches_closed_trigger
BEFORE INSERT OR UPDATE OR DELETE ON accounting_statement_matches
FOR EACH ROW EXECUTE FUNCTION prevent_completed_reconciliation_statement_mutation();

DROP TRIGGER IF EXISTS accounting_statement_imports_closed_trigger ON accounting_statement_imports;
CREATE TRIGGER accounting_statement_imports_closed_trigger
BEFORE INSERT OR UPDATE OR DELETE ON accounting_statement_imports
FOR EACH ROW EXECUTE FUNCTION prevent_completed_reconciliation_statement_mutation();

CREATE OR REPLACE FUNCTION prevent_reconciliation_event_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reconciliation events are immutable' USING ERRCODE='55000';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_reconciliation_events_immutable_trigger ON accounting_reconciliation_events;
CREATE TRIGGER accounting_reconciliation_events_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_reconciliation_events
FOR EACH ROW EXECUTE FUNCTION prevent_reconciliation_event_mutation();
