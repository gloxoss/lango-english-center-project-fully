import { and, eq, lt } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { session, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';
import { scheduledJobControls, scheduledJobDefinitions, scheduledJobRuns } from '@/features/settings/models/settings-schema';
import {
  createScheduledJob,
  listScheduledJobs,
  runScheduledJob,
  toggleScheduledJob,
  updateScheduledJob,
} from '../services/scheduled-jobs-service';
import { runDueScheduledJobs } from '../services/settings-worker';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const hasDb = Boolean(process.env.DATABASE_URL);
const USER_ID = `USR-JOB-${crypto.randomUUID()}`;

function fakeContext(tenantId: string): RequestContext {
  return {
    userId: USER_ID,
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Scheduled Jobs Tester',
    email: 'jobs.tester@example.com',
  };
}

describe.skipIf(!hasDb)('scheduled jobs registry', () => {
  const tenantId = crypto.randomUUID();
  const ctx = () => fakeContext(tenantId);

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Scheduled Jobs Test', slug: `scheduled-${tenantId}` });
    await db.insert(user).values({
      id: USER_ID, tenantId, name: 'Scheduled Jobs Tester', email: `jobs-${tenantId}@test.local`, role: 'school_admin', userStatus: 'active',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('creates an active job with a future nextRunAt and lists it', async () => {
    const created = await createScheduledJob(ctx(), {
      key: 'purge',
      name: 'Purge des sessions',
      handler: 'purge_sessions',
      intervalMinutes: 1440,
    });
    expect(created.isActive).toBe(true);
    expect(new Date(created.nextRunAt!).getTime()).toBeGreaterThan(Date.now());

    const rows = await listScheduledJobs(tenantId);
    expect(rows.some(r => r.id === created.id)).toBe(true);
  });

  it('rejects a handler outside the allowlist', async () => {
    await expect(
      createScheduledJob(ctx(), { key: 'evil', name: 'Shell', handler: 'shell_exec', intervalMinutes: 60 }),
    ).rejects.toThrow();
  });

  it('runs purge_sessions, records the run and advances nextRunAt', async () => {
    const job = await createScheduledJob(ctx(), {
      key: 'purge-run',
      name: 'Purge avec exécution',
      handler: 'purge_sessions',
      intervalMinutes: 5,
    });

    await db.insert(session).values({
      id: `sess-${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() - 60_000),
      token: `tok-${crypto.randomUUID()}`,
      createdAt: new Date(Date.now() - 3600_000),
      updatedAt: new Date(Date.now() - 3600_000),
      userId: USER_ID,
    });

    const result = await runScheduledJob(tenantId, job.id, 'manual', USER_ID);
    expect(result.status).toBe('success');

    const [run] = await db.select().from(scheduledJobRuns)
      .where(and(eq(scheduledJobRuns.jobId, job.id), eq(scheduledJobRuns.triggeredBy, 'manual')))
      .orderBy(scheduledJobRuns.startedAt);
    expect(run).toBeDefined();
    expect(run!.status).toBe('success');

    // nextRunAt must advance past lastRunAt (both come back as wall-clock
    // strings from a mode:'string' timestamp column, so lexical compare).
    // nextRunAt must advance past lastRunAt (both come back as wall-clock
    // strings from a mode:'string' timestamp column - compare lexically; the
    // toBeGreaterThan matcher would coerce the strings to NaN).
    const [after] = await db.select().from(scheduledJobDefinitions).where(eq(scheduledJobDefinitions.id, job.id));
    expect(after).toBeDefined();
    expect(after!.lastRunAt).not.toBeNull();
    expect(after!.nextRunAt).not.toBeNull();
    expect(after!.nextRunAt! > after!.lastRunAt!).toBe(true);

    // The stale session was purged.
    const remaining = await db.select().from(session)
      .where(and(eq(session.userId, USER_ID), lt(session.expiresAt, new Date())));
    expect(remaining.length).toBe(0);
  });

  it('the worker fires a due active job but skips inactive ones', async () => {
    const dueJob = await createScheduledJob(ctx(), {
      key: 'worker-due',
      name: 'Due pour le worker',
      handler: 'noop',
      intervalMinutes: 5,
    });
    const pausedJob = await createScheduledJob(ctx(), {
      key: 'worker-paused',
      name: 'Suspendue',
      handler: 'noop',
      intervalMinutes: 5,
      isActive: false,
    });

    // Backdate both so they are due, but keep the paused job inactive.
    const past = new Date(Date.now() - 60_000).toISOString();
    await db.update(scheduledJobDefinitions).set({ nextRunAt: past }).where(eq(scheduledJobDefinitions.id, dueJob.id));
    await db.update(scheduledJobDefinitions).set({ nextRunAt: past }).where(eq(scheduledJobDefinitions.id, pausedJob.id));

    const { triggered } = await runDueScheduledJobs();
    expect(triggered).toBe(1);

    const [ran] = await db.select().from(scheduledJobDefinitions).where(eq(scheduledJobDefinitions.id, dueJob.id));
    expect(ran).toBeDefined();
    expect(ran!.lastRunAt).not.toBeNull();

    const [skipped] = await db.select().from(scheduledJobDefinitions).where(eq(scheduledJobDefinitions.id, pausedJob.id));
    expect(skipped).toBeDefined();
    expect(skipped!.lastRunAt).toBeNull();
  });

  it('toggle flips activation and writes a control row; update changes the name', async () => {
    const job = await createScheduledJob(ctx(), {
      key: 'toggle-me',
      name: 'Avant bascule',
      handler: 'noop',
      intervalMinutes: 60,
    });

    const toggled = await toggleScheduledJob(ctx(), job.id);
    expect(toggled.isActive).toBe(false);

    const [control] = await db.select().from(scheduledJobControls)
      .where(and(eq(scheduledJobControls.jobId, job.id), eq(scheduledJobControls.action, 'disabled')))
      .limit(1);
    expect(control).toBeDefined();

    const updated = await updateScheduledJob(ctx(), job.id, { name: 'Après mise à jour' });
    expect(updated.name).toBe('Après mise à jour');
  });
});
