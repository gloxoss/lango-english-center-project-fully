import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { branches, tenants, user } from '@/models/Schema';

/**
 * SCF-07-02. Deactivating a campus used to be a one-column UPDATE.
 *
 * The campus disappeared from the branch switcher while its students, classes,
 * staff and bus routes stayed attached to it, so from every screen that filters
 * by the active branch those records became invisible — with no way back,
 * because the branch could not be selected any more.
 *
 * The guard reports WHICH kind of record is in the way, not just "in use", so
 * the admin knows what to move rather than guessing.
 *
 * Every count filters tenantId as well as branchId: branch ids are unique per
 * tenant only, so an unscoped count would report another school's usage. The
 * cross-tenant test below is the one that catches that mistake.
 */

const requireRequestContext = vi.fn();
vi.mock('@/libs/api/context', () => ({
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
  requireRequestContext: (...args: unknown[]) => requireRequestContext(...args),
}));

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const busyBranchId = randomUUID();
const emptyBranchId = randomUUID();
const foreignBranchId = randomUUID();

function adminContext() {
  return {
    userId: 'usr-branch-admin',
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Directeur',
    email: 'directeur@branch.test',
    sessionId: null,
    impersonated: false,
  };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const del = (id: string) => new Request(`http://localhost:3000/api/settings/branches/${id}`, { method: 'DELETE' });
const put = (id: string, body: unknown) => new Request(`http://localhost:3000/api/settings/branches/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('Branch deactivation impact check (SCF-07-02)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Branch Guard Tenant', slug: `bg-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Branch Guard Other', slug: `bo-${otherTenantId.slice(0, 8)}` },
    ]);
    await db.insert(branches).values([
      { id: busyBranchId, tenantId, name: 'Campus Occupé', code: 'OCC', isActive: true },
      { id: emptyBranchId, tenantId, name: 'Campus Vide', code: 'VID', isActive: true },
      // Another tenant's campus, deliberately busy, so the cross-tenant test
      // proves the counts are tenant-scoped and not just branch-scoped.
      { id: foreignBranchId, tenantId: otherTenantId, name: 'Campus Étranger', code: 'ETR', isActive: true },
    ]);

    await db.insert(user).values([
      // Two active students and one active teacher on the busy campus.
      { id: `stu-${busyBranchId}-1`, tenantId, branchId: busyBranchId, email: 's1@branch.test', name: 'Élève Un', role: 'student', userStatus: 'active' },
      { id: `stu-${busyBranchId}-2`, tenantId, branchId: busyBranchId, email: 's2@branch.test', name: 'Élève Deux', role: 'student', userStatus: 'active' },
      { id: `tch-${busyBranchId}-1`, tenantId, branchId: busyBranchId, email: 'p1@branch.test', name: 'Prof Un', role: 'teacher', userStatus: 'active' },
      // Inactive: must NOT count towards the block.
      { id: `stu-${busyBranchId}-3`, tenantId, branchId: busyBranchId, email: 's3@branch.test', name: 'Élève Trois', role: 'student', userStatus: 'inactive' },
      // The other tenant's campus holds a student too.
      { id: `stu-${foreignBranchId}-1`, tenantId: otherTenantId, branchId: foreignBranchId, email: 'x1@branch.test', name: 'Élève X', role: 'student', userStatus: 'active' },
    ]);
  });

  afterAll(async () => {
    await db.delete(user).where(inArray(user.tenantId, [tenantId, otherTenantId]));
    await db.delete(branches).where(inArray(branches.tenantId, [tenantId, otherTenantId]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  it('1. refuses to deactivate a campus that still holds people, with the counts', async () => {
    requireRequestContext.mockResolvedValue(adminContext());
    const { DELETE } = await import('@/app/api/settings/branches/[id]/route');

    const res = await DELETE(del(busyBranchId), params(busyBranchId));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('BRANCH_IN_USE');
    expect(json.error.details).toMatchObject({
      activeStudents: 2,
      pinnedStaff: 1,
      // No hostels or routes on this fixture: the zeros are part of the
      // contract, a caller must be able to tell "none" from "not checked".
      activeHostels: 0,
      activeTransportRoutes: 0,
    });

    // The branch is still active: a refusal must not half-apply.
    const [row] = await db
      .select({ isActive: branches.isActive })
      .from(branches)
      .where(and(eq(branches.id, busyBranchId), eq(branches.tenantId, tenantId)))
      .limit(1);
    expect(row?.isActive).toBe(true);
  });

  it('2. deactivates a campus nothing is attached to', async () => {
    requireRequestContext.mockResolvedValue(adminContext());
    const { DELETE } = await import('@/app/api/settings/branches/[id]/route');

    const res = await DELETE(del(emptyBranchId), params(emptyBranchId));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isActive).toBe(false);
  });

  it('3. PUT isActive:false is the same deactivation and is refused the same way', async () => {
    requireRequestContext.mockResolvedValue(adminContext());
    const { PUT } = await import('@/app/api/settings/branches/[id]/route');

    const res = await PUT(put(busyBranchId, { isActive: false }), params(busyBranchId));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('BRANCH_IN_USE');

    // A rename that leaves isActive alone is still allowed.
    const renamed = await PUT(put(busyBranchId, { name: 'Campus Renommé' }), params(busyBranchId));
    expect(renamed.status).toBe(200);
  });

  it('4. another tenant\'s busy campus is a 404, not a leak of its usage', async () => {
    requireRequestContext.mockResolvedValue(adminContext());
    const { DELETE } = await import('@/app/api/settings/branches/[id]/route');

    const res = await DELETE(del(foreignBranchId), params(foreignBranchId));
    expect(res.status).toBe(404);
    const json = await res.json();
    // The other tenant's student count must not appear anywhere in the answer.
    expect(JSON.stringify(json)).not.toContain('activeStudents');

    // And it is untouched.
    const [row] = await db
      .select({ isActive: branches.isActive })
      .from(branches)
      .where(eq(branches.id, foreignBranchId))
      .limit(1);
    expect(row?.isActive).toBe(true);
  });
});
