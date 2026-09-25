import type { AuditItem, Role2faItem, SecurityAlertItem, SessionItem, TrustedDeviceItem } from './security-sessions-client';
// security-sessions-page.tsx
// SERVER COMPONENT: pre-fetches real tenant-scoped sessions, 2FA adoption by role,
// active devices, derived security alerts and the audit log. It passes raw data
// only; every label is translated in the client (SecuritySessions namespace).
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { getServerUserContext } from '@/libs/auth/server-context';
import { db } from '@/libs/DB';
import { getEffectiveValue } from '@/libs/settings/registry';
import {
  accessResetRequests,
  auditLogs,
  session,
  twoFactor,
  user,
} from '@/models/Schema';
import {
  SecuritySessionsClient,
} from './security-sessions-client';

const STAFF_ROLES = ['school_admin', 'accountant', 'teacher', 'receptionist'] as const;

const ROLE_BADGE: Record<string, string> = {
  school_admin: 'bg-[#F0F4FF] text-[#4B6BFB]',
  accountant: 'bg-amber-50 text-amber-700',
  teacher: 'bg-blue-50 text-blue-700',
  receptionist: 'bg-emerald-50 text-emerald-700',
};

// Browser and OS names are product names, so they stay untranslated; null means unknown.
function describeDevice(userAgent: string | null): { browser: string | null; os: string | null; type: 'desktop' | 'mobile' } {
  if (!userAgent) {
    return { browser: null, os: null, type: 'desktop' };
  }
  const ua = userAgent.toLowerCase();
  const type: 'desktop' | 'mobile' = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /edg\//.test(ua) ? 'Edge' : /opr\//.test(ua) ? 'Opera' : /firefox/.test(ua) ? 'Firefox' : /safari/.test(ua) && !/chrome/.test(ua) ? 'Safari' : /chrome/.test(ua) ? 'Chrome' : null;
  const os = /windows/.test(ua) ? 'Windows' : /mac os|macintosh/.test(ua) ? 'macOS' : /android/.test(ua) ? 'Android' : /iphone|ipad/.test(ua) ? 'iOS' : /linux/.test(ua) ? 'Linux' : null;
  return { browser, os, type };
}

