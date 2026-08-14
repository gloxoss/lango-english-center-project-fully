import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { reportSchedules } from '../models/reporting-schema';
import { cleanupExpiredReportFiles } from './report-cleanup';
import { RunEngine } from './run-engine';
import { ScheduleService } from './schedule-service';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Executes every report_schedules row whose next-run time has passed.
// Reuses RunEngine.queueRun (the same real execution path the manual "run"
// button uses) rather than duplicating run/export logic. If a schedule's
// underlying report query fails (e.g. a stale/deleted target referenced in
// its parameters), RunEngine's own executeRunInBackground already catches
// that and marks just that one run 'failed' with a real error message - the
// schedule itself is never disabled over one bad occurrence, per the PRD.
export async function runDueSchedules(): Promise<{ triggered: number }> {
  const due = await db
    .select()
    .from(reportSchedules)
    .where(and(eq(reportSchedules.isActive, true), lte(reportSchedules.nextRunAt, new Date().toISOString())));

  let triggered = 0;
  for (const schedule of due) {
    try {
      await RunEngine.queueRun(schedule.tenantId, schedule.reportKey, schedule.parameters as Record<string, any>, schedule.format, schedule.createdById);
    } catch {
      // queueRun itself only throws on failure to create the run record
      // (e.g. a DB outage) - a report query failure is already handled
      // inside RunEngine and surfaces as a failed run, not a thrown error
      // here. Either way, this schedule's row is still updated below so
      // it isn't retried in a tight loop.
    }

    const now = new Date();
    let nextRunAt: string;
    try {
      nextRunAt = ScheduleService.calculateNextRun(schedule.cronExpression, now).toISOString();
    } catch {
      // Cron expression became invalid after creation (shouldn't happen,
      // since section-02 validates at creation time) - deactivate rather
      // than loop forever trying to compute a next run.
      await db.update(reportSchedules).set({ isActive: false, lastRunAt: now.toISOString() }).where(eq(reportSchedules.id, schedule.id));
      continue;
    }

    await db.update(reportSchedules).set({ lastRunAt: now.toISOString(), nextRunAt }).where(eq(reportSchedules.id, schedule.id));
    triggered += 1;
  }

  return { triggered };
}

let started = false;

// Singleton in-process worker (future-implementation/advanced-reporting
// remediation, section-06) - this codebase has no prior background-job
// pattern to reuse, so this is the smallest viable mechanism for the
// single-container Docker Compose deployment: no new infrastructure, just a
// polling interval inside the existing app process. The `started` guard
// prevents duplicate intervals if register() is ever invoked more than once.
export function startReportScheduleWorker(): void {
  if (started) {
    return;
  }
  started = true;

  setInterval(() => {
    runDueSchedules().catch(err => console.error('[report-scheduler] runDueSchedules failed:', err));
    cleanupExpiredReportFiles().catch(err => console.error('[report-scheduler] cleanupExpiredReportFiles failed:', err));
  }, POLL_INTERVAL_MS);
}
