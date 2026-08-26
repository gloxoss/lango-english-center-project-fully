// Human-resources: self-service isolation (api/employee/me/**) + employment
// lifecycle state machine (offboard/reactivate).
//
// Self-service isolation: every api/employee/me/** route resolves "me" from
// the caller's own session (ctx.userId), never from a client-supplied
// employee id - there is structurally no id parameter to manipulate. This
// test proves the boundary directly with two real employees in the same
// tenant, rather than trusting the design intent.
//
// Lifecycle: offboardEmployee/reactivateEmployee reject illegal transitions
// (offboarding an already-offboarded employee, reactivating one that isn't
// offboarded) and correctly toggle the linked account's login access.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { offboardEmployee, reactivateEmployee } from '@/features/hr/services/offboarding-service';
import { createEmployee } from '@/features/hr/services/employees-service';
import { employeeProfiles, tenants, user } from '@/models/Schema';
import { employeeDocuments } from '@/features/hr/models/hr-schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

const { requireRequestContext } = vi.hoisted(() => ({ requireRequestContext: vi.fn() }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext,
  requireTenant: (ctx: { tenantId?: string | null }) => {
    if (!ctx.tenantId) throw new Error('TENANT_REQUIRED');
    return ctx.tenantId;
  },
}));

const { GET: meProfile } = await import('@/app/api/employee/me/profile/route');
const { GET: downloadDocument } = await import('@/app/api/employee/me/documents/[documentId]/download/route');

describe.skipIf(!dbReachable)('HR self-service isolation + employment lifecycle', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const adminId = `HR-ADMIN-${suffix}`;
  const userA = `HR-USR-A-${suffix}`;
  const userB = `HR-USR-B-${suffix}`;
  let employeeA = '';
  let employeeB = '';
  let docA = '';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `HR Lifecycle ${suffix}`, slug: `hr-life-${suffix}` });
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'HR Admin', email: `hr-admin-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
      { id: userA, tenantId, name: 'Employee A', email: `hr-usr-a-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
      { id: userB, tenantId, name: 'Employee B', email: `hr-usr-b-${suffix}@test.local`, role: 'teacher', userStatus: 'active' },
    ]);

    const empA = await createEmployee(tenantId, adminId, { userId: userA, firstName: 'A', lastName: 'Employee', employmentStatus: 'active' });
    const empB = await createEmployee(tenantId, adminId, { userId: userB, firstName: 'B', lastName: 'Employee', employmentStatus: 'active' });
    employeeA = empA!.id;
    employeeB = empB!.id;

    const [doc] = await db.insert(employeeDocuments).values({
      tenantId, employeeId: employeeA, documentType: 'cin', storageKey: `${employeeA}/cin.pdf`,
      originalName: 'cin-a.pdf', mimeType: 'application/pdf', fileSize: 100,
    }).returning({ id: employeeDocuments.id });
    docA = doc!.id;
  }, 30_000);

  afterAll(async () => {
    await db.delete(employeeDocuments).where(eq(employeeDocuments.tenantId, tenantId));
    await db.delete(employeeProfiles).where(eq(employeeProfiles.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  function asUser(userId: string) {
    requireRequestContext.mockResolvedValue({
      userId, tenantId, branchId: null, role: 'teacher', baseRole: 'teacher', name: 'Employee', email: `${userId}@test.local`,
    });
  }

  describe('self-service isolation', () => {
    it('me/profile returns only the caller\'s own identity', async () => {
      asUser(userA);
      const res = await meProfile(new Request('http://localhost/api/employee/me/profile'));
      const json = await res.json();
      expect(json.data.user.email).toBe(`hr-usr-a-${suffix}@test.local`);
    });

    it('employee B can never download employee A\'s document via the me/ route', async () => {
      asUser(userB);
      const res = await downloadDocument(
        new Request(`http://localhost/api/employee/me/documents/${docA}/download`),
        { params: Promise.resolve({ documentId: docA }) },
      );
      expect(res.status).toBe(404);
    });
  });

  describe('employment lifecycle state machine', () => {
    it('offboards an active employee: status flips, linked account deactivates', async () => {
      const row = await offboardEmployee(tenantId, adminId, employeeB, 'test offboard');
      expect(row!.employmentStatus).toBe('offboarded');

      const [u] = await db.select({ userStatus: user.userStatus }).from(user).where(eq(user.id, userB));
      expect(u!.userStatus).toBe('inactive');
    });

    it('rejects offboarding an already-offboarded employee', async () => {
      await expect(offboardEmployee(tenantId, adminId, employeeB, 'again')).rejects.toMatchObject({ code: 'ALREADY_OFFBOARDED' });
    });

    it('rejects reactivating an employee that is not offboarded', async () => {
      await expect(reactivateEmployee(tenantId, adminId, employeeA, 'oops')).rejects.toMatchObject({ code: 'NOT_OFFBOARDED' });
    });

    it('reactivates an offboarded employee: status + linked account restore', async () => {
      const row = await reactivateEmployee(tenantId, adminId, employeeB, 'rehired');
      expect(row!.employmentStatus).toBe('active');

      const [u] = await db.select({ userStatus: user.userStatus }).from(user).where(eq(user.id, userB));
      expect(u!.userStatus).toBe('active');
    });
  });
});
