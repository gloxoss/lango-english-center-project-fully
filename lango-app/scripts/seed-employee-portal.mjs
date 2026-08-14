// Destructive local-only fixture reset for Employee Self-Service verification.
// This script deliberately refuses to run unless the operator opts in and the
// database URL points at localhost. It must never be used against shared data.
// Run: $env:ALLOW_DESTRUCTIVE_EMPLOYEE_FIXTURES='true'; node scripts/seed-employee-portal.mjs
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
});

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos';
const databaseHost = new URL(databaseUrl).hostname;
if (process.env.ALLOW_DESTRUCTIVE_EMPLOYEE_FIXTURES !== 'true') {
  throw new Error('Refusing destructive reset. Set ALLOW_DESTRUCTIVE_EMPLOYEE_FIXTURES=true for an isolated local database.');
}
if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
  throw new Error(`Refusing destructive reset against non-local database host: ${databaseHost}`);
}

const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const YEAR = 2026;

const seed = async () => {
  const tenants = [ATLAS, LANGO];

  // ---- Wipe previous seed runs for these tenants (child-first) ----
  for (const table of [
    'payslips',
    'payroll_run_lines',
    'payroll_periods',
    'workforce_punch_events',
    'leave_requests',
    'employee_leave_balances',
    'leave_categories',
    'employee_profiles',
  ]) {
    await pool.query(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, [tenants]);
  }

  const q = async (text, params) => (await pool.query(text, params)).rows;

  // ---- Employee profiles ----
  const profiles = [
    { tenantId: ATLAS, userId: 'USR-001', cnss: 'CNSS-8109-1', amo: 'AMO-8109-1', rib: 'MA6401100000000001234567', contract: 'CDI', dependants: 2 },
    { tenantId: ATLAS, userId: 'USR-002', cnss: 'CNSS-8109-2', amo: 'AMO-8109-2', rib: 'MA6401100000000007654321', contract: 'CDI', dependants: 1 },
    { tenantId: LANGO, userId: 'USR-LANGO-001', cnss: 'CNSS-9001-1', amo: 'AMO-9001-1', rib: 'MA6401100000000000001234', contract: 'CDD', dependants: 0 },
  ];
  for (const p of profiles) {
    await q(
      `INSERT INTO employee_profiles (tenant_id, user_id, cnss_number, amo_number, bank_rib, contract_type, dependants_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [p.tenantId, p.userId, p.cnss, p.amo, p.rib, p.contract, p.dependants],
    );
  }

  // ---- Leave categories (same three per tenant) ----
  const categories = [
    { name: 'Congé annuel', days: 30, paid: true },
    { name: 'Congé maladie', days: 15, paid: true },
    { name: 'Congé sans solde', days: 30, paid: false },
  ];
  const catByTenant = {};
  for (const tenantId of tenants) {
    catByTenant[tenantId] = {};
    for (const c of categories) {
      const [row] = await q(
        `INSERT INTO leave_categories (tenant_id, name, days_per_year, is_paid) VALUES ($1,$2,$3,$4) RETURNING id`,
        [tenantId, c.name, c.days, c.paid],
      );
      catByTenant[tenantId][c.name] = row.id;
    }
  }

  // ---- Leave balances (annual leave: accrued 30 / used 5) ----
  for (const p of profiles) {
    await q(
      `INSERT INTO employee_leave_balances (tenant_id, user_id, category_id, year, accrued_days, used_days)
       VALUES ($1,$2,$3,$4,30,5)`,
      [p.tenantId, p.userId, catByTenant[p.tenantId]['Congé annuel'], YEAR],
    );
  }

  // ---- Payroll ----
  const runLine = (gross, cnss, amo, ir, ce, ae) => ({
    gross, cnss, amo, ir,
    net: gross - cnss - amo - ir,
    cnssEmployer: ce, amoEmployer: ae,
    totalEmployerCost: gross + ce + ae,
  });

  const period = async (tenantId, year, month, status) => {
    const [row] = await q(
      `INSERT INTO payroll_periods (tenant_id, year, month, status, locked_at)
       VALUES ($1,$2,$3,$4, $5) RETURNING id`,
      [tenantId, year, month, status, status === 'locked' ? '2026-08-01T09:00:00.000Z' : null],
    );
    return row.id;
  };

  const addRunLine = async (tenantId, periodId, userId, line) => {
    const [row] = await q(
      `INSERT INTO payroll_run_lines (tenant_id, period_id, user_id, gross_salary, cnss_employee, amo_employee, ir_tax, net_salary, cnss_employer, amo_employer, total_employer_cost, calculation_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [tenantId, periodId, userId, line.gross, line.cnss, line.amo, line.ir, line.net, line.cnssEmployer, line.amoEmployer, line.totalEmployerCost, JSON.stringify({ source: 'seed' })],
    );
    return row.id;
  };

  const addPayslip = async (tenantId, periodId, runLineId, userId, issuedAt) => {
    await q(
      `INSERT INTO payslips (tenant_id, period_id, run_line_id, user_id, issued_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, periodId, runLineId, userId, issuedAt],
    );
  };

  // Atlas 2026-07 locked → payslips for USR-001 + USR-002
  const atlasJul = await period(ATLAS, 2026, 7, 'locked');
  const usr1JulLine = await addRunLine(ATLAS, atlasJul, 'USR-001', runLine(8000, 257.6, 160, 600, 1374.4, 240));
  await addPayslip(ATLAS, atlasJul, usr1JulLine, 'USR-001', '2026-08-01T08:30:00.000Z');
  const usr2JulLine = await addRunLine(ATLAS, atlasJul, 'USR-002', runLine(6000, 193.2, 120, 300, 1030.8, 180));
  await addPayslip(ATLAS, atlasJul, usr2JulLine, 'USR-002', '2026-08-01T08:31:00.000Z');

  // Atlas 2026-08 draft → run line for USR-001 but NO payslip (immutable gap)
  const atlasAug = await period(ATLAS, 2026, 8, 'draft');
  await addRunLine(ATLAS, atlasAug, 'USR-001', runLine(8000, 257.6, 160, 600, 1374.4, 240));

  // Lango 2026-07 locked → payslip for USR-LANGO-001
  const langoJul = await period(LANGO, 2026, 7, 'locked');
  const langoLine = await addRunLine(LANGO, langoJul, 'USR-LANGO-001', runLine(9000, 289.8, 180, 800, 1545.6, 270));
  await addPayslip(LANGO, langoJul, langoLine, 'USR-LANGO-001', '2026-08-01T08:40:00.000Z');

  // ---- Leave requests ----
  await q(
    `INSERT INTO leave_requests (tenant_id, user_id, category_id, start_date, end_date, days_requested, status, reason)
     VALUES ($1,$2,$3,'2026-09-01','2026-09-05',5,'pending','Vacances d''été')`,
    [ATLAS, 'USR-001', catByTenant[ATLAS]['Congé annuel']],
  );
  await q(
    `INSERT INTO leave_requests (tenant_id, user_id, category_id, start_date, end_date, days_requested, status, reviewed_by_id, reviewed_at, reason)
     VALUES ($1,$2,$3,'2026-08-10','2026-08-12',3,'approved','USR-001','2026-07-20T10:00:00.000Z','Congé personnel')`,
    [ATLAS, 'USR-002', catByTenant[ATLAS]['Congé annuel']],
  );

  // ---- Workforce punches (scanned_at is timestamp without tz) ----
  const punch = async (tenantId, employeeId, type, scannedAt, notes) => {
    await q(
      `INSERT INTO workforce_punch_events (tenant_id, employee_id, punch_type, scanned_at, notes)
       VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, employeeId, type, scannedAt, notes],
    );
  };
  const P = [
    // USR-001: two closed pairs + one open 'in' (currently clocked in)
    [ATLAS, 'USR-001', 'in', '2026-08-03 08:02:00', 'seed'],
    [ATLAS, 'USR-001', 'out', '2026-08-03 17:35:00', 'seed'],
    [ATLAS, 'USR-001', 'in', '2026-08-04 07:58:00', 'seed'],
    [ATLAS, 'USR-001', 'out', '2026-08-04 16:40:00', 'seed'],
    [ATLAS, 'USR-001', 'in', '2026-08-05 08:10:00', 'seed'],
    // USR-002: two closed pairs only (not clocked in)
    [ATLAS, 'USR-002', 'in', '2026-08-03 08:15:00', 'seed'],
    [ATLAS, 'USR-002', 'out', '2026-08-03 17:20:00', 'seed'],
    [ATLAS, 'USR-002', 'in', '2026-08-04 07:55:00', 'seed'],
    [ATLAS, 'USR-002', 'out', '2026-08-04 16:55:00', 'seed'],
    // USR-LANGO-001: one closed pair + one open 'in'
    [LANGO, 'USR-LANGO-001', 'in', '2026-08-03 09:00:00', 'seed'],
    [LANGO, 'USR-LANGO-001', 'out', '2026-08-03 18:10:00', 'seed'],
    [LANGO, 'USR-LANGO-001', 'in', '2026-08-05 08:45:00', 'seed'],
  ];
  for (const [t, u, type, at, notes] of P) {
    await punch(t, u, type, at, notes);
  }

  const counts = (await pool.query(
    `SELECT
       (SELECT count(*) FROM employee_profiles WHERE tenant_id = ANY($1)) profiles,
       (SELECT count(*) FROM leave_categories WHERE tenant_id = ANY($1)) categories,
       (SELECT count(*) FROM employee_leave_balances WHERE tenant_id = ANY($1)) balances,
       (SELECT count(*) FROM leave_requests WHERE tenant_id = ANY($1)) requests,
       (SELECT count(*) FROM payroll_periods WHERE tenant_id = ANY($1)) periods,
       (SELECT count(*) FROM payroll_run_lines WHERE tenant_id = ANY($1)) run_lines,
       (SELECT count(*) FROM payslips WHERE tenant_id = ANY($1)) payslips,
       (SELECT count(*) FROM workforce_punch_events WHERE tenant_id = ANY($1)) punches;`,
    [tenants],
  )).rows[0];
  console.log('SEED OK', counts);
};

seed()
  .catch((e) => {
    console.error('SEED FAILED', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
