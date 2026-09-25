import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let sessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: { api: { getSession: async () => sessionUserId ? { user: { id: sessionUserId } } : null } },
}));

const { db } = await import('@/libs/DB');
const { branches, rolePermissions, tenants, user } = await import('@/models/Schema');
const { GET, POST, PUT } = await import('./route');
const { GET: getPermissions } = await import('../settings/permissions/route');
const { GET: getInvitations } = await import('../settings/invitations/route');
const { POST: saveSettings } = await import('../settings/route');
const { POST: uploadLogo } = await import('../settings/logo/route');

const hasDb = Boolean(process.env.DATABASE_URL);

function update(body: Record<string, unknown>) {
  return PUT(new Request('http://localhost/api/users', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe.skipIf(!hasDb)('Settings users tenant and branch boundaries', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const otherBranchId = crypto.randomUUID();
  const adminId = `SETTING-ADMIN-${suffix}`;
  const employeeId = `SETTING-USER-${suffix}`;
  const otherId = `SETTING-OTHER-${suffix}`;
  const bulkUserIds = Array.from({ length: 52 }, (_, index) => `SETTING-BULK-${suffix}-${index}`);

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Settings Tenant', slug: `settings-${suffix}` },
      { id: otherTenantId, name: 'Other Tenant', slug: `settings-other-${suffix}` },
    ]);
    await db.insert(branches).values([
      { id: branchId, tenantId, name: 'Campus A', code: `SA${suffix}` },
      { id: otherBranchId, tenantId: otherTenantId, name: 'Campus B', code: `SB${suffix}` },
    ]);
    await db.insert(user).values([
      { id: adminId, tenantId, branchId, name: 'Admin', email: `setting-admin-${suffix}@t.local`, role: 'school_admin' },
      { id: employeeId, tenantId, branchId, name: 'Employee', email: `setting-user-${suffix}@t.local`, role: 'teacher', salary: '25000.00' },
      { id: otherId, tenantId: otherTenantId, branchId: otherBranchId, name: 'Other', email: `setting-other-${suffix}@t.local`, role: 'teacher' },
    ]);
    sessionUserId = adminId;
  });

  afterAll(async () => {
    sessionUserId = null;
    await db.delete(rolePermissions).where(eq(rolePermissions.tenantId, tenantId));
    await db.delete(user).where(inArray(user.id, bulkUserIds));
    await db.delete(user).where(eq(user.id, employeeId));
    await db.delete(user).where(eq(user.id, otherId));
    await db.delete(user).where(eq(user.id, adminId));
    await db.delete(branches).where(eq(branches.id, branchId));
    await db.delete(branches).where(eq(branches.id, otherBranchId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('updates only the submitted field, preserving role and branch', async () => {
    const response = await update({ id: employeeId, status: 'inactive' });

    expect(response.status).toBe(200);

    const [row] = await db.select({ role: user.role, branchId: user.branchId, status: user.userStatus })
      .from(user)
      .where(eq(user.id, employeeId));

    expect(row).toEqual({ role: 'teacher', branchId, status: 'inactive' });
  });

  it('does not expose or update another tenant, or assign its branch', async () => {
    const list = await GET(new Request('http://localhost/api/users'));

    expect(list.status).toBe(200);

    const listBody = await list.json();

    expect(listBody.data.some((row: { id: string }) => row.id === otherId)).toBe(false);
    expect((await update({ id: otherId, status: 'inactive' })).status).toBe(404);
    expect((await update({ id: employeeId, branchId: otherBranchId })).status).toBe(403);

    const firstPage = await (await GET(new Request('http://localhost/api/users?pageSize=1&page=1'))).json();
    const secondPage = await (await GET(new Request('http://localhost/api/users?pageSize=1&page=2'))).json();

    expect(firstPage.total).toBe(2);
    expect(firstPage.data).toHaveLength(1);
    expect(secondPage.data).toHaveLength(1);
    expect(firstPage.data[0].id).not.toBe(secondPage.data[0].id);
  });

  it('keeps salary out of user management responses and rejects salary mass assignment', async () => {
    const list = await (await GET(new Request('http://localhost/api/users'))).json();

    expect(list.data.find((row: { id: string }) => row.id === employeeId)).not.toHaveProperty('salary');

    const create = await POST(new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'New employee', email: `salary-${suffix}@t.local`, role: 'teacher', salary: 25000 }),
    }));

    expect(create.status).toBe(422);
  });

  it('prevents an administrator disabling their own account', async () => {
    expect((await update({ id: adminId, status: 'inactive' })).status).toBe(409);
    expect((await update({ id: adminId, role: 'teacher' })).status).toBe(409);
    expect((await update({ id: adminId, branchId: null })).status).toBe(409);
  });

  it('paginates a roster larger than 50 without losing users', async () => {
    await db.insert(user).values(bulkUserIds.map((id, index) => ({
      id,
      tenantId,
      branchId,
      name: `Employee ${index}`,
      email: `settings-bulk-${suffix}-${index}@t.local`,
      role: 'teacher' as const,
    })));
    const first = await (await GET(new Request('http://localhost/api/users?pageSize=50&page=1'))).json();
    const second = await (await GET(new Request('http://localhost/api/users?pageSize=50&page=2'))).json();

    expect(first.total).toBe(54);
    expect(first.data).toHaveLength(50);
    expect(second.data).toHaveLength(4);
    expect(new Set([...first.data, ...second.data].map((row: { id: string }) => row.id)).size).toBe(54);
  });

  it('keeps tenant-wide role overrides and invitation tokens away from branch admins', async () => {
    expect((await getPermissions(new Request('http://localhost/api/settings/permissions'))).status).toBe(403);
    expect((await getInvitations(new Request('http://localhost/api/settings/invitations'))).status).toBe(403);
  });

  it('denies a teacher every Settings management API', async () => {
    await db.update(user).set({ userStatus: 'active' }).where(eq(user.id, employeeId));
    sessionUserId = employeeId;
    try {
      expect((await GET(new Request('http://localhost/api/users'))).status).toBe(403);
      expect((await getPermissions(new Request('http://localhost/api/settings/permissions'))).status).toBe(403);
      expect((await saveSettings(new Request('http://localhost/api/settings', { method: 'POST', body: '{}' }))).status).toBe(403);
      expect((await uploadLogo(new Request('http://localhost/api/settings/logo', { method: 'POST' }))).status).toBe(403);
    } finally {
      sessionUserId = adminId;
    }
  });

  it('denies logo upload when the organization capability is revoked', async () => {
    await db.insert(rolePermissions).values({
      tenantId,
      roleId: 'school_admin',
      permissionId: 'settings.organization.manage',
      granted: false,
    });
    try {
      expect((await uploadLogo(new Request('http://localhost/api/settings/logo', { method: 'POST' }))).status).toBe(403);
    } finally {
      await db.delete(rolePermissions).where(eq(rolePermissions.tenantId, tenantId));
    }
  });
});
