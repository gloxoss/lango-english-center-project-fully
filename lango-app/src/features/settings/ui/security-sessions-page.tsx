// security-sessions-page.tsx
// SERVER COMPONENT — pre-fetches real tenant-scoped sessions, 2FA adoption by role,
// trusted devices, derived security alerts, audit log, and security policy settings.
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getServerUserContext } from '@/libs/auth/server-context';
import { getEffectiveValue } from '@/libs/settings/registry';
import {
  accessResetRequests, auditLogs, session, twoFactor, user,
} from '@/models/Schema';
import {
  SecuritySessionsClient, SessionItem, AuditItem, TrustedDeviceItem,
  SecurityAlertItem, Role2faItem,
} from './security-sessions-client';

const STAFF_ROLES = ['school_admin', 'accountant', 'teacher', 'receptionist'] as const;

const ROLE_META: Record<string, { label: string; badge: string }> = {
  school_admin: { label: 'Directeur & Administration', badge: 'bg-[#F0F4FF] text-[#4B6BFB]' },
  accountant: { label: 'Comptabilité & Finance', badge: 'bg-amber-50 text-amber-700' },
  teacher: { label: 'Corps Enseignant', badge: 'bg-blue-50 text-blue-700' },
  receptionist: { label: 'Réception & Accueil', badge: 'bg-emerald-50 text-emerald-700' },
};

function describeDevice(userAgent: string | null): { device: string; os: string; type: 'desktop' | 'mobile' } {
  if (!userAgent) return { device: 'Appareil inconnu', os: '—', type: 'desktop' };
  const ua = userAgent.toLowerCase();
  const type: 'desktop' | 'mobile' = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /edg\//.test(ua) ? 'Edge' : /opr\//.test(ua) ? 'Opera' : /firefox/.test(ua) ? 'Firefox' : /safari/.test(ua) ? 'Safari' : /chrome/.test(ua) ? 'Chrome' : 'Navigateur';
  const os = /windows/.test(ua) ? 'Windows' : /mac os|macintosh/.test(ua) ? 'macOS' : /android/.test(ua) ? 'Android' : /iphone|ipad/.test(ua) ? 'iOS' : /linux/.test(ua) ? 'Linux' : '—';
  return { device: `${browser} sur ${os}`, os, type };
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return 'En ce moment';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hier';
  return `Il y a ${days} jours`;
}

