# Section 01: Database Migration 0041 + Moroccan Payroll Engine

## Risk: 🔴 RED — Core financial migration; must be correct before any feature builds.

## Overview
Write migration `0041_add_hr_payroll_tables.sql`, register all new tables in `Schema.ts`, and implement the Moroccan statutory payroll gross-to-net calculation service in `src/libs/services/payroll-engine.ts`.

## Dependencies
- Depends on: none (foundational)
- Blocks: Sections 02, 03, 04, 05

## Success Criteria
- Migration runs cleanly on fresh DB without error.
- `calculatePayslipLine(employee)` unit test proves: given gross 10,000 DH → CNSS = 448 DH, AMO = 226 DH, IR calculated on net taxable, net correct.
- `npx tsc --noEmit` → 0 errors.

## TDD Stubs
```typescript
it('calculates CNSS at 4.48% capped at 6000 DH gross', ...)
it('calculates AMO at 2.26% with no cap', ...)
it('applies IR progressive brackets correctly', ...)
it('net = gross - cnss_employee - amo_employee - ir', ...)
```

## Tasks

### [01-01] Write Migration 0041
**File**: `migrations/0041_add_hr_payroll_tables.sql`
**Action**:
```sql
-- HR employee profiles
CREATE TABLE employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  cnss_number VARCHAR(20),
  amo_number VARCHAR(20),
  bank_rib VARCHAR(30),
  contract_type VARCHAR(20) NOT NULL DEFAULT 'cdi', -- cdi|cdd|vacation
  dependants_count SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- Salary components
CREATE TABLE salary_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- earning|deduction
  rate_type VARCHAR(20) NOT NULL, -- fixed|percent|formula
  value NUMERIC(12,4),
  formula_key VARCHAR(50), -- cnss_employee|amo_employee|ir|cnss_employer|amo_employer
  is_statutory BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salary templates
CREATE TABLE salary_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE salary_template_components (
  template_id UUID NOT NULL REFERENCES salary_templates(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES salary_components(id),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, component_id)
);

-- Employee salary assignment
CREATE TABLE employee_salary_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  template_id UUID NOT NULL REFERENCES salary_templates(id),
  base_salary NUMERIC(12,2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payroll periods
CREATE TABLE payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft|locked
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, year, month)
);

-- Payroll run lines (one per employee per period)
CREATE TABLE payroll_run_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  gross_salary NUMERIC(12,2) NOT NULL,
  cnss_employee NUMERIC(12,2) NOT NULL,
  amo_employee NUMERIC(12,2) NOT NULL,
  ir_tax NUMERIC(12,2) NOT NULL,
  net_salary NUMERIC(12,2) NOT NULL,
  cnss_employer NUMERIC(12,2) NOT NULL,
  amo_employer NUMERIC(12,2) NOT NULL,
  total_employer_cost NUMERIC(12,2) NOT NULL,
  calculation_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (period_id, user_id)
);

-- Payslips (immutable on lock)
CREATE TABLE payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  period_id UUID NOT NULL REFERENCES payroll_periods(id),
  run_line_id UUID NOT NULL UNIQUE REFERENCES payroll_run_lines(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_storage_key TEXT
);

-- Leave categories
CREATE TABLE leave_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(100) NOT NULL, -- Congé Annuel Payé, Congé Maladie, etc.
  days_per_year SMALLINT,
  is_paid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee leave balances
CREATE TABLE employee_leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  category_id UUID NOT NULL REFERENCES leave_categories(id),
  year SMALLINT NOT NULL,
  accrued_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  used_days NUMERIC(5,2) NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, user_id, category_id, year)
);

-- Leave requests
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES "user"(id),
  category_id UUID NOT NULL REFERENCES leave_categories(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_requested NUMERIC(5,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|approved|rejected
  reviewed_by UUID REFERENCES "user"(id),
  reviewed_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
```
**Verify**: Migration runs without error on PostgreSQL 17.

### [01-02] Register Tables in Schema.ts
**File**: `src/models/Schema.ts`
**Action**: Add Drizzle table definitions for all 10 new tables matching migration.
**Verify**: `npx tsc --noEmit` → 0 errors.

### [01-03] Build Moroccan Payroll Calculation Engine
**File**: `src/libs/services/payroll-engine.ts`
**Action**: Export `calculatePayslipLine({ grossSalary, dependantsCount })` implementing:
- CNSS employee: `min(grossSalary * 0.0448, 6000 * 0.0448)`
- AMO employee: `grossSalary * 0.0226`
- IR: progressive brackets after 40% pro abatement (min 2160, max 30000 annual)
- Net = gross - cnss_emp - amo_emp - ir
- CNSS employer: `min(grossSalary * 0.0898, 6000 * 0.0898)`
- AMO employer: `grossSalary * 0.0326`

**Verify**: Unit test `src/libs/services/__tests__/payroll-engine.test.ts` — 5 test cases covering edge cases (CNSS cap, zero dependants, multiple IR brackets). All pass.
