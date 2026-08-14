// settings-hub-page.tsx
// SERVER COMPONENT — pre-fetches settings hub data (tenant-scoped), per-module
// configuration status, and the recent audit feed server-side.
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getServerUserContext } from '@/libs/auth/server-context';
import {
  addonEntitlements, auditLogs, branches, cndpFilings, chartOfAccounts,
  files, schoolSettings, settingValues, tenants, user,
} from '@/models/Schema';
import { SETTINGS_MODULES } from '@/features/settings/data/settings-hub-config';
import { SettingsHubClient, type AuditItem } from './settings-hub-client';

const STAFF_ROLES = ['school_admin', 'teacher', 'accountant', 'receptionist', 'guard'] as const;
const CNDP_DONE_STATUSES = ['submitted', 'approved'] as const;

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 30) return `Il y a ${days} jours`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
  return (first + second).toUpperCase() || '?';
}

export async function SettingsHubPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  // Real data. Empty DB / no data renders an empty state — never fabricated values.
  let initialAudits: AuditItem[] = [];
  let lastModification: AuditItem | null = null;
  let tenantName = '';
  let city = '';
  let ice = '';
  let modulesStatus: Record<string, boolean> = {};
  let cndpDone = false;
  let pcgDone = false;

  try {
    const auditRows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorId: auditLogs.actorId,
        createdAt: auditLogs.createdAt,
        actorName: user.name,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(tenantId ? eq(auditLogs.tenantId, tenantId) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(5);

    initialAudits = auditRows.map(r => {
      const actorName = r.actorName ?? (r.actorId ? `Utilisateur (${r.actorId.slice(0, 6)})` : 'Système');
      return {
        id: r.id,
        userName: actorName,
        userInitials: r.actorId ? initialsOf(actorName) : 'SYS',
        action: r.action,
        timestamp: relativeTime(r.createdAt) || new Date(r.createdAt).toLocaleString('fr-FR'),
      };
    });
    lastModification = initialAudits[0] ?? null;

    const [staffRow, chartRow, cndpRow, addonRow, fileRow] = await Promise.all([
      db
        .select({ id: user.id })
        .from(user)
        .where(and(
          tenantId ? eq(user.tenantId, tenantId) : undefined,
          inArray(user.role, STAFF_ROLES),
        ))
        .limit(1),
      db
        .select({ id: chartOfAccounts.id })
        .from(chartOfAccounts)
        .where(tenantId ? eq(chartOfAccounts.tenantId, tenantId) : undefined)
        .limit(1),
      db
        .select({ id: cndpFilings.id })
        .from(cndpFilings)
        .where(and(
          tenantId ? eq(cndpFilings.tenantId, tenantId) : undefined,
          inArray(cndpFilings.status, CNDP_DONE_STATUSES),
        ))
        .limit(1),
      db
        .select({ id: addonEntitlements.id })
        .from(addonEntitlements)
        .where(tenantId ? eq(addonEntitlements.tenantId, tenantId) : undefined)
        .limit(1),
      db
        .select({ id: files.id })
        .from(files)
        .where(and(
          tenantId ? eq(files.tenantId, tenantId) : undefined,
          eq(files.isDeleted, false),
        ))
        .limit(1),
    ]);

    const [branchCount, settingRows, schoolRow, tenantRow] = await Promise.all([
      db
        .select({ value: count() })
        .from(branches)
        .where(tenantId ? eq(branches.tenantId, tenantId) : undefined),
      db
        .select({ key: settingValues.key })
        .from(settingValues)
        .where(tenantId ? eq(settingValues.tenantId, tenantId) : undefined),
      tenantId
        ? db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId)).limit(1)
        : db.select().from(schoolSettings).limit(1),
      tenantId
        ? db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
        : db.select().from(tenants).limit(1),
    ]);

    const hasKey = (k: string) => settingRows.some(s => s.key === k);
    const hasAnyKey = (...keys: string[]) => keys.some(hasKey);

    pcgDone = chartRow.length > 0 || hasKey('accounting.defaults');
    cndpDone = cndpRow.length > 0;

    modulesStatus = {
      onboarding: Boolean(schoolRow[0]?.establishmentName),
      users: staffRow.length > 0,
      security: hasAnyKey('security.policies', 'security.sessionTimeoutMinutes', 'security.dismissedAlerts'),
      providers: hasKey('integrations.providers'),
      'accounting-defaults': pcgDone,
      translations: hasKey('i18n.translations'),
      jobs: hasKey('jobs.definitions'),
      migration: fileRow.length > 0 || hasKey('migration.state'),
      policies: hasAnyKey(
        'academic.autoPromotion', 'academic.passThreshold', 'academic.gradingScale',
        'portal.guardianEnabled', 'portal.studentEnabled',
        'attendance.presenceModes', 'attendance.smsAlerts', 'attendance.lateGraceMinutes', 'attendance.periodStartTime',
      ),
      entitlements: addonRow.length > 0,
      branches: (branchCount[0]?.value ?? 0) > 1,
      cndp: cndpDone,
    };

    tenantName = tenantRow[0]?.name ?? '';
    city = schoolRow[0]?.city ?? '';
    ice = schoolRow[0]?.ice ?? '';
  } catch (err) {
    console.error('Failed to pre-fetch settings hub data:', err);
  }

  const totalModules = SETTINGS_MODULES.length;
  const configuredCount = SETTINGS_MODULES.filter(m => modulesStatus[m.id]).length;
  const conformityPercent = Math.round(((cndpDone ? 1 : 0) + (pcgDone ? 1 : 0)) / 2 * 100);
  const conformityLabel = cndpDone && pcgDone
    ? 'PCG 2026 & CNDP conformes'
    : cndpDone
      ? 'CNDP déposé · PCG non configuré'
      : pcgDone
        ? 'PCG 2026 configuré · CNDP non déposé'
        : 'PCG 2026 & CNDP non configurés';

  return (
    <SettingsHubClient
      initialAudits={initialAudits}
      initialTenant={{ name: tenantName, city, ice }}
      initialModulesStatus={modulesStatus}
      configuredCount={configuredCount}
      totalModules={totalModules}
      conformityPercent={conformityPercent}
      conformityLabel={conformityLabel}
      lastModification={lastModification}
    />
  );
}
