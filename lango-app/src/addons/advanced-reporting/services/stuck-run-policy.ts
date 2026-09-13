/**
 * When is a background report run actually dead, and what should happen to it.
 *
 * Recovery used to fail anything in `running` or `queued` whose `created_at` was
 * more than 15 minutes old. That conflates three different situations:
 *
 *   - a run queued long ago but started seconds ago (healthy, was being killed),
 *   - a run working hard for 20 minutes (healthy, was being killed),
 *   - a run whose process died one second in (dead, looked fine for 15 minutes).
 *
 * The only signal that reliably stops when a process dies is its heartbeat, so
 * that is what staleness is measured against. Pure by design — it takes a
 * snapshot and a clock so every boundary can be tested exactly.
 */

/** A run that has not checked in for this long is presumed dead. */
export const HEARTBEAT_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * A queued run that never started within this window is presumed dropped: the
 * process that should have picked it up is gone. Longer than the heartbeat
 * timeout because queueing delay under load is normal and not a fault.
 */
export const QUEUE_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * A run is retried at most this many times. A report that crashes the worker
 * will crash it again; retrying for ever turns one bad report into an outage.
 */
export const MAX_ATTEMPTS = 3;

export type RunSnapshot = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | string;
  createdAt: string | Date;
  startedAt: string | Date | null;
  heartbeatAt: string | Date | null;
  attempts: number;
};

export type RunRecovery
  /** Healthy, or not this sweep's business. */
  = | { action: 'leave'; reason: string }
  /** Dead but under the attempt cap: put it back in the queue. */
    | { action: 'requeue'; reason: string }
  /** Dead and out of attempts, or unrecoverable: mark it failed. */
    | { action: 'fail'; reason: string; message: string };

function toMs(value: string | Date | null): number | null {
  if (value === null) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Decides what to do with one run.
 *
 * `now` is injected rather than read from the clock so the boundaries are
 * testable and a sweep judges every run in a batch against one instant.
 */
export function decideRecovery(run: RunSnapshot, now: Date): RunRecovery {
  if (run.status !== 'running' && run.status !== 'queued') {
    return { action: 'leave', reason: 'Terminal status; recovery does not apply.' };
  }

  const nowMs = now.getTime();

  if (run.status === 'queued') {
    const queuedAt = toMs(run.createdAt);

    if (queuedAt === null) {
      // An unparseable timestamp cannot be aged. Failing it is safer than
      // leaving a row that no sweep will ever be able to judge.
      return {
        action: 'fail',
        reason: 'Unreadable created_at.',
        message: 'Exécution abandonnée : horodatage de création illisible.',
      };
    }

    if (nowMs - queuedAt < QUEUE_TIMEOUT_MS) {
      return { action: 'leave', reason: 'Still within the queue window.' };
    }

    return retryOrFail(run, 'Queued but never picked up.');
  }

  // status === 'running'
  // Falls back to startedAt for rows written before heartbeats existed, then to
  // createdAt. Without the fallbacks a null heartbeat reads as infinitely stale.
  const lastSeen = toMs(run.heartbeatAt) ?? toMs(run.startedAt) ?? toMs(run.createdAt);

  if (lastSeen === null) {
    return {
      action: 'fail',
      reason: 'No usable timestamp.',
      message: 'Exécution abandonnée : aucun horodatage exploitable.',
    };
  }

  // A heartbeat in the future means clock skew between workers. Treat it as
  // fresh: killing a run because another machine's clock is ahead would be a
  // self-inflicted outage.
  if (lastSeen > nowMs || nowMs - lastSeen < HEARTBEAT_TIMEOUT_MS) {
    return { action: 'leave', reason: 'Heartbeat is fresh.' };
  }

  return retryOrFail(run, 'Heartbeat stopped; process presumed dead.');
}

function retryOrFail(run: RunSnapshot, reason: string): RunRecovery {
  if (run.attempts < MAX_ATTEMPTS) {
    return { action: 'requeue', reason };
  }

  return {
    action: 'fail',
    reason,
    message: `Exécution interrompue après ${run.attempts} tentative(s) (redémarrage du serveur ou délai dépassé).`,
  };
}

export type SweepPlan = {
  requeue: string[];
  fail: { id: string; message: string }[];
  left: number;
};

/** Sorts a batch of runs into what the sweep should do to each. */
export function planSweep(runs: RunSnapshot[], now: Date): SweepPlan {
  const plan: SweepPlan = { requeue: [], fail: [], left: 0 };

  for (const run of runs) {
    const decision = decideRecovery(run, now);

    if (decision.action === 'requeue') {
      plan.requeue.push(run.id);
    } else if (decision.action === 'fail') {
      plan.fail.push({ id: run.id, message: decision.message });
    } else {
      plan.left += 1;
    }
  }

  return plan;
}
