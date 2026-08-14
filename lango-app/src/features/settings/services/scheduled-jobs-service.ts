import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { session, user } from '@/models/Schema';
import {
  scheduledJobControls,
  scheduledJobDefinitions,
  scheduledJobRuns,
} from '@/features/settings/models/settings-schema';

// ---------------------------------------------------------------------------
// DB-backed scheduled jobs registry. Each job has an allowlisted handler - no
// arbitrary code can be attached (settings-platform, Phase E). The worker in
// settings-worker.ts polls due jobs (isActive + nextRunAt) and the manual
// trigger endpoint shares the same execution path.
// ---------------------------------------------------------------------------

export const SCHEDULED_HANDLERS = {
  purge_sessions: { label: 'Purge des sessions expirées' },
  noop: { label: 'Test (aucun effet)' },
} as const;

const HANDLER_IMPLS: Record<string, (tenantId: string) => Promise<Record<string, unknown>>> = {
  async purge_sessions(tenantId) {
    const tenantUserIds = db.select({ id: user.id }).from(user).where(eq(user.tenantId, tenantId));
    const deleted = await db.delete(session).where(and(
      lt(session.expiresAt, new Date()),
      inArray(session.userId, tenantUserIds),
    ));
    return { purgedSessions: deleted.rowCount ?? 0 };
  },
  async noop() {
    return { note: 'Aucun traitement exécuté.' };
  },
};

export const scheduledJobInputSchema = z.object({
  key: z.string().trim().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'Clé invalide (lettres, chiffres, . _ -)'),
  name: z.string().trim().min(1).max(255),
  handler: z.string().trim().min(1).max(100).refine(h => h in SCHEDULED_HANDLERS, 'Gestionnaire non autorisé.'),
  intervalMinutes: z.number().int().min(1).max(525600),
  isActive: z.boolean().default(true),
}).strict();

export type ScheduledJobInput = z.input<typeof scheduledJobInputSchema>;

async function requireJob(tenantId: string, id: string) {
  const [job] = await db
    .select()
    .from(scheduledJobDefinitions)
    .where(and(
      eq(scheduledJobDefinitions.tenantId, tenantId),
      eq(scheduledJobDefinitions.id, id),
    ))
    .limit(1);
  if (!job) {
    throw new ApiError(404, 'SCHEDULED_JOB_NOT_FOUND', 'Tâche planifiée introuvable.');
  }
  return job;
}

export async function listScheduledJobs(tenantId: string) {
  return db
    .select()
    .from(scheduledJobDefinitions)
    .where(eq(scheduledJobDefinitions.tenantId, tenantId))
    .orderBy(scheduledJobDefinitions.createdAt);
}

export async function getScheduledJob(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  return requireJob(tenantId, id);
}

export async function createScheduledJob(context: RequestContext, input: ScheduledJobInput) {
  // Enforce the allowlist at the service layer too, not just the route - a
  // direct call must never attach a handler outside SCHEDULED_HANDLERS.
  const parsed = scheduledJobInputSchema.parse(input);
  const tenantId = requireTenant(context);
  const now = new Date();
  const nextRunAt = new Date(now.getTime() + parsed.intervalMinutes * 60000).toISOString();

  return db.transaction(async (tx) => {
    const [row] = await tx.insert(scheduledJobDefinitions).values({
      tenantId,
      ...parsed,
      nextRunAt,
      updatedAt: now.toISOString(),
    }).returning();
    if (!row) {
      throw new ApiError(500, 'SCHEDULED_JOB_CREATE_FAILED', 'Impossible de créer la tâche.');
    }
    await tx.insert(scheduledJobControls).values({
      tenantId,
      jobId: row.id,
      action: 'created',
      actorId: context.userId,
      metadata: { key: row.key, handler: row.handler, intervalMinutes: row.intervalMinutes },
    });
    return row;
  });
}

export async function updateScheduledJob(context: RequestContext, id: string, input: Partial<ScheduledJobInput>) {
  const parsed = scheduledJobInputSchema.partial().parse(input);
  const tenantId = requireTenant(context);
  await requireJob(tenantId, id);

  return db.transaction(async (tx) => {
    const [row] = await tx.update(scheduledJobDefinitions)
      .set({ ...parsed, updatedAt: new Date().toISOString() })
      .where(and(
        eq(scheduledJobDefinitions.tenantId, tenantId),
        eq(scheduledJobDefinitions.id, id),
      ))
      .returning();
    if (!row) {
      throw new ApiError(404, 'SCHEDULED_JOB_NOT_FOUND', 'Tâche planifiée introuvable.');
    }
    await tx.insert(scheduledJobControls).values({
      tenantId,
      jobId: row.id,
      action: 'updated',
      actorId: context.userId,
      metadata: { input },
    });
    return row;
  });
}

