import type { RunSnapshot } from './stuck-run-policy';
import { describe, expect, it } from 'vitest';
import {
  decideRecovery,
  HEARTBEAT_TIMEOUT_MS,
  MAX_ATTEMPTS,
  planSweep,
  QUEUE_TIMEOUT_MS,

} from './stuck-run-policy';

const NOW = new Date('2026-09-11T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function run(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    id: 'run-1',
    status: 'running',
    createdAt: ago(60_000),
    startedAt: ago(55_000),
    heartbeatAt: ago(5_000),
    attempts: 1,
    ...overrides,
  };
}

describe('decideRecovery — running runs', () => {
  it('leaves a run whose heartbeat is fresh', () => {
    expect(decideRecovery(run(), NOW).action).toBe('leave');
  });

  it('leaves a long-running report that is still beating', () => {
    // The old created_at rule killed this one: 40 minutes old, but alive.
    const decision = decideRecovery(run({
      createdAt: ago(40 * 60_000),
      startedAt: ago(39 * 60_000),
      heartbeatAt: ago(10_000),
    }), NOW);

    expect(decision.action).toBe('leave');
  });

  it('requeues a run whose heartbeat stopped', () => {
    // And this one the old rule missed for a full 15 minutes.
    const decision = decideRecovery(run({ heartbeatAt: ago(HEARTBEAT_TIMEOUT_MS + 1_000) }), NOW);

    expect(decision.action).toBe('requeue');
  });

  it('treats the timeout boundary as still alive', () => {
    expect(decideRecovery(run({ heartbeatAt: ago(HEARTBEAT_TIMEOUT_MS - 1) }), NOW).action).toBe('leave');
    expect(decideRecovery(run({ heartbeatAt: ago(HEARTBEAT_TIMEOUT_MS) }), NOW).action).toBe('requeue');
  });

  it('fails a dead run that is out of attempts', () => {
    const decision = decideRecovery(run({
      heartbeatAt: ago(HEARTBEAT_TIMEOUT_MS * 10),
      attempts: MAX_ATTEMPTS,
    }), NOW);

    expect(decision.action).toBe('fail');
    expect(decision.action === 'fail' && decision.message).toContain(String(MAX_ATTEMPTS));
  });

  it('does not kill a run because another worker’s clock runs ahead', () => {
    const decision = decideRecovery(run({ heartbeatAt: new Date(NOW.getTime() + 30_000).toISOString() }), NOW);

    expect(decision.action).toBe('leave');
  });

  it('falls back to startedAt for a row written before heartbeats existed', () => {
    expect(decideRecovery(run({ heartbeatAt: null, startedAt: ago(10_000) }), NOW).action).toBe('leave');
    expect(decideRecovery(run({ heartbeatAt: null, startedAt: ago(HEARTBEAT_TIMEOUT_MS * 2) }), NOW).action).toBe('requeue');
  });

  it('falls back to createdAt when neither heartbeat nor start is recorded', () => {
    // A null heartbeat must not read as infinitely stale and sweep the row away.
    expect(decideRecovery(run({ heartbeatAt: null, startedAt: null, createdAt: ago(10_000) }), NOW).action)
      .toBe('leave');
  });

  it('fails a row with no usable timestamp at all', () => {
    const decision = decideRecovery(run({ heartbeatAt: null, startedAt: null, createdAt: 'not-a-date' }), NOW);

    expect(decision.action).toBe('fail');
  });
});

describe('decideRecovery — queued runs', () => {
  it('leaves a recently queued run alone', () => {
    expect(decideRecovery(run({ status: 'queued', createdAt: ago(30_000), startedAt: null, heartbeatAt: null }), NOW).action)
      .toBe('leave');
  });

  it('tolerates a longer wait than a running run, because queueing delay is normal', () => {
    const justUnder = run({
      status: 'queued',
      createdAt: ago(QUEUE_TIMEOUT_MS - 1_000),
      startedAt: null,
      heartbeatAt: null,
    });

    expect(decideRecovery(justUnder, NOW).action).toBe('leave');
  });

  it('requeues a run nothing ever picked up', () => {
    const decision = decideRecovery(run({
      status: 'queued',
      createdAt: ago(QUEUE_TIMEOUT_MS + 1_000),
      startedAt: null,
      heartbeatAt: null,
      attempts: 0,
    }), NOW);

    expect(decision.action).toBe('requeue');
  });

  it('judges a queued run by its queue time, not by a stale heartbeat', () => {
    // A run requeued after a crash keeps an old heartbeat on some paths; it must
    // not be failed again the instant it goes back in the queue.
    const decision = decideRecovery(run({
      status: 'queued',
      createdAt: ago(30_000),
      heartbeatAt: ago(HEARTBEAT_TIMEOUT_MS * 5),
    }), NOW);

    expect(decision.action).toBe('leave');
  });
});

describe('decideRecovery — terminal runs', () => {
  it('never touches a finished run', () => {
    for (const status of ['completed', 'failed', 'cancelled', 'succeeded']) {
      const decision = decideRecovery(run({ status, heartbeatAt: ago(10 * 60_000) }), NOW);

      expect(decision.action).toBe('leave');
    }
  });
});

describe('planSweep', () => {
  it('sorts a mixed batch into requeue, fail and leave', () => {
    const plan = planSweep([
      run({ id: 'alive', heartbeatAt: ago(5_000) }),
      run({ id: 'dead-retryable', heartbeatAt: ago(10 * 60_000), attempts: 1 }),
      run({ id: 'dead-exhausted', heartbeatAt: ago(10 * 60_000), attempts: MAX_ATTEMPTS }),
      run({ id: 'done', status: 'completed' }),
    ], NOW);

    expect(plan.requeue).toEqual(['dead-retryable']);
    expect(plan.fail.map(f => f.id)).toEqual(['dead-exhausted']);
    expect(plan.left).toBe(2);
  });

  it('returns an empty plan for an empty batch', () => {
    expect(planSweep([], NOW)).toEqual({ requeue: [], fail: [], left: 0 });
  });

  it('judges every run in a batch against the same instant', () => {
    const borderline = Array.from({ length: 5 }, (_, i) =>
      run({ id: `r${i}`, heartbeatAt: ago(HEARTBEAT_TIMEOUT_MS) }));

    const plan = planSweep(borderline, NOW);

    // All identical, so all must land in the same bucket — no time drift between
    // the first and last row of a large sweep.
    expect(plan.requeue).toHaveLength(5);
    expect(plan.left).toBe(0);
  });
});
