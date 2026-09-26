import fs from 'node:fs';
import path from 'node:path';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { classifyPeriod1Mark } from '@/libs/attendance/period1-audit';
import {
  isCancelled,
  listSessionOccurrences,
} from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { getEffectiveValueWithLegacyFallback } from '@/libs/settings/registry';
import { attendance, attendanceScanEvents, tenants } from '@/models/Schema';

// Counts QR-scan marks that were written to period 1 by the old default while
// they actually happened during a different lesson.
//
// Why they exist: before fix-plan-01 item 1 the QR route declared
// `period: z.number()...optional().default(1)`, and the client never sent a
// period. So every scan the scanner produced was stored against period 1 and
// judged late against period 1's start. The route is fixed; these rows are
// already in the database and they are wrong.
//
// READ-ONLY BY DESIGN. There is no --apply. Moving a mark to what we now think
// the right lesson was would overwrite what the register actually recorded, and
// a report is what a human needs to decide: some of these may have been
// corrected by hand since, and some sections may have had no timetable at all
// that day, in which case period 1 was the honest answer.
//
// Only rows carrying a scanEventId are examined: that column is what proves the
// QR path wrote the row. A manual mark with period 1 is a teacher choosing
// period 1, which is legitimate and must not be counted as corruption.
//
//   npx tsx scripts/report-corrupted-period1-marks.ts
//   npx tsx scripts/report-corrupted-period1-marks.ts --tenant <uuid>
//
// The audit database is the right target, never production without a human:
//   DATABASE_URL=...schoolos_audit npx tsx scripts/report-corrupted-period1-marks.ts

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]!.trim()]) {
      process.env[match[1]!.trim()] = match[2]!.trim();
    }
  }
}

const DEFAULT_TIMEZONE = 'Africa/Casablanca';

/**
 * `scanned_at` is a `timestamp without time zone`, so the string it returns is a
 * naive wall clock with no offset. Postgres renders it in the session TimeZone,
 * which is why the report prints that setting: if it is not UTC, every minute
 * below is shifted and the verdicts are wrong.
 */
function naiveToUtc(scannedAt: string): Date {
  return new Date(`${scannedAt.replace(' ', 'T')}Z`);
}

function localMinuteOfDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

type Candidate = {
  attendanceId: string;
  classSectionId: string;
  date: string;
  status: string;
  scannedAt: string;
};

type TenantReport = {
  tenantId: string;
  tenantName: string;
  candidates: number;
  corrupted: number;
  okOnPeriod1: number;
  undecidable: number;
  samples: { date: string; scannedAt: string; foundPeriod: number; status: string }[];
};

async function auditTenant(tenantId: string, tenantName: string): Promise<TenantReport> {
  const tzEff = await getEffectiveValueWithLegacyFallback(tenantId, null, 'localization.timezone');
  const timeZone = (tzEff.value as string) || DEFAULT_TIMEZONE;

  const rows = await db
    .select({
      attendanceId: attendance.id,
      classSectionId: attendance.classSectionId,
      date: attendance.date,
      status: attendance.status,
      scannedAt: attendanceScanEvents.scannedAt,
    })
    .from(attendance)
    .innerJoin(attendanceScanEvents, eq(attendance.scanEventId, attendanceScanEvents.id))
    .where(and(
      eq(attendance.tenantId, tenantId),
      eq(attendance.period, 1),
      eq(attendance.isVoided, false),
      isNotNull(attendance.scanEventId),
      isNotNull(attendance.classSectionId),
    ));

  const candidates = rows.filter(r => r.classSectionId !== null) as Candidate[];

  // One timetable read per section-day rather than one per mark.
  const bySectionDay = new Map<string, Candidate[]>();
  for (const row of candidates) {
    const key = `${row.classSectionId}|${row.date}`;
    bySectionDay.set(key, [...(bySectionDay.get(key) ?? []), row]);
  }

  const report: TenantReport = {
    tenantId,
    tenantName,
    candidates: candidates.length,
    corrupted: 0,
    okOnPeriod1: 0,
    undecidable: 0,
    samples: [],
  };

  for (const group of bySectionDay.values()) {
    const first = group[0]!;
    let live;
    try {
      const occurrences = await listSessionOccurrences({
        tenantId,
        date: first.date,
        classSectionId: first.classSectionId,
      });
      live = occurrences.filter(o => !isCancelled(o));
    } catch {
      // No timetable for that day: period 1 was the only thing the old code
      // could have said, so nothing here is provably wrong.
      report.undecidable += group.length;
      continue;
    }

    for (const row of group) {
      const minute = localMinuteOfDay(naiveToUtc(row.scannedAt), timeZone);
      const { verdict, foundPeriod } = classifyPeriod1Mark(minute, live, 1);

      if (verdict === 'UNDECIDABLE') {
        report.undecidable += 1;
      } else if (verdict === 'OK_PERIOD_1') {
        report.okOnPeriod1 += 1;
      } else {
        report.corrupted += 1;
        if (report.samples.length < 5) {
          report.samples.push({
            date: row.date,
            scannedAt: row.scannedAt,
            foundPeriod: foundPeriod ?? 0,
            status: row.status,
          });
        }
      }
    }
  }

  return report;
}

async function main() {
  loadLocalEnv();

  const tenantFlag = process.argv.indexOf('--tenant');
  const onlyTenant = tenantFlag !== -1 ? process.argv[tenantFlag + 1] : undefined;

  const tzResult = await db.execute(sql`SHOW TimeZone`);
  const sessionTz = (tzResult.rows?.[0] as { TimeZone?: string } | undefined)?.TimeZone ?? 'unknown';

  console.log(`Postgres session TimeZone: ${sessionTz}`);
  if (sessionTz.toUpperCase() !== 'UTC') {
    console.log('  WARNING: scanned_at is read as UTC below. At this session TimeZone the');
    console.log('  hour offsets are shifted, so treat every verdict as unreliable.');
  }
  console.log('');

  const allTenants = onlyTenant
    ? await db.select().from(tenants).where(eq(tenants.id, onlyTenant))
    : await db.select().from(tenants);

  let totalCorrupted = 0;

  for (const tenant of allTenants) {
    const report = await auditTenant(tenant.id, tenant.name);
    totalCorrupted += report.corrupted;

    console.log(`tenant ${report.tenantName} (${report.tenantId})`);
    console.log(`  QR marks stored on period 1 : ${report.candidates}`);
    console.log(`  wrong lesson (corrupted)    : ${report.corrupted}`);
    console.log(`  correctly on period 1       : ${report.okOnPeriod1}`);
    console.log(`  undecidable (no timetable)  : ${report.undecidable}`);

    for (const sample of report.samples) {
      console.log(`    ${sample.date} scanned ${sample.scannedAt} -> really period ${sample.foundPeriod} (${sample.status})`);
    }
    console.log('');
  }

  console.log(`TOTAL corrupted marks across ${allTenants.length} tenant(s): ${totalCorrupted}`);
  console.log('Nothing was changed. Re-keying these rows is a human decision.');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