export async function deleteScheduledJob(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  await requireJob(tenantId, id);
  await db.delete(scheduledJobDefinitions)
    .where(and(
      eq(scheduledJobDefinitions.tenantId, tenantId),
      eq(scheduledJobDefinitions.id, id),
    ));
}

export async function toggleScheduledJob(context: RequestContext, id: string) {
  const tenantId = requireTenant(context);
  const job = await requireJob(tenantId, id);
  const nextIsActive = !job.isActive;

  return db.transaction(async (tx) => {
    const [row] = await tx.update(scheduledJobDefinitions)
      .set({ isActive: nextIsActive, updatedAt: new Date().toISOString() })
      .where(and(
        eq(scheduledJobDefinitions.tenantId, tenantId),
        eq(scheduledJobDefinitions.id, id),
      ))
      .returning();
    if (!row) {
      throw new ApiError(404, 'SCHEDULED_JOB_NOT_FOUND', 'Tâche planifiée introuvable.');
    }
    await tx.insert(scheduledJobControls).values({
      tenantId,
      jobId: row.id,
      action: nextIsActive ? 'enabled' : 'disabled',
      actorId: context.userId,
      metadata: { at: new Date().toISOString() },
    });
    return row;
  });
}

/**
 * Execute a job (shared by the worker and the manual trigger), record a
 * scheduled_job_runs row and recompute nextRunAt. A handler failure marks the
 * run 'error' but never throws - the job stays enabled for the next attempt.
 */
export async function runScheduledJob(tenantId: string, jobId: string, triggeredBy: 'worker' | 'manual', actorId?: string) {
  const job = await requireJob(tenantId, jobId);
  const startedAt = new Date();
  const startedIso = startedAt.toISOString();
  let status: 'success' | 'error' = 'success';
  let error: string | null = null;
  let metadata: Record<string, unknown> = {};
  let message = '';

  try {
    const impl = HANDLER_IMPLS[job.handler];
    if (!impl) {
      throw new Error(`Gestionnaire inconnu : ${job.handler}`);
    }
    metadata = (await impl(tenantId)) ?? {};
    const purged = metadata.purgedSessions;
    message = typeof purged === 'number'
      ? `Purge terminée : ${purged} session(s) expirée(s) supprimée(s).`
      : 'Exécution réussie.';
  } catch (err) {
    status = 'error';
    error = err instanceof Error ? err.message : 'Erreur d\'exécution.';
    message = error;
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();

  const [run] = await db.insert(scheduledJobRuns).values({
    tenantId,
    jobId: job.id,
    status,
    startedAt: startedIso,
    finishedAt: finishedAt.toISOString(),
    durationMs,
    error,
    triggeredBy,
    metadata,
  }).returning();
  if (!run) {
    throw new ApiError(500, 'SCHEDULED_JOB_RUN_FAILED', 'Impossible d\'enregistrer l\'exécution.');
  }

  const nextRunAt = job.intervalMinutes
    ? new Date(finishedAt.getTime() + job.intervalMinutes * 60000).toISOString()
    : null;
  await db.update(scheduledJobDefinitions)
    .set({ lastRunAt: finishedAt.toISOString(), nextRunAt, updatedAt: finishedAt.toISOString() })
    .where(eq(scheduledJobDefinitions.id, job.id));

  if (triggeredBy === 'manual' && actorId) {
    await db.insert(scheduledJobControls).values({
      tenantId,
      jobId: job.id,
      action: 'triggered',
      actorId,
      metadata: { status, durationMs, at: finishedAt.toISOString() },
    });
  }

  return { run, status, message, durationMs };
}

export async function listScheduledJobRuns(tenantId: string, jobId: string, limit = 20) {
  return db
    .select()
    .from(scheduledJobRuns)
    .where(and(
      eq(scheduledJobRuns.tenantId, tenantId),
      eq(scheduledJobRuns.jobId, jobId),
    ))
    .orderBy(desc(scheduledJobRuns.startedAt))
    .limit(limit);
}
