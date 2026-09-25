import type { AuditEvent, UserItem } from './users-roles-client';
import type { PermissionKey } from '@/libs/api/permissions';
// users-roles-page.tsx
// SERVER COMPONENT — pre-fetches users, permissions matrix, and audit logs server-side.
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '@/libs/api/permissions';
import { getServerUserContext } from '@/libs/auth/server-context';
import { db } from '@/libs/DB';
import { auditLogs, branches, rolePermissions, tenants, twoFactor, user } from '@/models/Schema';
import { UsersRolesClient } from './users-roles-client';

export async function UsersRolesPage({ locale }: { locale?: string } = {}) {
  const ctx = await getServerUserContext();
  const tenantId = ctx?.tenantId ?? null;
  if (!tenantId) {
    throw new Error('Tenant context required for users and roles');
  }

  let initialUsers: UserItem[] = [];
  let initialTotal = 0;
  let tenantName = '';
  let branchOptions: { id: string; name: string }[] = [];
  const initialMatrix: Record<string, Record<string, boolean>> = {};
  let initialAuditEvents: AuditEvent[] = [];

  try {
    // 1. Fetch Users (staff & admins, excluding student accounts) — tenant-scoped,
    //    with real 2FA enrollment from the better-auth two_factor table.
    const userWhere = and(
      eq(user.tenantId, tenantId),
      ctx?.branchId ? eq(user.branchId, ctx.branchId) : undefined,
      ne(user.role, 'student'),
      ne(user.role, 'super_admin'),
    );
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
      .where(userWhere)
      .orderBy(desc(user.createdAt), user.id)
      .limit(50);
    const [totalRow] = await db.select({ total: count() }).from(user).where(userWhere);
    initialTotal = totalRow?.total ?? 0;

    // Branch / campus names for the access-scope column.
    const branchRows = await db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), ctx?.branchId ? eq(branches.id, ctx.branchId) : undefined));
    const branchMap = new Map(branchRows.map(b => [b.id, b.name]));
    branchOptions = branchRows;

    const [tenant] = await db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    const schoolName = tenant?.name ?? '';
    tenantName = schoolName;
    const dateLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';

    initialUsers = userRows.map((u) => {
      const uiRole = u.role;
      const branchName = u.branchId ? branchMap.get(u.branchId) ?? null : null;

      // Scope ids are translated by the client (UsersRoles.scopes.*); a campus
      // name is shown as is.
      let scope = branchName ?? 'school';
      if (uiRole === 'super_admin' || uiRole === 'school_admin' || uiRole === 'accountant') {
        scope = 'all_classes';
      } else if (uiRole === 'teacher') {
        scope = 'assigned_classes';
      }

      return {
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
        branchId: u.branchId,
        status: u.status,
        lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString(dateLocale) : null,
        tfa: Boolean(u.tfaVerified),
        schoolName: branchName ?? schoolName,
        accessScope: scope,
      };
    });

    // 2. Fetch Role Permissions Matrix (tenant overrides only).
    const overrides = await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.tenantId, tenantId));
    const allPerms = Object.keys(PERMISSIONS) as PermissionKey[];

    for (const [roleKey, defaults] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      if (roleKey === 'super_admin') {
        continue;
      }
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
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    initialAuditEvents = auditRows.map(a => ({
      id: a.id,
      actorName: a.actorName ?? '',
      action: a.action,
      entityType: a.entityType,
      timestamp: a.createdAt ? new Date(a.createdAt).toLocaleDateString(dateLocale, { hour: '2-digit', minute: '2-digit' }) : '',
    }));
  } catch (err) {
    console.error('Failed to pre-fetch users-roles page data server-side:', err);
    throw err;
  }

  return (
    <UsersRolesClient
      initialUsers={initialUsers}
      initialTotal={initialTotal}
      tenantName={tenantName}
      branches={branchOptions}
      currentUserId={ctx?.userId ?? ''}
      branchRestricted={Boolean(ctx?.branchId)}
      initialMatrix={initialMatrix}
      initialAuditEvents={initialAuditEvents}
    />
  );
}
