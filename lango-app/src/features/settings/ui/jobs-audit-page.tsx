// jobs-audit-page.tsx
// SERVER COMPONENT — pre-fetches scheduled jobs (tenant-scoped, seeded from the
// jobs config on first load), real system health metrics, maintenance windows
// and the tenant's operational audit trail.
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getServerUserContext } from '@/libs/auth/server-context';
import { getEffectiveValue } from '@/libs/settings/registry';
import { auditLogs, files, session, smsMessages, user } from '@/models/Schema';
import {
  SCHEDULED_JOBS, MAINTENANCE_WINDOWS,
} from '@/features/settings/data/jobs-audit-config';
import {
  JobsAuditClient, JobItem, AuditLogItem, HealthMetricItem,
} from './jobs-audit-client';

const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  import: 'Import de données',
  export: 'Export de données',
  settings_change: 'Modification de paramètre',
  permission_change: 'Modification de permissions',
};

const MODULE_LABELS: Record<string, string> = {
  job_run: 'Tâches planifiées',
  setting: 'Paramètres',
  settings: 'Paramètres',
  session: 'Sessions',
  school_settings: 'Paramètres école',
  payment: 'Paiements',
  invoice: 'Factures',
};

function auditSeverity(action: string): AuditLogItem['severity'] {
  if (action === 'delete') return 'error';
  if (action === 'create' || action === 'import') return 'success';
  return 'info';
}

export async function JobsAuditPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialJobs: JobItem[] = Array.from(SCHEDULED_JOBS) as JobItem[];
  let initialAudits: AuditLogItem[] = [];
  let initialHealthMetrics: HealthMetricItem[] = [];
  let initialQueuedSms = 0;
  const initialMaintenanceWindows = Array.from(MAINTENANCE_WINDOWS);

  try {
    if (tenantId && ctx) {
      // Read-only: when the tenant has never customized jobs, render the config
      // seed. Persistence happens on the first user edit (PATCH), never here.
      const effectiveJobs = await getEffectiveValue(tenantId, ctx.branchId, 'jobs.definitions');
      const stored = effectiveJobs.source === 'default' ? null : (effectiveJobs.value as JobItem[] | null);
      initialJobs = Array.isArray(stored) && stored.length > 0
        ? stored
        : Array.from(SCHEDULED_JOBS) as JobItem[];

      // Real system health metrics: live DB latency + tenant-scoped row counts.
      const latencyStart = Date.now();
      await db.execute(sql`select 1`);
      const latencyMs = Date.now() - latencyStart;

      const [sessionRows, fileRows, smsSentRows, smsQueuedRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(session)
          .innerJoin(user, eq(session.userId, user.id))
          .where(and(eq(user.tenantId, tenantId), gt(session.expiresAt, new Date()))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(files)
          .where(and(eq(files.tenantId, tenantId), eq(files.isDeleted, false))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(smsMessages)
          .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.status, 'sent'))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(smsMessages)
          .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.status, 'queued'))),
      ]);

      const activeSessions = sessionRows[0]?.count ?? 0;
      const fileCount = fileRows[0]?.count ?? 0;
      const smsSentCount = smsSentRows[0]?.count ?? 0;
      initialQueuedSms = smsQueuedRows[0]?.count ?? 0;

      initialHealthMetrics = [
        {
          id: 'db-latency',
          name: 'Latence base de données',
          value: `${latencyMs} ms`,
          note: 'Temps de réponse PostgreSQL (SELECT 1)',
          status: latencyMs < 500 ? 'healthy' : 'warning',
        },
        {
          id: 'active-sessions',
          name: 'Sessions actives',
          value: String(activeSessions),
          note: "Connexions en cours de l'établissement",
          status: 'healthy',
        },
        {
          id: 'files',
          name: 'Fichiers importés',
          value: String(fileCount),
          note: 'Fichiers (imports, pièces jointes)',
          status: 'healthy',
        },
        {
          id: 'sms-sent',
          name: 'SMS envoyés',
          value: String(smsSentCount),
          note: 'Messages WhatsApp/SMS envoyés',
          status: 'healthy',
        },
      ];

      // Real tenant-scoped operational audit trail.
      const auditRows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          actorId: auditLogs.actorId,
          actorName: user.name,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(user, eq(auditLogs.actorId, user.id))
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10);

      initialAudits = auditRows.map(a => ({
        id: a.id,
        user: a.actorName ?? (a.actorId ? `Utilisateur (${a.actorId.slice(0, 8)})` : 'Système automatique'),
        action: ACTION_LABELS[a.action] ?? `Opération ${a.action}`,
        module: MODULE_LABELS[a.entityType] ?? (a.entityType || 'Système'),
        severity: auditSeverity(a.action),
        timestamp: a.createdAt ? new Date(a.createdAt).toLocaleString('fr-FR') : 'Récemment',
      }));
    }
  } catch (err) {
    console.error('Failed to pre-fetch jobs & audit page data server-side:', err);
  }

  return (
    <JobsAuditClient
      initialJobs={initialJobs}
      initialAudits={initialAudits}
      initialHealthMetrics={initialHealthMetrics}
      initialMaintenanceWindows={initialMaintenanceWindows}
      initialQueuedSms={initialQueuedSms}
    />
  );
}