export async function SecuritySessionsPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialSessions: SessionItem[] = [];
  let initialAudits: AuditItem[] = [];
  let initialTrustedDevices: TrustedDeviceItem[] = [];
  let initialAlerts: SecurityAlertItem[] = [];
  let initial2faAdoption: Role2faItem[] = [];
  let initialDismissedAlertIds: string[] = [];
  let globalTfaPercentage = 0;

  const initialSettings = {
    twoFaRequired: false,
    requireAdmin2fa: false,
    passwordPolicy: 'strict' as string,
    sessionTimeout: '60',
    ipRestriction: false,
    allowedIps: '196.202.12.0/24',
    loginAlerts: true,
  };

  try {
    if (tenantId && ctx) {
      // Policy settings from the registry.
      const [polEff, timeoutEff, dismissedEff, admin2faEff] = await Promise.all([
        getEffectiveValue(tenantId, ctx.branchId, 'security.policies'),
        getEffectiveValue(tenantId, ctx.branchId, 'security.sessionTimeoutMinutes'),
        getEffectiveValue(tenantId, ctx.branchId, 'security.dismissedAlerts'),
        getEffectiveValue(tenantId, ctx.branchId, 'security.requireTwoFactorForAdmins'),
      ]);
      const policies = (polEff.value ?? {}) as Record<string, boolean>;
      initialSettings.twoFaRequired = Boolean(policies.twoFa ?? false);
      initialSettings.requireAdmin2fa = Boolean(admin2faEff.value ?? false);
      initialSettings.passwordPolicy = policies.strongPassword ? 'strict' : 'standard';
      initialSettings.sessionTimeout = String(timeoutEff.value ?? 60);
      initialSettings.loginAlerts = Boolean(policies.auditLog ?? true);
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

      initialSessions = sessionRows.map(r => {
        const { device, type } = describeDevice(r.userAgent);
        return {
          id: r.id,
          userName: r.userName ?? r.userId,
          userRole: r.userRole,
          device,
          type,
          ip: r.ipAddress ?? '—',
          location: '—',
          lastActive: relativeTime(r.updatedAt ? r.updatedAt.toISOString() : null),
          isCurrent: r.id === ctx.sessionId,
        };
      });

      // Trusted devices = distinct devices with an active session.
      const latestByDevice = new Map<string, (typeof sessionRows)[number]>();
      for (const r of sessionRows) {
        const key = `${r.userId}|${r.userAgent ?? 'unknown'}`;
        if (!latestByDevice.has(key)) latestByDevice.set(key, r);
      }
      initialTrustedDevices = [...latestByDevice.values()].slice(0, 6).map(r => {
        const { device, os } = describeDevice(r.userAgent);
        return {
          id: `dev-${r.id}`,
          name: device,
          owner: r.userName ?? r.userId,
          os,
          location: '—',
          verifiedAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—',
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
        if (seen.has(u.id)) continue;
        seen.add(u.id);
        const entry = byRole.get(u.role) ?? { total: 0, tfa: 0 };
        entry.total += 1;
        if (u.tfaVerified) entry.tfa += 1;
        byRole.set(u.role, entry);
      }
      let totalTfa = 0;
      let totalStaff = 0;
      initial2faAdoption = STAFF_ROLES.map(roleKey => {
        const stats = byRole.get(roleKey) ?? { total: 0, tfa: 0 };
        totalTfa += stats.tfa;
        totalStaff += stats.total;
        return {
          roleKey,
          roleLabel: ROLE_META[roleKey]?.label ?? roleKey,
          totalCount: stats.total,
          tfaCount: stats.tfa,
          percentage: stats.total > 0 ? Math.round((stats.tfa / stats.total) * 100) : 0,
          badgeColor: ROLE_META[roleKey]?.badge ?? 'bg-[#F3F4F6] text-[#374151]',
        };
      });
      globalTfaPercentage = totalStaff > 0 ? Math.round((totalTfa / totalStaff) * 100) : 0;

      // Security alerts derived from real signals (dismissed ones are filtered out).
      const [aggRows, resetRows] = await Promise.all([
        db
          .select({
            failedTotal: sql<number>`coalesce(sum(${user.failedLoginCount}), 0)::int`,
            lockedCount: sql<number>`count(*) filter (where ${user.lockedUntil} is not null)::int`,
          })
          .from(user)
          .where(eq(user.tenantId, tenantId)),
        db
          .select({ id: accessResetRequests.id })
          .from(accessResetRequests)
          .where(eq(accessResetRequests.tenantId, tenantId))
          .limit(1),
      ]);
      const failedTotal = aggRows[0]?.failedTotal ?? 0;
      const lockedCount = aggRows[0]?.lockedCount ?? 0;
      const resetCount = resetRows.length;

      const dismissed = new Set(initialDismissedAlertIds);
      if (!dismissed.has('alert-locked') && lockedCount > 0) {
        initialAlerts.push({
          id: 'alert-locked',
          severity: 'critical',
          title: 'Comptes temporairement verrouillés',
          description: `${lockedCount} compte(s) verrouillé(s) après des tentatives de connexion échouées.`,
          timestamp: 'Actif',
          actionLabel: 'Réinitialiser les accès',
          actionHref: '/dashboard/settings/access-reset',
        });
      }
      if (!dismissed.has('alert-failed-logins') && failedTotal > 0) {
        initialAlerts.push({
          id: 'alert-failed-logins',
          severity: 'warning',
          title: 'Connexions échouées enregistrées',
          description: `${failedTotal} tentative(s) de connexion échouée(s) sur les comptes de l'établissement.`,
          timestamp: 'Actif',
          actionLabel: 'Voir les utilisateurs',
          actionHref: '/dashboard/settings/users',
        });
      }
      if (!dismissed.has('alert-resets') && resetCount > 0) {
        initialAlerts.push({
          id: 'alert-resets',
          severity: 'warning',
          title: "Réinitialisations d'accès récentes",
          description: `${resetCount} demande(s) de réinitialisation d'accès enregistrée(s).`,
          timestamp: 'Actif',
          actionLabel: 'Voir les réinitialisations',
          actionHref: '/dashboard/settings/access-reset',
        });
      }

      // Recent security audit trail (tenant-scoped).
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
    console.error('Failed to pre-fetch security page data server-side:', err);
  }

  return (
    <SecuritySessionsClient
      initialSessions={initialSessions}
      initialAudits={initialAudits}
      initialSettings={initialSettings}
      initialTrustedDevices={initialTrustedDevices}
      initialAlerts={initialAlerts}
      initial2faAdoption={initial2faAdoption}
      initialDismissedAlertIds={initialDismissedAlertIds}
      globalTfaPercentage={globalTfaPercentage}
    />
  );
}
