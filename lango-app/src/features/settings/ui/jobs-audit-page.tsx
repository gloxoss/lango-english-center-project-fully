// jobs-audit-page.tsx
// SERVER COMPONENT — pre-fetches scheduled jobs (tenant-scoped, seeded from the
// jobs config on first load), real system health metrics, maintenance windows
// and the tenant's operational audit trail.
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/libs/DB';
import { getServerUserContext } from '@/libs/auth/server-context';
import { getEffectiveValue } from '@/libs/settings/registry';
import { auditLogs, files, session, smsMessages, user } from '@/models/Schema';
import { SCHEDULED_JOBS } from '@/features/settings/data/jobs-audit-config';
import {
  JobsAuditClient, JobItem, AuditLogItem, HealthMetricItem,
} from './jobs-audit-client';

// Action / module labels live in JobsAudit.audit.{actions,modules}.*.
function auditSeverity(action: string): AuditLogItem['severity'] {
  if (action === 'delete') return 'error';
  if (action === 'create' || action === 'import') return 'success';
  return 'info';
}

export async function JobsAuditPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;
  const uiLocale = locale === 'ar' || locale === 'en' ? locale : 'fr';
  const t = await getTranslations({ locale: uiLocale, namespace: 'JobsAudit' });
  const dateLocale = uiLocale === 'ar' ? 'ar-MA' : uiLocale === 'en' ? 'en-GB' : 'fr-FR';

  let initialJobs: JobItem[] = Array.from(SCHEDULED_JOBS) as JobItem[];
  let initialAudits: AuditLogItem[] = [];
  let initialHealthMetrics: HealthMetricItem[] = [];
  let initialQueuedSms = 0;

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
          name: t('metricDbLatency'),
          value: `${latencyMs} ms`,
          note: t('metricDbLatencyNote'),
          status: latencyMs < 500 ? 'healthy' : 'warning',
        },
        {
          id: 'active-sessions',
          name: t('metricSessions'),
          value: String(activeSessions),
          note: t('metricSessionsNote'),
          status: 'healthy',
        },
        {
          id: 'files',
          name: t('metricFiles'),
          value: String(fileCount),
          note: t('metricFilesNote'),
          status: 'healthy',
        },
        {
          id: 'sms-sent',
          name: t('metricSms'),
          value: String(smsSentCount),
          note: t('metricSmsNote'),
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
        user: a.actorName ?? (a.actorId ? t('userShort', { id: a.actorId.slice(0, 8) }) : t('system')),
        action: t.has(`audit.actions.${a.action}`) ? t(`audit.actions.${a.action}` as 'audit.actions.create') : a.action,
        module: t.has(`audit.modules.${a.entityType}`) ? t(`audit.modules.${a.entityType}` as 'audit.modules.job_run') : (a.entityType || t('system')),
        severity: auditSeverity(a.action),
        timestamp: a.createdAt ? new Date(a.createdAt).toLocaleString(dateLocale) : t('recently'),
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
      initialQueuedSms={initialQueuedSms}
    />
  );
}
