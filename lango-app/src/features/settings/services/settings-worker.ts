import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { scheduledJobDefinitions } from '@/features/settings/models/settings-schema';
import { runScheduledJob } from './scheduled-jobs-service';

const POLL_INTERVAL_MS = 60 * 1000;

// Runs every enabled scheduled_job_definitions whose nextRunAt has passed,
// across all tenants (a background system process, not a user request - the
// same cross-tenant scan the report schedule worker performs). Each due job
// runs through runScheduledJob, which records the outcome and advances
// nextRunAt, so a failing job is never retried in a tight loop.
export async function runDueScheduledJobs(): Promise<{ triggered: number }> {
  const due = await db
    .select()
    .from(scheduledJobDefinitions)
    .where(and(eq(scheduledJobDefinitions.isActive, true), lte(scheduledJobDefinitions.nextRunAt, new Date().toISOString())));

  let triggered = 0;
  for (const job of due) {
    try {
      await runScheduledJob(job.tenantId, job.id, 'worker');
      triggered += 1;
    } catch (err) {
      // runScheduledJob never throws for a handler failure, only for a missing
      // row or a DB outage - in that case skip this cycle and retry next poll.
      console.error('[settings-worker] runScheduledJob failed:', job.id, err);
    }
  }
  return { triggered };
}

let started = false;

// Singleton in-process poller for the single-container Compose deployment -
// same pattern as the report schedule worker. The `started` guard prevents
// duplicate intervals if register() is ever invoked more than once.
export function startSettingsWorker(): void {
  if (started) {
    return;
  }
  started = true;

  setInterval(() => {
    runDueScheduledJobs().catch(err => console.error('[settings-worker] runDueScheduledJobs failed:', err));
  }, POLL_INTERVAL_MS);
}