export async function SecuritySessionsPage(_props: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialSessions: SessionItem[] = [];
  let initialAudits: AuditItem[] = [];
  let initialTrustedDevices: TrustedDeviceItem[] = [];
  const initialAlerts: SecurityAlertItem[] = [];
  let initial2faAdoption: Role2faItem[] = [];
  let initialDismissedAlertIds: string[] = [];
  let globalTfaPercentage = 0;
  let requireAdmin2fa = false;
  let loadFailed = false;

  try {
    if (tenantId && ctx) {
      const [dismissedEff, admin2faEff] = await Promise.all([
        getEffectiveValue(tenantId, ctx.branchId, 'security.dismissedAlerts'),
        getEffectiveValue(tenantId, ctx.branchId, 'security.requireTwoFactorForAdmins'),
      ]);
      requireAdmin2fa = Boolean(admin2faEff.value ?? false);
      initialDismissedAlertIds = Array.isArray(dismissedEff.value)
        ? (dismissedEff.value as string[])
        : [];

      // Active sessions (tenant-scoped, not expired).
      const sessionRows = await db
        .select({
          id: session.id,
          userId: session.userId,
          userAgent: session.userAgent,
          ipAddress: session.ipAddress,
          updatedAt: session.updatedAt,
          createdAt: session.createdAt,
          userName: user.name,
          userRole: user.role,
        })
        .from(session)
        .innerJoin(user, eq(session.userId, user.id))
        .where(and(eq(user.tenantId, tenantId), gt(session.expiresAt, new Date())))
        .orderBy(desc(session.updatedAt))
        .limit(20);

      initialSessions = sessionRows.map((r) => {
        const { browser, os, type } = describeDevice(r.userAgent);
        return {
          id: r.id,
          userName: r.userName ?? r.userId,
          userRole: r.userRole,
          browser,
          os,
          type,
          ip: r.ipAddress ?? '—',
          lastActiveAt: r.updatedAt ? r.updatedAt.toISOString() : null,
          isCurrent: r.id === ctx.sessionId,
        };
      });

      // Active devices = distinct user+device pairs with an active session.
      const latestByDevice = new Map<string, (typeof sessionRows)[number]>();
      for (const r of sessionRows) {
        const key = `${r.userId}|${r.userAgent ?? 'unknown'}`;
        if (!latestByDevice.has(key)) {
          latestByDevice.set(key, r);
        }
      }
      initialTrustedDevices = [...latestByDevice.values()].slice(0, 6).map((r) => {
        const { browser, os } = describeDevice(r.userAgent);
        return {
          id: `dev-${r.id}`,
          browser,
          os,
          owner: r.userName ?? r.userId,
          firstSeenAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
          isCurrent: r.id === ctx.sessionId,
        };
      });

      // 2FA adoption by role (real twoFactor rows).
      const staffUsers = await db
        .select({
          id: user.id,
          role: user.role,
          tfaVerified: twoFactor.verified,
        })
        .from(user)
        .leftJoin(twoFactor, eq(twoFactor.userId, user.id))
        .where(and(eq(user.tenantId, tenantId), inArray(user.role, STAFF_ROLES)));

      const seen = new Set<string>();
      const byRole = new Map<string, { total: number; tfa: number }>();
      for (const u of staffUsers) {
        if (seen.has(u.id)) {
          continue;
        }
        seen.add(u.id);
        const entry = byRole.get(u.role) ?? { total: 0, tfa: 0 };
        entry.total += 1;
        if (u.tfaVerified) {
          entry.tfa += 1;
        }
        byRole.set(u.role, entry);
      }
      let totalTfa = 0;
      let totalStaff = 0;
      initial2faAdoption = STAFF_ROLES.map((roleKey) => {
        const stats = byRole.get(roleKey) ?? { total: 0, tfa: 0 };
        totalTfa += stats.tfa;
        totalStaff += stats.total;
        return {
          roleKey,
          totalCount: stats.total,
          tfaCount: stats.tfa,
          percentage: stats.total > 0 ? Math.round((stats.tfa / stats.total) * 100) : 0,
          badgeColor: ROLE_BADGE[roleKey] ?? 'bg-[#F3F4F6] text-[#374151]',
        };
      });
      globalTfaPercentage = totalStaff > 0 ? Math.round((totalTfa / totalStaff) * 100) : 0;

      // Security alerts derived from real signals (dismissed ones are filtered out).
      const [aggRows, [resetAgg]] = await Promise.all([
        db
          .select({
            failedTotal: sql<number>`coalesce(sum(${user.failedLoginCount}), 0)::int`,
            lockedCount: sql<number>`count(*) filter (where ${user.lockedUntil} > now())::int`,
          })
          .from(user)
          .where(eq(user.tenantId, tenantId)),
        // Was `.limit(1)` + rows.length, so the alert always said "1 request".
        db
          .select({ value: sql<number>`count(*)::int` })
          .from(accessResetRequests)
          .where(eq(accessResetRequests.tenantId, tenantId)),
      ]);
      const failedTotal = aggRows[0]?.failedTotal ?? 0;
      const lockedCount = aggRows[0]?.lockedCount ?? 0;
      const resetCount = resetAgg?.value ?? 0;

      const dismissed = new Set(initialDismissedAlertIds);
      if (!dismissed.has('alert-locked') && lockedCount > 0) {
        initialAlerts.push({ id: 'alert-locked', kind: 'locked', severity: 'critical', count: lockedCount, actionHref: '/dashboard/settings/access-reset' });
      }
      if (!dismissed.has('alert-failed-logins') && failedTotal > 0) {
        initialAlerts.push({ id: 'alert-failed-logins', kind: 'failedLogins', severity: 'warning', count: failedTotal, actionHref: '/dashboard/settings/users' });
      }
      if (!dismissed.has('alert-resets') && resetCount > 0) {
        initialAlerts.push({ id: 'alert-resets', kind: 'resets', severity: 'warning', count: resetCount, actionHref: '/dashboard/settings/access-reset' });
      }

      // Recent audit trail (tenant-scoped).
      const auditRows = await db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          actorId: auditLogs.actorId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .where(eq(auditLogs.tenantId, tenantId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(10);

      initialAudits = auditRows.map(a => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        actorId: a.actorId,
        createdAt: a.createdAt,
      }));
    }
  } catch (err) {
    // Used to be swallowed, so a DB failure looked like "0 sessions, 0 alerts".
    loadFailed = true;
    console.error('Failed to pre-fetch security page data server-side:', err);
  }

  return (
    <SecuritySessionsClient
      initialSessions={initialSessions}
      initialAudits={initialAudits}
      initialRequireAdmin2fa={requireAdmin2fa}
      initialTrustedDevices={initialTrustedDevices}
      initialAlerts={initialAlerts}
      initial2faAdoption={initial2faAdoption}
      initialDismissedAlertIds={initialDismissedAlertIds}
      globalTfaPercentage={globalTfaPercentage}
      loadFailed={loadFailed}
    />
  );
}
