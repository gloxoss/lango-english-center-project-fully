import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getAttendanceAggregate } from '@/libs/api/attendance-aggregate';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { db } from '@/libs/DB';
import { getDefaultSessionYearId } from '@/libs/services/subject-teacher-assignment';
import { attendance, attendanceSummary, tenants } from '@/models/Schema';

// Repairs `attendance_summary` caches that can no longer be trusted.
//
// Why this exists: seed-full.ts used to INSERT summary rows from fixed random
// numbers entirely disconnected from the marks (present+late+excused could
// exceed the fixed total, giving negative absences and rates above 100%). The
// seed is fixed, but databases seeded before that still carry the bad rows, and
// nothing rewrites a cache row until that student's next mark.
//
// The repair is derived-data only: it recomputes each student's cache from the
// real marks through the canonical aggregation, exactly as a live mark does. It
// never touches attendance history, and re-running it is a no-op.
//
//   npx tsx scripts/rebuild-attendance-summaries.ts              # audit only
//   npx tsx scripts/rebuild-attendance-summaries.ts --apply      # rewrite caches
//   npx tsx scripts/rebuild-attendance-summaries.ts --apply --tenant <uuid>
//
// Audit is the default so this can never silently mutate a shared database.

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]!.trim()]) process.env[match[1]!.trim()] = match[2]!.trim();
  }
}

type Health = {
  totalRows: number;
  overHundred: number;
  negative: number;
  disagreeing: number;
};

/** How far the stored caches are from what the marks actually say. */
async function auditTenant(tenantId: string): Promise<Health> {
  const rows = await db
    .select()
    .from(attendanceSummary)
    .where(eq(attendanceSummary.tenantId, tenantId));

  const sessionYearId = await getDefaultSessionYearId(tenantId);

  let overHundred = 0;
  let negative = 0;
  let disagreeing = 0;

  for (const row of rows) {
    const rate = row.attendanceRate === null ? null : Number(row.attendanceRate);

    if (rate !== null && rate > 100) overHundred += 1;
    if (row.totalAbsent < 0 || row.totalPresent < 0 || row.totalLate < 0 || row.totalExcused < 0 || row.totalSessions < 0) {
      negative += 1;
    }

    const aggregate = sessionYearId
      ? await getAttendanceAggregate({ tenantId, sessionYearId, studentId: row.studentId })
      : null;

    const canonical = aggregate
      ? {
          totalPresent: aggregate.presentCount,
          totalAbsent: aggregate.absentCount,
          totalLate: aggregate.lateCount,
          totalExcused: aggregate.excusedCount,
          totalSessions: aggregate.recordedTotal,
          attendanceRate: aggregate.presenceRate === null ? null : aggregate.presenceRate.toFixed(2),
        }
      : {
          totalPresent: 0, totalAbsent: 0, totalLate: 0, totalExcused: 0, totalSessions: 0, attendanceRate: null,
        };

    if (
      row.totalPresent !== canonical.totalPresent
      || row.totalAbsent !== canonical.totalAbsent
      || row.totalLate !== canonical.totalLate
      || row.totalExcused !== canonical.totalExcused
      || row.totalSessions !== canonical.totalSessions
      || (row.attendanceRate === null ? null : Number(row.attendanceRate).toFixed(2)) !== canonical.attendanceRate
    ) {
      disagreeing += 1;
    }
  }

  return { totalRows: rows.length, overHundred, negative, disagreeing };
}

/** Students who actually have marks — the only ones a summary can be derived from. */
async function studentsWithMarks(tenantId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ studentId: attendance.studentId })
    .from(attendance)
    .where(eq(attendance.tenantId, tenantId));

  return rows.map(r => r.studentId).filter(Boolean) as string[];
}

function report(label: string, h: Health) {
  console.log(`  ${label}: ${h.totalRows} rows | >100%: ${h.overHundred} | negative: ${h.negative} | disagreeing with marks: ${h.disagreeing}`);
}

async function main() {
  loadLocalEnv();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const tenantFlag = args.indexOf('--tenant');
  const onlyTenant = tenantFlag >= 0 ? args[tenantFlag + 1] : undefined;

  // A shared/production database is never repaired implicitly.
  if (apply && process.env.NODE_ENV === 'production' && !args.includes('--force')) {
    throw new Error('Refusing to rewrite summaries in production without --force.');
  }

  const tenantRows = onlyTenant
    ? await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, onlyTenant))
    : await db.select({ id: tenants.id, name: tenants.name }).from(tenants);

  console.log(`rebuild-attendance-summaries — ${apply ? 'APPLY' : 'AUDIT ONLY (pass --apply to write)'}`);
  // An operator about to rewrite a cache must be able to see WHICH database.
  const target = new URL(process.env.DATABASE_URL);
  console.log(`database: ${target.hostname}:${target.port || '5432'}${target.pathname}`);
  console.log(`tenants: ${tenantRows.length}\n`);

  const totals: Health = { totalRows: 0, overHundred: 0, negative: 0, disagreeing: 0 };

  for (const tenant of tenantRows) {
    const studentIds = await studentsWithMarks(tenant.id);
    const before = await auditTenant(tenant.id);

    if (studentIds.length === 0 && before.totalRows === 0) {
      continue;
    }

    console.log(`${tenant.name} (${tenant.id}) — ${studentIds.length} students with marks`);
    report('before', before);

    if (apply && studentIds.length > 0) {
      // The canonical helper deletes and re-inserts each student's cache row, so
      // this is idempotent and leaves attendance history untouched.
      for (const studentId of studentIds) {
        await recalculateStudentAttendanceSummary(tenant.id, studentId);
      }
      report('after ', await auditTenant(tenant.id));
    }

    totals.totalRows += before.totalRows;
    totals.overHundred += before.overHundred;
    totals.negative += before.negative;
    totals.disagreeing += before.disagreeing;
    console.log('');
  }

  // Stale cache rows for students who have no marks at all are left in place:
  // removing them would delete data this tool has no mandate to judge.
  const grand = apply ? await Promise.all(tenantRows.map(t => auditTenant(t.id))) : null;

  console.log('=== SUMMARY ===');
  if (grand) {
    const after: Health = grand.reduce(
      (acc, h) => ({
        totalRows: acc.totalRows + h.totalRows,
        overHundred: acc.overHundred + h.overHundred,
        negative: acc.negative + h.negative,
        disagreeing: acc.disagreeing + h.disagreeing,
      }),
      { totalRows: 0, overHundred: 0, negative: 0, disagreeing: 0 },
    );
    report('after rebuild', after);
  } else {
    report('current', totals);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
