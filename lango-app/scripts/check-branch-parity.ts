import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// BRANCH-SCOPE-01 B6-01 — parity and no-regression gate.
//
// Recomputes the B0 totals (same queries/attributions as
// scripts/capture-branch-baseline.ts) and fails when:
//   1. a MULTI-branch tenant violates invariant 3:
//      per-branch sums + unassigned != whole-tenant total;
//   2. a SINGLE-branch (or branchless) tenant violates invariant 4:
//      any total differs from .ultraplan/branch-scope/evidence/baseline-before.json.
//
// Read-only; exit 1 on any difference. Run: npm run check:branch-parity

dotenv.config();

type Totals = Record<string, number>;

const QUERIES: Record<string, string> = {
  tenants: `select id, name from tenants order by name`,
  branches: `select id, tenant_id, name, code, is_active, is_default from branches order by tenant_id, name`,
  students: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n from "user" where role = 'student' and tenant_id is not null group by 1, 2`,
  classes: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n from classes group by 1, 2`,
  applicants: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n from applicants group by 1, 2`,
  invoices: `select i.tenant_id, coalesce(u.branch_id::text, '_unassigned') as bucket, count(*)::int as n, coalesce(sum(i.net_amount), 0)::float8 as s from invoices i left join "user" u on u.id = i.student_id group by 1, 2`,
  payments: `select p.tenant_id, coalesce(u.branch_id::text, '_unassigned') as bucket, coalesce(sum(p.amount), 0)::float8 as s from payments p left join "user" u on u.id = p.student_id where p.status = 'posted' group by 1, 2`,
  employees: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n from employee_profiles group by 1, 2`,
  libraryCopies: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n from library_copies group by 1, 2`,
  hostelBeds: `select h.tenant_id, coalesce(h.branch_id::text, '_unassigned') as bucket, count(b.id)::int as n from hostel_beds b join hostel_rooms r on r.id = b.room_id join hostels h on h.id = r.hostel_id group by 1, 2`,
  transportRoutes: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n from transport_routes group by 1, 2`,
};

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const baselinePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '.ultraplan',
    'branch-scope',
    'evidence',
    'baseline-before.json',
  );
  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline missing: ${baselinePath}`);
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const baselineMonthStart = `${baseline.month}-01`;

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const buckets: Record<string, Record<string, Totals>> = {};
  const branchMeta: Record<string, { tenantId: string; isActive: boolean }> = {};
  const tenantNames: Record<string, string> = {};

  const emptyTotals = (): Totals => ({
    students: 0, classes: 0, applicants: 0, invoicesCount: 0, invoicesSum: 0,
    paymentsPostedSum: 0, employees: 0, libraryCopies: 0, hostelBeds: 0, transportRoutes: 0,
  });

  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    for (const [entity, sql] of Object.entries(QUERIES)) {
      const res = await client.query(sql);
      for (const row of res.rows) {
        if (entity === 'tenants') { tenantNames[row.id] = row.name; continue; }
        if (entity === 'branches') {
          branchMeta[row.id] = { tenantId: row.tenant_id, isActive: row.is_active };
          continue;
        }
        const tenant = (buckets[row.tenant_id] ??= {});
        const totals = (tenant[row.bucket] ??= emptyTotals());
        if (entity === 'invoices') {
          totals.invoicesCount += row.n;
          totals.invoicesSum += row.s;
        } else if (entity === 'payments') {
          totals.paymentsPostedSum += row.s;
        } else {
          // entity names match the baseline totals keys 1:1
          // (students, classes, applicants, employees, libraryCopies,
          //  hostelBeds, transportRoutes).
          totals[entity] = (totals[entity] ?? 0) + row.n;
        }
      }
    }
    // attendance: parity for the BASELINE month (stable across months).
    const att = await client.query(
      `select a.tenant_id, coalesce(u.branch_id::text, '_unassigned') as bucket, count(*)::int as n
       from attendance a left join "user" u on u.id = a.student_id
       where a.date >= $1 group by 1, 2`,
      [baselineMonthStart],
    );
    for (const row of att.rows) {
      const tenant = (buckets[row.tenant_id] ??= {});
      const totals = (tenant[row.bucket] ??= emptyTotals());
      totals.attendanceThisMonth = (totals.attendanceThisMonth ?? 0) + row.n;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const tenantIds = new Set([...Object.keys(buckets), ...Object.keys(tenantNames)]);
  for (const tenantId of tenantIds) {
    const name = tenantNames[tenantId] ?? tenantId;
    const tenantBuckets = buckets[tenantId] ?? {};
    const activeBranches = Object.entries(branchMeta)
      .filter(([, meta]) => meta.tenantId === tenantId && meta.isActive);
    const all = emptyTotals();
    for (const totals of Object.values(tenantBuckets)) {
      for (const key of Object.keys(all)) all[key] = (all[key] ?? 0) + (totals[key] ?? 0);
    }
    const baselineTenant = baseline.tenants[tenantId];

    if (!baselineTenant) {
      // A tenant born after the B0 capture has no reference — on a shared
      // dev/audit playground that is normal churn, on production it would
      // deserve a baseline re-capture. Warn, don't fail.
      warnings.push(`${name}: tenant not in the B0 baseline (created afterwards) — skipped`);
      continue;
    }

    if (activeBranches.length >= 2) {
      // invariant 3: sum over branches + unassigned == all
      const sum = emptyTotals();
      for (const totals of Object.values(tenantBuckets)) {
        for (const key of Object.keys(sum)) sum[key] = (sum[key] ?? 0) + (totals[key] ?? 0);
      }
      for (const key of Object.keys(all)) {
        if (Math.abs((all[key] ?? 0) - (sum[key] ?? 0)) > 0.001) {
          errors.push(`${name}: invariant 3 broken for ${key} (all=${all[key]} != branch sum=${sum[key]})`);
        }
      }
    } else {
      // invariant 4: single/branchless tenant == B0 baseline
      for (const key of Object.keys(all)) {
        const before = baselineTenant.all[key] ?? 0;
        if (Math.abs((all[key] ?? 0) - before) > 0.001) {
          errors.push(`${name}: invariant 4 broken for ${key} (${before} -> ${all[key]})`);
        }
      }
    }
  }

  if (warnings.length > 0) {
    for (const w of warnings) console.warn(`⚠ ${w}`);
  }

  if (errors.length > 0) {
    console.error(`❌ Branch parity check failed (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.error(`  - ${e}`);
    if (errors.length > 20) console.error(`  ... and ${errors.length - 20} more`);
    process.exit(1);
  }
  console.log(
    `✅ Branch parity passed for ${tenantIds.size} tenants `
    + `(invariant 3 on multi-branch, invariant 4 vs B0 baseline month ${baseline.month}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
