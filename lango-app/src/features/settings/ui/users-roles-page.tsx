// users-roles-page.tsx
// SERVER COMPONENT — pre-fetches users, permissions matrix, and audit logs server-side.
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { getServerUserContext } from '@/libs/auth/server-context';
import { auditLogs, branches, rolePermissions, tenants, twoFactor, user } from '@/models/Schema';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type PermissionKey } from '@/libs/api/permissions';
import { toUiStatus } from '@/models/userMapping';
import { UsersRolesClient, UserItem, AuditEvent } from './users-roles-client';

export async function UsersRolesPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;

  let initialUsers: UserItem[] = [];
  let initialMatrix: Record<string, Record<string, boolean>> = {};
  let initialAuditEvents: AuditEvent[] = [];

  try {
    // 1. Fetch Users (staff & admins, excluding student accounts) — tenant-scoped,
    //    with real 2FA enrollment from the better-auth two_factor table.
    const userRows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.userStatus,
        lastLogin: user.lastLogin,
        branchId: user.branchId,
        tfaVerified: twoFactor.verified,
      })
      .from(user)
      .leftJoin(twoFactor, eq(user.id, twoFactor.userId))
      .where(and(
        tenantId ? eq(user.tenantId, tenantId) : undefined,
        ne(user.role, 'student'),
      ))
      .limit(50);

    // Branch / campus names for the access-scope column.
    const branchRows = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(tenantId ? eq(branches.tenantId, tenantId) : undefined);
    const branchMap = new Map(branchRows.map(b => [b.id, b.name]));

    const [tenant] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(tenantId ? eq(tenants.id, tenantId) : undefined)
      .limit(1);
    const schoolName = tenant?.name || 'Établissement';

    initialUsers = userRows.map(u => {
      const uiRole = u.role;
      const branchName = u.branchId ? branchMap.get(u.branchId) ?? null : null;

      let scope = branchName ?? 'Établissement';
      if (uiRole === 'super_admin' || uiRole === 'school_admin' || uiRole === 'accountant') {
        scope = 'Toutes les classes';
      } else if (uiRole === 'teacher') {
        scope = 'Classes assignées';
      }

      return {
        id: u.id,
        name: u.name || 'Utilisateur',
        email: u.email,
        role: u.role,
        status: toUiStatus(u.status),
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR') : null,
        tfa: Boolean(u.tfaVerified),
        schoolName: branchName ?? schoolName,
        accessScope: scope,
      };
    });

    // 2. Fetch Role Permissions Matrix (tenant overrides only).
    const overrides = await db
      .select()
      .from(rolePermissions)
      .where(tenantId ? eq(rolePermissions.tenantId, tenantId) : undefined);
    const allPerms = Object.keys(PERMISSIONS) as PermissionKey[];

    for (const [roleKey, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (roleKey === 'super_admin') continue;
      initialMatrix[roleKey] = {};
      for (const perm of allPerms) {
        const override = overrides.find(o => o.roleId === roleKey && o.permissionId === perm);
        initialMatrix[roleKey]![perm] = override ? override.granted : defaults.includes(perm as PermissionKey);
      }
    }

    // 3. Fetch Recent Audit Logs (tenant-scoped, real actor names).
    const auditRows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
        actorName: user.name,
      })
      .from(auditLogs)
      .leftJoin(user, eq(auditLogs.actorId, user.id))
      .where(tenantId ? eq(auditLogs.tenantId, tenantId) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    initialAuditEvents = auditRows.map(a => ({
      id: a.id,
      actorName: a.actorName ?? 'Système',
      action: a.action,
      entityType: a.entityType,
      timestamp: a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Récemment',
    }));

  } catch (err) {
    console.error('Failed to pre-fetch users-roles page data server-side:', err);
  }

  return (
    <UsersRolesClient
      initialUsers={initialUsers}
      initialMatrix={initialMatrix}
      initialAuditEvents={initialAuditEvents}
    />
  );
}
