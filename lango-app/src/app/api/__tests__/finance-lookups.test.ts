import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { branches, classes, classSections, mediums, sections, semesters, tenants } from '@/models/Schema';
import { GET } from '@/app/api/finance/lookups/route';

const authState = vi.hoisted(() => ({ tenantId: '', branchId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: authState.tenantId, role: 'accountant', branchId: authState.branchId }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));

const available = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!available)('accountant finance lookups', () => {
  const tenantId = randomUUID();
  const allowedBranchId = randomUUID();
  const otherBranchId = randomUUID();
  const mediumId = randomUUID();
  const sectionId = randomUUID();
  const allowedClassId = randomUUID();
  const otherClassId = randomUUID();

  beforeAll(async () => {
    authState.tenantId = tenantId;
    authState.branchId = allowedBranchId;
    await db.insert(tenants).values({ id: tenantId, name: 'Finance Lookup Test', slug: `finance-lookup-${tenantId}` });
    await db.insert(branches).values([
      { id: allowedBranchId, tenantId, name: 'North', code: 'NORTH' },
      { id: otherBranchId, tenantId, name: 'South', code: 'SOUTH' },
    ]);
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'French' });
    await db.insert(sections).values({ id: sectionId, tenantId, name: 'A' });
    await db.insert(classes).values([
      { id: allowedClassId, tenantId, branchId: allowedBranchId, name: 'North Class', mediumId },
      { id: otherClassId, tenantId, branchId: otherBranchId, name: 'South Class', mediumId },
    ]);
    await db.insert(classSections).values([
      { tenantId, classId: allowedClassId, sectionId, mediumId },
      { tenantId, classId: otherClassId, sectionId, mediumId },
    ]);
    await db.insert(semesters).values({ tenantId, name: 'Semester 1', startMonth: 9, endMonth: 12 });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('returns only branch classes and tenant semesters to an accountant', async () => {
    const classesResponse = await GET(new Request('http://localhost/api/finance/lookups?resource=class-sections'));
    expect(classesResponse.status).toBe(200);
    const classBody = await classesResponse.json();
    expect(classBody.total).toBe(1);
    expect(classBody.data[0].className).toBe('North Class');
    const termsResponse = await GET(new Request('http://localhost/api/finance/lookups?resource=semesters'));
    expect(termsResponse.status).toBe(200);
    expect((await termsResponse.json()).data[0].name).toBe('Semester 1');
  });
});
