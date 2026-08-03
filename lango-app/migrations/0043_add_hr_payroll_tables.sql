-- Migration 0041: Add HR Employee Profiles, Salary Templates, Payroll Periods/Runs/Payslips, Leave Management
-- Phase 6: Workforce Operations, HR & Payroll

-- ─────────────────────────────────────────────────────────
-- 1. Employee HR Profiles
-- ─────────────────────────────────────────────────────────
CREATE TABLE employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  cnss_number VARCHAR(20),
  amo_number VARCHAR(20),
  bank_rib VARCHAR(34),
  contract_type VARCHAR(20) NOT NULL DEFAULT 'cdi', -- cdi | cdd | vacation
  dependants_count SMALLINT NOT NULL DEFAULT 0 CHECK (dependants_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- ─────────────────────────────────────────────────────────
-- 2. Salary Components
-- ─────────────────────────────────────────────────────────
CREATE TABLE salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earning', 'deduction')),
  rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN ('fixed', 'percent', 'formula')),
  fixed_value NUMERIC(12, 4),
  formula_key VARCHAR(50), -- cnss_employee | amo_employee | ir | cnss_employer | amo_employer
  is_statutory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- 3. Salary Templates
-- ─────────────────────────────────────────────────────────
CREATE TABLE salary_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE salary_template_components (
  template_id UUID NOT NULL REFERENCES salary_templates(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES salary_components(id) ON DELETE CASCADE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, component_id)
);

-- ─────────────────────────────────────────────────────────
-- 4. Employee Salary Assignments (effective-dated)
-- ─────────────────────────────────────────────────────────
CREATE TABLE employee_salary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES salary_templates(id),
  base_salary NUMERIC(12, 2) NOT NULL CHECK (base_salary >= 0),
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX employee_salary_assignments_user_idx ON employee_salary_assignments (tenant_id, user_id, effective_date DESC);

-- ─────────────────────────────────────────────────────────
-- 5. Payroll Periods
-- ─────────────────────────────────────────────────────────
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'locked')),
  locked_at TIMESTAMPTZ,
  locked_by_id TEXT REFERENCES "user"(id),
  journal_entry_id UUID, -- set after GL posting on lock
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year, month)
);

-- ─────────────────────────────────────────────────────────
-- 6. Payroll Run Lines (one per employee per period)
-- ─────────────────────────────────────────────────────────
CREATE TABLE payroll_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id),
  gross_salary NUMERIC(12, 2) NOT NULL,
  cnss_employee NUMERIC(12, 2) NOT NULL,
  amo_employee NUMERIC(12, 2) NOT NULL,
  ir_tax NUMERIC(12, 2) NOT NULL,
  net_salary NUMERIC(12, 2) NOT NULL,
  cnss_employer NUMERIC(12, 2) NOT NULL,
  amo_employer NUMERIC(12, 2) NOT NULL,
  total_employer_cost NUMERIC(12, 2) NOT NULL,
  calculation_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, user_id)
);

-- ─────────────────────────────────────────────────────────
-- 7. Payslips (immutable on lock)
-- ─────────────────────────────────────────────────────────
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  run_line_id UUID NOT NULL UNIQUE REFERENCES payroll_run_lines(id),
  user_id TEXT NOT NULL REFERENCES "user"(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_storage_key TEXT
);

CREATE INDEX payslips_user_period_idx ON payslips (tenant_id, user_id, period_id);

-- ─────────────────────────────────────────────────────────
-- 8. Leave Categories
-- ─────────────────────────────────────────────────────────
CREATE TABLE leave_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  days_per_year SMALLINT,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────
-- 9. Employee Leave Balances
-- ─────────────────────────────────────────────────────────
CREATE TABLE employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES leave_categories(id),
  year SMALLINT NOT NULL,
  accrued_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, user_id, category_id, year)
);

-- ─────────────────────────────────────────────────────────
-- 10. Leave Requests
-- ─────────────────────────────────────────────────────────
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES leave_categories(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(5, 2) NOT NULL CHECK (days_requested > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_id TEXT REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX leave_requests_user_idx ON leave_requests (tenant_id, user_id, status);
