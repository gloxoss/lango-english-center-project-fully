-- Office Accounting WA3: finish period close/reopen.
--   * Close writes an immutable ledger snapshot (accounting_closing_runs +
--     accounting_closing_balances): per-account debit/credit/net within the period,
--     posted-entry count, and a balanced-totals CHECK — the reproducible as-of
--     evidence for the closed period.
--   * Reopen becomes a two-step maker-checker flow: a request with a mandatory
--     reason (accounting_period_reopen_requests) is decided by a DIFFERENT actor who
--     holds the exceptional accounting.period.reopen capability. Approval reopens
--     the period AND supersedes the active closing run (immutability trigger allows
--     only the supersede transition on a run).
--   * Every close/request/decision is appended to the immutable
--     accounting_period_events audit log.
-- All tables follow the tenant-composite FK convention (UNIQUE (tenant_id, id)).

-- Enable composite FK references to the core ledger tables (idempotent).
DO $$ BEGIN
  ALTER TABLE fiscal_periods ADD CONSTRAINT fiscal_periods_tenant_id_id_unique UNIQUE (tenant_id, id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_tenant_id_id_unique UNIQUE (tenant_id, id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

CREATE TABLE IF NOT EXISTS accounting_closing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  fiscal_period_id uuid NOT NULL,
  reason text NOT NULL,
  closed_by_id text NOT NULL,
  period_end_date date NOT NULL,
  posted_entry_count integer NOT NULL DEFAULT 0,
  debit_total numeric(14,2) NOT NULL DEFAULT 0,
  credit_total numeric(14,2) NOT NULL DEFAULT 0,
  net_balance numeric(14,2) NOT NULL DEFAULT 0,
  superseded boolean NOT NULL DEFAULT false,
  superseded_by_id text,
  superseded_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_closing_runs_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_closing_runs_period_fk FOREIGN KEY (tenant_id, fiscal_period_id)
    REFERENCES fiscal_periods(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_closing_runs_balanced CHECK (net_balance = 0 AND net_balance = debit_total - credit_total),
  CONSTRAINT accounting_closing_runs_counts_check CHECK (posted_entry_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_closing_runs_one_active_per_period
  ON accounting_closing_runs (tenant_id, fiscal_period_id) WHERE NOT superseded;
CREATE INDEX IF NOT EXISTS accounting_closing_runs_tenant_period_idx
  ON accounting_closing_runs (tenant_id, fiscal_period_id, created_at);

CREATE TABLE IF NOT EXISTS accounting_closing_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  closing_run_id uuid NOT NULL,
  account_id uuid NOT NULL,
  account_code varchar(50) NOT NULL,
  account_name varchar(255) NOT NULL,
  account_type account_type NOT NULL,
  debit_total numeric(14,2) NOT NULL DEFAULT 0,
  credit_total numeric(14,2) NOT NULL DEFAULT 0,
  net_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_closing_balances_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_closing_balances_run_fk FOREIGN KEY (tenant_id, closing_run_id)
    REFERENCES accounting_closing_runs(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_closing_balances_account_fk FOREIGN KEY (tenant_id, account_id)
    REFERENCES chart_of_accounts(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_closing_balances_run_account_unique UNIQUE (closing_run_id, account_id),
  CONSTRAINT accounting_closing_balances_net_consistent CHECK (net_balance = debit_total - credit_total)
);
CREATE INDEX IF NOT EXISTS accounting_closing_balances_run_idx ON accounting_closing_balances (tenant_id, closing_run_id);

CREATE TABLE IF NOT EXISTS accounting_period_reopen_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  fiscal_period_id uuid NOT NULL,
  requested_by_id text NOT NULL,
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  decided_by_id text,
  decided_at timestamp,
  decision_note text,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_period_reopen_requests_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_period_reopen_requests_period_fk FOREIGN KEY (tenant_id, fiscal_period_id)
    REFERENCES fiscal_periods(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_period_reopen_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_period_reopen_requests_one_pending
  ON accounting_period_reopen_requests (tenant_id, fiscal_period_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS accounting_period_reopen_requests_tenant_status_idx
  ON accounting_period_reopen_requests (tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS accounting_period_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  fiscal_period_id uuid NOT NULL,
  event_type varchar(40) NOT NULL,
  actor_id text NOT NULL,
  reason text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_period_events_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_period_events_period_fk FOREIGN KEY (tenant_id, fiscal_period_id)
    REFERENCES fiscal_periods(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_period_events_type_check CHECK (event_type IN ('closed', 'reopen_requested', 'reopen_approved', 'reopen_rejected'))
);
CREATE INDEX IF NOT EXISTS accounting_period_events_tenant_period_idx
  ON accounting_period_events (tenant_id, fiscal_period_id, created_at);

-- A closing run may only be created for a period that is already closed (the close
-- transaction sets status BEFORE inserting the run).
CREATE OR REPLACE FUNCTION enforce_closing_run_period_closed()
RETURNS trigger AS $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM fiscal_periods WHERE id = NEW.fiscal_period_id AND tenant_id = NEW.tenant_id AND status = 'closed') THEN
    RAISE EXCEPTION 'closing run requires a closed fiscal period' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_closing_runs_period_closed_trigger ON accounting_closing_runs;
CREATE TRIGGER accounting_closing_runs_period_closed_trigger
BEFORE INSERT ON accounting_closing_runs
FOR EACH ROW EXECUTE FUNCTION enforce_closing_run_period_closed();

-- Closing runs are immutable EXCEPT the single supersede transition written on reopen.
CREATE OR REPLACE FUNCTION guard_closing_run_mutation()
RETURNS trigger AS $$ BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'closing runs are immutable' USING ERRCODE='55000';
  END IF;
  IF NEW.superseded IS NOT TRUE THEN
    RAISE EXCEPTION 'closing runs are immutable; only a reopen may supersede one' USING ERRCODE='55000';
  END IF;
  IF NEW.id <> OLD.id OR NEW.tenant_id <> OLD.tenant_id OR NEW.fiscal_period_id <> OLD.fiscal_period_id
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.closed_by_id <> OLD.closed_by_id
     OR NEW.period_end_date <> OLD.period_end_date OR NEW.posted_entry_count <> OLD.posted_entry_count
     OR NEW.debit_total <> OLD.debit_total OR NEW.credit_total <> OLD.credit_total
     OR NEW.net_balance <> OLD.net_balance OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'closing run core fields are immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_closing_runs_immutable_trigger ON accounting_closing_runs;
CREATE TRIGGER accounting_closing_runs_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_closing_runs
FOR EACH ROW EXECUTE FUNCTION guard_closing_run_mutation();

-- Closing balances and period events are fully immutable (the audit trail).
CREATE OR REPLACE FUNCTION prevent_accounting_immutable_mutation()
RETURNS trigger AS $$ BEGIN
  RAISE EXCEPTION 'accounting audit records are immutable' USING ERRCODE='55000';
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_closing_balances_immutable_trigger ON accounting_closing_balances;
CREATE TRIGGER accounting_closing_balances_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_closing_balances
FOR EACH ROW EXECUTE FUNCTION prevent_accounting_immutable_mutation();
DROP TRIGGER IF EXISTS accounting_period_events_immutable_trigger ON accounting_period_events;
CREATE TRIGGER accounting_period_events_immutable_trigger
BEFORE UPDATE OR DELETE ON accounting_period_events
FOR EACH ROW EXECUTE FUNCTION prevent_accounting_immutable_mutation();

-- Reopen requests: no deletion, only a pending -> approved|rejected transition, and
-- terminal rows must carry the decision fields.
CREATE OR REPLACE FUNCTION guard_period_reopen_request_mutation()
RETURNS trigger AS $$ BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'reopen request history is immutable' USING ERRCODE='55000';
  END IF;
  IF OLD.status IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decided reopen requests are immutable' USING ERRCODE='55000';
  END IF;
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'reopen request may only move pending -> approved|rejected' USING ERRCODE='55000';
  END IF;
  IF NEW.tenant_id <> OLD.tenant_id OR NEW.fiscal_period_id <> OLD.fiscal_period_id
     OR NEW.requested_by_id <> OLD.requested_by_id OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'reopen request core fields are immutable' USING ERRCODE='55000';
  END IF;
  IF NEW.decided_by_id IS NULL OR NEW.decided_at IS NULL THEN
    RAISE EXCEPTION 'deciding a reopen request requires a decision actor and time' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS accounting_period_reopen_requests_mutation_guard ON accounting_period_reopen_requests;
CREATE TRIGGER accounting_period_reopen_requests_mutation_guard
BEFORE UPDATE OR DELETE ON accounting_period_reopen_requests
FOR EACH ROW EXECUTE FUNCTION guard_period_reopen_request_mutation();
