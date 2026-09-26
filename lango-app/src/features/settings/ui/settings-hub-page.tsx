import type { AuditItem } from './settings-hub-client';
// settings-hub-page.tsx
// SERVER COMPONENT — pre-fetches settings hub data (tenant-scoped), per-module
// configuration status, and the recent audit feed server-side.
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { hasAddon } from '@/libs/api/entitlements';
import { SETTINGS_MODULES } from '@/features/settings/data/settings-hub-config';
import { computeSettingsModuleStatus } from '@/features/settings/services/settings-hub-status';
import { getServerUserContext } from '@/libs/auth/server-context';
import { getCurrentSessionYear } from '@/libs/services/school-year';
import { casablancaTodayIso } from '@/libs/finance/today';
import { db } from '@/libs/DB';
import {
  addonEntitlements,
  auditLogs,
  branches,
  chartOfAccounts,
  cndpFilings,
  files,
  namingSeries,
  schoolSettings,
  settingValues,
  tenants,
  user,
} from '@/models/Schema';
import { SettingsHubClient } from './settings-hub-client';

const STAFF_ROLES = ['school_admin', 'teacher', 'accountant', 'receptionist', 'guard'] as const;
const CNDP_DONE_STATUSES = ['submitted', 'approved'] as const;

// "Modifications récentes" is a settings feed: only audit rows written by the
// settings surfaces, never a payment or an attendance mark (SCF-09-01). The
// list is the entityType of every recordAudit call under app/api/settings.
const SETTINGS_ENTITY_TYPES = [
  'school_settings',
  'settings',
  'setting',
  'setting_rollback',
  'setting_numbering',
  'setting_custom_field',
  'setting_job',
  'branch',
  'integration',
  'addon_entitlement',
  'role_permission',
  'invitation',
  'tenant_domain',
  'tenant_logo',
  'tenant_favicon',
  'cndp_filing',
  'migration_state',
  'migration_validation',
  'migration_task',
  'access_reset_request',
  'job_run',
] as const;

function relativeTime(iso: string | null, locale = 'fr'): string {
  if (!iso) {
    return '';
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const diffSec = Math.floor((Date.now() - then) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR', { numeric: 'auto' });
    if (diffMin < 1) {
      return rtf.format(0, 'second');
    }
    if (diffHours < 1) {
      return rtf.format(-diffMin, 'minute');
    }
    if (diffDays < 1) {
      return rtf.format(-diffHours, 'hour');
    }
    if (diffDays < 30) {
      return rtf.format(-diffDays, 'day');
    }
  } catch {
    // fallback
  }
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0]?.[0] ?? '?';
  const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
  return (first + second).toUpperCase() || '?';
}

export async function SettingsHubPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) {
    throw new Error('Tenant context required for settings hub');
  }

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
      .where(and(
        tenantId ? eq(auditLogs.tenantId, tenantId) : undefined,
        inArray(auditLogs.entityType, [...SETTINGS_ENTITY_TYPES]),
      ))
      .orderBy(desc(auditLogs.createdAt))
      .limit(5);

    initialAudits = auditRows.map((r) => {
      const actorName = r.actorName ?? (r.actorId ? `User (${r.actorId.slice(0, 6)})` : 'System');
      return {
        id: r.id,
        userName: actorName,
        userInitials: r.actorId ? initialsOf(actorName) : 'SYS',
        action: r.action,
        timestamp: relativeTime(r.createdAt, locale) || new Date(r.createdAt).toLocaleString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR'),
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

    const [branchCount, settingRows, schoolRow, tenantRow, numberingRow, currentYear] = await Promise.all([
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
      db.select({ value: count() }).from(namingSeries).where(tenantId ? eq(namingSeries.tenantId, tenantId) : undefined),
      getCurrentSessionYear(tenantId),
    ]);

    const hasKey = (k: string) => settingRows.some(s => s.key === k);
    const hasAnyKey = (...keys: string[]) => keys.some(hasKey);

    pcgDone = chartRow.length > 0 || hasKey('accounting.defaults');
    cndpDone = cndpRow.length > 0;

    modulesStatus = computeSettingsModuleStatus({
      organisation: {
        name: tenantRow[0]?.name ?? null,
        ice: schoolRow[0]?.ice ?? null,
        address: schoolRow[0]?.address ?? null,
      },
      currentYear: currentYear ? { startDate: currentYear.startDate, endDate: currentYear.endDate } : null,
      today: casablancaTodayIso(),
      staffCount: staffRow.length,
      securityTwoFactorSet: hasKey('security.requireTwoFactorForAdmins'),
      providersKeySet: hasKey('integrations.providers'),
      accountingDone: pcgDone,
      migrationDone: fileRow.length > 0 || hasKey('migration.state'),
      policiesKeysSet: hasAnyKey(
        'academic.autoPromotion',
        'academic.passThreshold',
        'academic.gradingScale',
        'portal.guardianEnabled',
        'portal.studentEnabled',
      ),
      // The attendance page owns the attendance keys (SCF-04-01).
      attendanceKeySet: hasAnyKey(
        'attendance.lateGraceMinutes',
        'attendance.periodStartTime',
        'attendance.consecutiveAbsenceThreshold',
        'attendance.repeatedLateThreshold',
        'attendance.smsAlerts',
        'attendance.presenceModes',
      ),
      entitlementsCount: addonRow.length,
      numberingSeriesCount: numberingRow[0]?.value ?? 0,
      branchCount: branchCount[0]?.value ?? 0,
      multiBranchAddon: Boolean(tenantId) && await hasAddon(tenantId!, 'multi-branch'),
      cndpDone,
    });

    tenantName = tenantRow[0]?.name ?? '';
    city = schoolRow[0]?.city ?? '';
    ice = schoolRow[0]?.ice ?? '';
  } catch (err) {
    console.error('Failed to pre-fetch settings hub data:', err);
    throw err;
  }

  const totalModules = SETTINGS_MODULES.length;
  const configuredCount = SETTINGS_MODULES.filter(m => modulesStatus[m.id]).length;
  const conformityPercent = Math.round(((cndpDone ? 1 : 0) + (pcgDone ? 1 : 0)) / 2 * 100);
  const conformityCode = cndpDone && pcgDone
    ? 'both'
    : cndpDone
      ? 'cndp_only'
      : pcgDone
        ? 'pcg_only'
        : 'none';

  return (
    <SettingsHubClient
      initialAudits={initialAudits}
      initialTenant={{ name: tenantName, city, ice }}
      initialModulesStatus={modulesStatus}
      configuredCount={configuredCount}
      totalModules={totalModules}
      conformityPercent={conformityPercent}
      conformityCode={conformityCode}
      lastModification={lastModification}
      locale={locale || 'fr'}
    />
  );
}
