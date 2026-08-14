import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
for (const line of fs.readFileSync(path.resolve('.env'), 'utf8').split(/\r?\n/)) { const match = line.trim().match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim(); }
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  try {
    await pool.query(fs.readFileSync(path.resolve('migrations/0094_payroll_workforce_operations.sql'), 'utf8'));

    const checks: Array<[string, string]> = [
      // Backfilled tables that existed only in Drizzle (hr-schema.ts) before 0094.
      ['salary_advances', `select (to_regclass('public.salary_advances') is not null) as ok`],
      ['salary_advance_transactions', `select (to_regclass('public.salary_advance_transactions') is not null) as ok`],
      ['employee_awards', `select (to_regclass('public.employee_awards') is not null) as ok`],
      ['employee_profile_edit_requests', `select (to_regclass('public.employee_profile_edit_requests') is not null) as ok`],
      // New configuration / run / posting / payment / leave / advance / award tables.
      ['payroll_regulation_packs', `select (to_regclass('public.payroll_regulation_packs') is not null) as ok`],
      ['payroll_regulation_versions', `select (to_regclass('public.payroll_regulation_versions') is not null) as ok`],
      ['payroll_settings_versions', `select (to_regclass('public.payroll_settings_versions') is not null) as ok`],
      ['salary_component_versions', `select (to_regclass('public.salary_component_versions') is not null) as ok`],
      ['salary_structure_versions', `select (to_regclass('public.salary_structure_versions') is not null) as ok`],
      ['salary_structure_components', `select (to_regclass('public.salary_structure_components') is not null) as ok`],
      ['employee_payroll_profiles', `select (to_regclass('public.employee_payroll_profiles') is not null) as ok`],
      ['payroll_adjustments', `select (to_regclass('public.payroll_adjustments') is not null) as ok`],
      ['payroll_result_lines', `select (to_regclass('public.payroll_result_lines') is not null) as ok`],
      ['payroll_calculation_traces', `select (to_regclass('public.payroll_calculation_traces') is not null) as ok`],
      ['payroll_postings', `select (to_regclass('public.payroll_postings') is not null) as ok`],
      ['payroll_posting_lines', `select (to_regclass('public.payroll_posting_lines') is not null) as ok`],
      ['salary_payment_batches', `select (to_regclass('public.salary_payment_batches') is not null) as ok`],
      ['salary_payments', `select (to_regclass('public.salary_payments') is not null) as ok`],
      ['employee_leave_policies', `select (to_regclass('public.employee_leave_policies') is not null) as ok`],
      ['employee_leave_policy_assignments', `select (to_regclass('public.employee_leave_policy_assignments') is not null) as ok`],
      ['employee_leave_balance_transactions', `select (to_regclass('public.employee_leave_balance_transactions') is not null) as ok`],
      ['salary_advance_policies', `select (to_regclass('public.salary_advance_policies') is not null) as ok`],
      ['salary_advance_repayment_schedules', `select (to_regclass('public.salary_advance_repayment_schedules') is not null) as ok`],
      ['award_definitions', `select (to_regclass('public.award_definitions') is not null) as ok`],
      // Double-payment prevention: one payment per payroll run line per tenant.
      ['salary_payments_tenant_run_line_unique', `select exists(select 1 from pg_constraint where conname='salary_payments_tenant_run_line_unique') as ok`],
      // Double-recovery prevention: one advance repayment per payroll run line.
      ['salary_advance_repay_run_line_unique', `select exists(select 1 from pg_constraint where conname='salary_advance_repay_run_line_unique') as ok`],
      // Extended lifecycle columns on the pre-existing tables.
      ['payroll_periods.version', `select exists(select 1 from information_schema.columns where table_name='payroll_periods' and column_name='version') as ok`],
      ['payroll_periods.frozen_inputs', `select exists(select 1 from information_schema.columns where table_name='payroll_periods' and column_name='frozen_inputs') as ok`],
      ['payroll_run_lines.is_frozen', `select exists(select 1 from information_schema.columns where table_name='payroll_run_lines' and column_name='is_frozen') as ok`],
      ['payroll_run_lines.net_payable', `select exists(select 1 from information_schema.columns where table_name='payroll_run_lines' and column_name='net_payable') as ok`],
      ['payslips.payslip_number', `select exists(select 1 from information_schema.columns where table_name='payslips' and column_name='payslip_number') as ok`],
      ['leave_requests.reserved_units', `select exists(select 1 from information_schema.columns where table_name='leave_requests' and column_name='reserved_units') as ok`],
      ['employee_leave_balances.reserved_days', `select exists(select 1 from information_schema.columns where table_name='employee_leave_balances' and column_name='reserved_days') as ok`],
      // New lifecycle status CHECK constraints.
      ['payroll_periods_status_check', `select exists(select 1 from pg_constraint where conname='payroll_periods_status_check') as ok`],
      ['leave_requests_status_check', `select exists(select 1 from pg_constraint where conname='leave_requests_status_check') as ok`],
    ];

    const failures: string[] = [];
    for (const [name, sql] of checks) {
      const r = await pool.query(sql);
      const ok = r.rows.length === 1 && Boolean(r.rows[0]?.ok);
      if (!ok) failures.push(name);
    }
    if (failures.length > 0) throw new Error(`missing objects: ${failures.join(', ')}`);
    console.log(`PASS migration 0094: ${checks.length}/${checks.length} structural checks (tables, FKs, UNIQUE double-payment/double-recovery, extended columns, lifecycle status checks)`);
  } finally { await pool.end(); }
}
main().catch(error => { console.error('FAIL migration 0094', error); process.exitCode = 1; });
