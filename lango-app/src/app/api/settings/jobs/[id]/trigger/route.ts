import { and, eq, inArray, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { getEffectiveValue, setSettingValue } from '@/libs/settings/registry';
import { session, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

type JobRecord = Record<string, unknown> & {
  id: string;
  name: string;
  action?: string;
  status?: string;
  lastRun?: string;
  lastMessage?: string;
  nextRun?: string;
};

// POST /api/settings/jobs/[id]/trigger — runs the job's real side-effect where one
// exists (e.g. purge of expired sessions), persists the updated status/lastRun,
// records the run in the audit log and returns the updated job + audit item.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.jobs.manage');

    const { id } = await params;

    const effective = await getEffectiveValue(tenantId, context.branchId, 'jobs.definitions');
    const jobs = (Array.isArray(effective.value) ? effective.value : []) as JobRecord[];
    const index = jobs.findIndex(j => j.id === id);
    if (index === -1) {
      throw new ApiError(404, 'JOB_NOT_FOUND', 'Tâche planifiée introuvable.');
    }

    const job = jobs[index]!;
    const startedAt = new Date();
    let resultMessage: string;
    let purgeCount = 0;

    try {
      // Real side-effect when the job has one; otherwise the run is recorded only.
      if (job.action === 'purge_sessions') {
        const tenantUserIds = db.select({ id: user.id }).from(user).where(eq(user.tenantId, tenantId));
        const deleted = await db.delete(session).where(and(
          lt(session.expiresAt, startedAt),
          inArray(session.userId, tenantUserIds),
        ));
        purgeCount = deleted.rowCount ?? 0;
        resultMessage = `Purge terminée : ${purgeCount} session(s) expirée(s) supprimée(s).`;
      } else {
        resultMessage = 'Exécution manuelle enregistrée (aucun traitement métier attaché à cette tâche).';
      }

      const updatedJob: JobRecord = {
        ...job,
        status: 'success',
        lastRun: startedAt.toISOString(),
        lastMessage: resultMessage,
        nextRun: 'À la demande',
      };
      jobs[index] = updatedJob;
      await setSettingValue(
        tenantId, context.branchId, 'jobs.definitions',
        jobs, context, `Exécution manuelle du job ${id}`,
      );

      const auditItem = {
        id: `aud-${Date.now()}`,
        user: context.name || context.email || 'Administrateur',
        action: `Exécution manuelle du job : ${job.name}`,
        module: 'Tâches planifiées',
        severity: 'info' as const,
        timestamp: `À l'instant (${startedAt.toLocaleTimeString('fr-FR')})`,
      };
      recordAudit(context, 'update', 'job_run', id, {
        action: 'trigger',
        result: resultMessage,
        purgedSessions: purgeCount,
      });

      return NextResponse.json({ success: true, job: updatedJob, auditItem });
    } catch (runErr) {
      const message = runErr instanceof Error ? runErr.message : "Erreur lors de l'exécution.";
      const updatedJob: JobRecord = {
        ...job,
        status: 'error',
        lastRun: startedAt.toISOString(),
        lastMessage: message,
      };
      jobs[index] = updatedJob;
      await setSettingValue(
        tenantId, context.branchId, 'jobs.definitions',
        jobs, context, `Exécution manuelle du job ${id} (échec)`,
      );
      recordAudit(context, 'update', 'job_run', id, { action: 'trigger', error: message });
      return NextResponse.json({ success: false, job: updatedJob, message }, { status: 500 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
