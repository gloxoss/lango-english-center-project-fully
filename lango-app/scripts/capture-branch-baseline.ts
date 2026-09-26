import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Pool } from 'pg';

// Read-only capture of branch-scopable totals, taken BEFORE any branch-scope
// change lands (plan BRANCH-SCOPE-01, task B0-02). The JSON it writes is the
// proof for invariant 4 (single-branch tenants must keep identical numbers)
// and the reference for the B6 parity check (per branch + unassigned = "all").
//
// Branch attribution per entity (the mapping the dashboard already uses):
//   - direct column: classes, applicants, employee_profiles, library_copies,
//     transport_routes, user (students)
//   - via the owning student: invoices, payments, attendance (no branch column)
//   - via the hostel building: hostel_beds (beds -> rooms -> hostels.branch_id)
//
// The script only ever SELECTs and runs inside a READ ONLY transaction.

dotenv.config();

type Totals = {
  students: number;
  classes: number;
  applicants: number;
  invoicesCount: number;
  invoicesSum: number;
  paymentsPostedSum: number;
  attendanceThisMonth: number;
  employees: number;
  libraryCopies: number;
  hostelBeds: number;
  transportRoutes: number;
};

const QUERIES: Record<string, string> = {
  tenants: `select id, name from tenants order by name`,
  branches: `select id, tenant_id, name, code, is_active, is_default from branches order by tenant_id, name`,
  students: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n
             from "user" where role = 'student' and tenant_id is not null group by 1, 2`,
  classes: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n
            from classes group by 1, 2`,
  applicants: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n
               from applicants group by 1, 2`,
  invoices: `select i.tenant_id, coalesce(u.branch_id::text, '_unassigned') as bucket,
                    count(*)::int as n, coalesce(sum(i.net_amount), 0)::float8 as s
             from invoices i left join "user" u on u.id = i.student_id group by 1, 2`,
  payments: `select p.tenant_id, coalesce(u.branch_id::text, '_unassigned') as bucket,
                    coalesce(sum(p.amount), 0)::float8 as s
             from payments p left join "user" u on u.id = p.student_id
             where p.status = 'posted' group by 1, 2`,
  attendance: `select a.tenant_id, coalesce(u.branch_id::text, '_unassigned') as bucket, count(*)::int as n
               from attendance a left join "user" u on u.id = a.student_id
               where a.date >= $1 group by 1, 2`,
  employees: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n
              from employee_profiles group by 1, 2`,
  libraryCopies: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n
                  from library_copies group by 1, 2`,
  hostelBeds: `select h.tenant_id, coalesce(h.branch_id::text, '_unassigned') as bucket, count(b.id)::int as n
               from hostel_beds b
               join hostel_rooms r on r.id = b.room_id
               join hostels h on h.id = r.hostel_id
               group by 1, 2`,
  transportRoutes: `select tenant_id, coalesce(branch_id::text, '_unassigned') as bucket, count(*)::int as n
                    from transport_routes group by 1, 2`,
};

const DEFINITIONS: Record<keyof Totals, string> = {
  students: 'user rows with role=student; direct user.branch_id',
  classes: 'classes rows; direct branch_id',
  applicants: 'applicants rows; direct branch_id',
  invoicesCount: 'invoices rows; via the owning student (user.branch_id); count + sum(net_amount)',
  invoicesSum: 'sum of invoices.net_amount via the owning student',
  paymentsPostedSum: 'sum of payments.amount where status=posted, via the owning student',
  attendanceThisMonth: 'attendance rows with date >= first day of the capture month (computed in Node), via the owning student',
  employees: 'employee_profiles rows; direct branch_id',
  libraryCopies: 'library_copies rows; direct branch_id',
  hostelBeds: 'hostel_beds joined through hostel_rooms -> hostels.branch_id',
  transportRoutes: 'transport_routes rows; direct branch_id',
};

const EMPTY_TOTALS = (): Totals => ({
  students: 0,
  classes: 0,
  applicants: 0,
  invoicesCount: 0,
  invoicesSum: 0,
  paymentsPostedSum: 0,
  attendanceThisMonth: 0,
  employees: 0,
  libraryCopies: 0,
  hostelBeds: 0,
  transportRoutes: 0,
});

function addTo(totals: Totals, entity: string, row: Record<string, unknown>): void {
  switch (entity) {
    case 'students': totals.students += row.n as number; break;
    case 'classes': totals.classes += row.n as number; break;
    case 'applicants': totals.applicants += row.n as number; break;
    case 'invoices': totals.invoicesCount += row.n as number; totals.invoicesSum += row.s as number; break;
    case 'payments': totals.paymentsPostedSum += row.s as number; break;
    case 'attendance': totals.attendanceThisMonth += row.n as number; break;
    case 'employees': totals.employees += row.n as number; break;
    case 'libraryCopies': totals.libraryCopies += row.n as number; break;
    case 'hostelBeds': totals.hostelBeds += row.n as number; break;
    case 'transportRoutes': totals.transportRoutes += row.n as number; break;
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }
  const dbUrl = new URL(databaseUrl);
  // Month bound computed in Node: the container tzdata disagrees with ICU on
  // Africa/Casablanca, so an SQL date_trunc could land the boundary an hour
  // off (hub note 2026-09-24). attendance.date is a plain date anyway.
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthStart = `${month}-01`;

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const buckets: Record<string, Record<string, Totals>> = {};
  const tenantNames: Record<string, string> = {};
  const branchMeta: Record<string, { tenantId: string; name: string; code: string; isActive: boolean; isDefault: boolean }> = {};

  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    for (const [entity, sql] of Object.entries(QUERIES)) {
      const res = await client.query(sql, entity === 'attendance' ? [monthStart] : []);
      for (const row of res.rows) {
        if (entity === 'tenants') {
          tenantNames[row.id] = row.name;
          continue;
        }
        if (entity === 'branches') {
          branchMeta[row.id] = {
            tenantId: row.tenant_id,
            name: row.name,
            code: row.code,
            isActive: row.is_active,
            isDefault: row.is_default,
          };
          continue;
        }
        const tenant = (buckets[row.tenant_id] ??= {});
        const totals = (tenant[row.bucket] ??= EMPTY_TOTALS());
        addTo(totals, entity, row);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  const tenantsOut: Record<string, unknown> = {};
  const tenantIds = new Set<string>([...Object.keys(buckets), ...Object.keys(tenantNames)]);
  for (const tenantId of tenantIds) {
    const tenantBuckets = buckets[tenantId] ?? {};
    const branchesOut: Record<string, unknown> = {};
    for (const [branchId, meta] of Object.entries(branchMeta)) {
      if (meta.tenantId !== tenantId) continue;
      branchesOut[branchId] = {
        name: meta.name,
        code: meta.code,
        isActive: meta.isActive,
        isDefault: meta.isDefault,
        totals: tenantBuckets[branchId] ?? EMPTY_TOTALS(),
      };
    }
    // "all" is the whole-tenant total = every bucket summed (the left joins
    // keep branchless rows in _unassigned, so the sum is complete by design).
    const all = EMPTY_TOTALS();
    for (const totals of Object.values(tenantBuckets)) {
      for (const key of Object.keys(all) as Array<keyof Totals>) {
        all[key] += totals[key];
      }
    }
    tenantsOut[tenantId] = {
      name: tenantNames[tenantId] ?? tenantId,
      branchCount: Object.values(branchMeta).filter(b => b.tenantId === tenantId).length,
      all,
      branches: branchesOut,
      unassigned: tenantBuckets._unassigned ?? EMPTY_TOTALS(),
    };
  }

  const out = {
    capturedAt: now.toISOString(),
    database: `${dbUrl.username}@${dbUrl.hostname}:${dbUrl.port}${dbUrl.pathname}`,
    month,
    purpose: 'BRANCH-SCOPE-01 B0-02 before-baseline; invariant 4 proof and B6 parity reference. Read-only capture.',
    definitions: DEFINITIONS,
    queries: QUERIES,
    tenants: tenantsOut,
  };

  const defaultPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '.ultraplan',
    'branch-scope',
    'evidence',
    'baseline-before.json',
  );
  const outPath = process.env.BASELINE_OUT ?? defaultPath;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

  for (const [tenantId, t] of Object.entries(tenantsOut)) {
    const tt = t as { branchCount: number; all: Totals };
    console.log(
      `${tenantId.slice(0, 8)} branches=${tt.branchCount} students=${tt.all.students} classes=${tt.all.classes}`
      + ` invoices=${tt.all.invoicesCount}/${tt.all.invoicesSum} paymentsPosted=${tt.all.paymentsPostedSum}`
      + ` attendance/${month}=${tt.all.attendanceThisMonth} employees=${tt.all.employees}`
      + ` libCopies=${tt.all.libraryCopies} beds=${tt.all.hostelBeds} routes=${tt.all.transportRoutes}`,
    );
  }
  console.log(`Written: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
