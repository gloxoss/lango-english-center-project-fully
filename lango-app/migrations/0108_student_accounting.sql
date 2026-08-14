-- 0108_student_accounting.sql
-- Student Accounting add-on (future-implementation/student-accounting, plan #12).
-- New tables on top of the existing fee/invoice/payment foundation:
--   * fine_policies / fine_assessments      : configurable late-payment fines
--   * invoice_events                        : immutable per-invoice event ledger
--   * payment_reversals / student_credits   : corrections + overpayment credits
--   * cashier_closings                      : session close snapshot (expected/actual/variance)
--   * finance_reminder_rules / finance_reminder_runs : recurring reminder policy + runs
--   * payment_method_configurations         : configurable payment methods (replaces enum)
--   * fee_structure_versions                : versioned/published fee structures
--   * fee_allocation_runs / fee_allocation_targets : preview/run allocation jobs
-- All money columns are fixed-precision numeric; every table is tenant-scoped
-- with ON DELETE CASCADE on the tenant FK.

CREATE TABLE IF NOT EXISTS fine_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  description text,
  scope_class_id uuid REFERENCES classes(id),
  scope_section_id uuid REFERENCES class_sections(id),
  grace_days integer NOT NULL DEFAULT 0,
  formula varchar(20) NOT NULL DEFAULT 'flat',
  flat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  per_day_amount numeric(14, 2) NOT NULL DEFAULT 0,
  max_amount numeric(14, 2),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fine_policies_tenant_status_idx ON fine_policies(tenant_id, status);

CREATE TABLE IF NOT EXISTS fine_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  fine_policy_id uuid NOT NULL REFERENCES fine_policies(id),
  invoice_id uuid REFERENCES invoices(id),
  amount numeric(14, 2) NOT NULL,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'assessed',
  waived_amount numeric(14, 2) NOT NULL DEFAULT 0,
  waive_reason text,
  waive_by_id text,
  assessed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fine_assessments_tenant_student_idx ON fine_assessments(tenant_id, student_id);

CREATE TABLE IF NOT EXISTS invoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  payload jsonb,
  actor_user_id text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_events_tenant_invoice_idx ON invoice_events(tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS payment_reversals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'draft',
  reversed_by_id text,
  approved_by_id text,
  reversed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_reversals_tenant_payment_idx ON payment_reversals(tenant_id, payment_id);

CREATE TABLE IF NOT EXISTS student_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL,
  balance numeric(14, 2) NOT NULL,
  source varchar(30) NOT NULL DEFAULT 'manual',
  note text,
  created_by_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS student_credits_tenant_student_idx ON student_credits(tenant_id, student_id);

CREATE TABLE IF NOT EXISTS cashier_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cashier_session_id uuid NOT NULL REFERENCES cashier_sessions(id) ON DELETE CASCADE,
  cashier_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expected_cash numeric(14, 2) NOT NULL,
  actual_cash numeric(14, 2) NOT NULL,
  variance numeric(14, 2) NOT NULL,
  notes text,
  closed_by_id text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cashier_closings_tenant_session_idx ON cashier_closings(tenant_id, cashier_session_id);

CREATE TABLE IF NOT EXISTS finance_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(255) NOT NULL,
  timing varchar(10) NOT NULL DEFAULT 'after',
  days_relative integer NOT NULL DEFAULT 0,
  cadence_days integer NOT NULL DEFAULT 0,
  min_balance numeric(14, 2) NOT NULL DEFAULT 0,
  max_per_student integer NOT NULL DEFAULT 3,
  quiet_start varchar(5),
  quiet_end varchar(5),
  locale varchar(10) NOT NULL DEFAULT 'fr',
  escalation_level integer NOT NULL DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS finance_reminder_rules_tenant_status_idx ON finance_reminder_rules(tenant_id, status);

CREATE TABLE IF NOT EXISTS finance_reminder_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES finance_reminder_rules(id),
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  status varchar(20) NOT NULL DEFAULT 'running',
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  results jsonb,
  started_by_id text,
  started_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS finance_reminder_runs_tenant_rule_idx ON finance_reminder_runs(tenant_id, rule_id);

CREATE TABLE IF NOT EXISTS payment_method_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  method_code varchar(50) NOT NULL,
  label_fr varchar(255) NOT NULL,
  label_ar varchar(255),
  requires_reference boolean NOT NULL DEFAULT false,
  requires_bank boolean NOT NULL DEFAULT false,
  requires_date boolean NOT NULL DEFAULT false,
  requires_proof boolean NOT NULL DEFAULT false,
  refundable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  branch_scope_id uuid,
  accounting_account_id uuid,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_method_configurations_tenant_code_idx ON payment_method_configurations(tenant_id, method_code);

CREATE TABLE IF NOT EXISTS fee_structure_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fee_structure_id uuid NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  published_by_id text,
  published_at timestamp,
  components_snapshot jsonb,
  effective_from date,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_structure_versions_tenant_structure_idx ON fee_structure_versions(tenant_id, fee_structure_id);

CREATE TABLE IF NOT EXISTS fee_allocation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period varchar(20) NOT NULL,
  fee_structure_version_id uuid REFERENCES fee_structure_versions(id),
  fee_schedule_id uuid REFERENCES fee_schedules(id),
  status varchar(20) NOT NULL DEFAULT 'draft',
  preview_summary jsonb,
  run_by_id text,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS fee_allocation_runs_tenant_status_idx ON fee_allocation_runs(tenant_id, status);

CREATE TABLE IF NOT EXISTS fee_allocation_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES fee_allocation_runs(id) ON DELETE CASCADE,
  student_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  reason text,
  invoice_id uuid REFERENCES invoices(id),
  error text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fee_allocation_targets_tenant_run_idx ON fee_allocation_targets(tenant_id, run_id);
