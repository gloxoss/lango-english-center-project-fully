import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AppRole, RequestContext } from '@/libs/api/context';
import { db } from '@/libs/DB';
import { branches, tenants, user, userPermissionOverrides } from '@/models/Schema';
import { departments } from '@/features/hr/models/hr-schema';
import { leadershipApprovalAuthorities, leadershipScopeAssignments } from '../models/leadership-schema';
import { listActiveAuthorities, requireLeadershipScope } from './scope-service';

const hasDb = Boolean(process.env.DATABASE_URL);

function ctxFor(userId: string, role: AppRole, tenantId: string): RequestContext {
  return { userId, tenantId, branchId: null, role, baseRole: role, name: 'Test User', email: `${userId}@test.local`, sessionId: null };
}

const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

describe.skipIf(!hasDb)('leadership scope service', () => {
  const suffix = randomUUID().slice(0, 8);
  let tenantId = '';
  let adminId = '';
  let plainTeacherId = '';
  let branchLeaderId = '';
  let deptLeaderId = '';
  let expiredLeaderId = '';
  let futureLeaderId = '';
  let revokedLeaderId = '';
  let branchId = '';
  let departmentId = '';
  let branchAssignmentId = '';

  beforeAll(async () => {
    const [tenant] = await db.insert(tenants).values({ name: `Scope Test ${suffix}`, slug: `scope-test-${suffix}` }).returning();
    tenantId = tenant!.id;
    const [branch] = await db.insert(branches).values({ tenantId, name: 'Main', code: `SC${suffix}` }).returning();
    branchId = branch!.id;
    const [department] = await db.insert(departments).values({ tenantId, name: 'Direction Pédagogique' }).returning();
    departmentId = department!.id;

    adminId = `scope-admin-${suffix}`;
    plainTeacherId = `scope-plain-${suffix}`;
    branchLeaderId = `scope-branch-${suffix}`;
    deptLeaderId = `scope-dept-${suffix}`;
    expiredLeaderId = `scope-expired-${suffix}`;
    futureLeaderId = `scope-future-${suffix}`;
    revokedLeaderId = `scope-revoked-${suffix}`;

    await db.insert(user).values([
      { id: adminId, tenantId, branchId, email: `${adminId}@test.local`, name: 'Scope Admin', role: 'school_admin' },
      { id: plainTeacherId, tenantId, branchId, email: `${plainTeacherId}@test.local`, name: 'Plain Teacher', role: 'teacher' },
      { id: branchLeaderId, tenantId, branchId, email: `${branchLeaderId}@test.local`, name: 'Branch Leader', role: 'teacher' },
      { id: deptLeaderId, tenantId, branchId, email: `${deptLeaderId}@test.local`, name: 'Dept Leader', role: 'teacher' },
      { id: expiredLeaderId, tenantId, branchId, email: `${expiredLeaderId}@test.local`, name: 'Expired Leader', role: 'teacher' },
      { id: futureLeaderId, tenantId, branchId, email: `${futureLeaderId}@test.local`, name: 'Future Leader', role: 'teacher' },
      { id: revokedLeaderId, tenantId, branchId, email: `${revokedLeaderId}@test.local`, name: 'Revoked Leader', role: 'teacher' },
    ]);
    // Grant the portal capability to the non-school_admin leaders only.
    for (const uid of [branchLeaderId, deptLeaderId, expiredLeaderId, futureLeaderId, revokedLeaderId]) {
      await db.insert(userPermissionOverrides).values({ tenantId, userId: uid, permissionId: 'leadership.portal.use', granted: true });
    }

    const [branchAssignment] = await db.insert(leadershipScopeAssignments).values({
      tenantId, userId: branchLeaderId, scopeType: 'branch', branchId, departmentId: null, startsOn: dayOffset(0), endsOn: null, status: 'active', createdById: adminId,
    }).returning();
    branchAssignmentId = branchAssignment!.id;
    await db.insert(leadershipScopeAssignments).values({ tenantId, userId: deptLeaderId, scopeType: 'department', branchId: null, departmentId, startsOn: dayOffset(-1), endsOn: dayOffset(30), status: 'active', createdById: adminId });
    await db.insert(leadershipScopeAssignments).values({ tenantId, userId: expiredLeaderId, scopeType: 'branch', branchId, departmentId: null, startsOn: dayOffset(-60), endsOn: dayOffset(-1), status: 'active', createdById: adminId });
    await db.insert(leadershipScopeAssignments).values({ tenantId, userId: futureLeaderId, scopeType: 'branch', branchId, departmentId: null, startsOn: dayOffset(10), endsOn: null, status: 'active', createdById: adminId });
    await db.insert(leadershipScopeAssignments).values({ tenantId, userId: revokedLeaderId, scopeType: 'branch', branchId, departmentId: null, startsOn: dayOffset(0), endsOn: null, status: 'revoked', createdById: adminId });
  }, 30_000);

  afterAll(async () => {
    if (tenantId) await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('grants school_admin an implicit tenant-wide scope without an assignment', async () => {
    const scope = await requireLeadershipScope(ctxFor(adminId, 'school_admin', tenantId));
    expect(scope).toEqual({ assignmentId: null, type: 'tenant', branchId: null, departmentId: null });
  });

  it('denies a role without the portal capability', async () => {
    await expect(requireLeadershipScope(ctxFor(plainTeacherId, 'teacher', tenantId))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('resolves an active branch assignment into a branch scope', async () => {
    const scope = await requireLeadershipScope(ctxFor(branchLeaderId, 'teacher', tenantId));
    expect(scope).toEqual({ assignmentId: branchAssignmentId, type: 'branch', branchId, departmentId: null });
  });

  it('resolves an active department assignment into a department scope', async () => {
    const scope = await requireLeadershipScope(ctxFor(deptLeaderId, 'teacher', tenantId));
    expect(scope.type).toBe('department');
    expect(scope.departmentId).toBe(departmentId);
    expect(scope.branchId).toBeNull();
  });

  it('rejects assignments outside their validity window', async () => {
    await expect(requireLeadershipScope(ctxFor(expiredLeaderId, 'teacher', tenantId))).rejects.toMatchObject({ code: 'LEADERSHIP_SCOPE_REQUIRED' });
    await expect(requireLeadershipScope(ctxFor(futureLeaderId, 'teacher', tenantId))).rejects.toMatchObject({ code: 'LEADERSHIP_SCOPE_REQUIRED' });
  });

  it('rejects a revoked assignment', async () => {
    await expect(requireLeadershipScope(ctxFor(revokedLeaderId, 'teacher', tenantId))).rejects.toMatchObject({ code: 'LEADERSHIP_SCOPE_REQUIRED' });
  });

  it('lists only the active, in-window authorities of the caller’s assignment', async () => {
    // A tenant-wide scope has no assignment → no authorities.
    expect(await listActiveAuthorities(ctxFor(adminId, 'school_admin', tenantId), { assignmentId: null, type: 'tenant', branchId: null, departmentId: null })).toHaveLength(0);

    await db.insert(leadershipApprovalAuthorities).values([
      { tenantId, assignmentId: branchAssignmentId, domain: 'finance', action: 'Valider une note de crédit', maxAmount: '1500.00', startsOn: dayOffset(0), endsOn: null, status: 'active', createdById: adminId },
      { tenantId, assignmentId: branchAssignmentId, domain: 'attendance', action: 'Clôturer un drapeau', maxAmount: null, startsOn: dayOffset(-10), endsOn: dayOffset(-1), status: 'active', createdById: adminId },
      { tenantId, assignmentId: branchAssignmentId, domain: 'operations', action: 'Autoriser une dépense', maxAmount: '800.00', startsOn: dayOffset(10), endsOn: null, status: 'active', createdById: adminId },
      { tenantId, assignmentId: branchAssignmentId, domain: 'reporting', action: 'Exporter un rapport', maxAmount: null, startsOn: dayOffset(0), endsOn: null, status: 'revoked', createdById: adminId },
    ]);

    const active = await listActiveAuthorities(ctxFor(branchLeaderId, 'teacher', tenantId), { assignmentId: branchAssignmentId, type: 'branch', branchId, departmentId: null });
    expect(active.map(a => a.action)).toEqual(['Valider une note de crédit']);
    expect(active[0]?.domain).toBe('finance');
    expect(active[0]?.maxAmount).toBe('1500.00');

    // A different assignment never sees another leader’s authorities.
    const other = await listActiveAuthorities(ctxFor(deptLeaderId, 'teacher', tenantId), { assignmentId: randomUUID(), type: 'department', branchId: null, departmentId });
    expect(other).toHaveLength(0);
  });
});
