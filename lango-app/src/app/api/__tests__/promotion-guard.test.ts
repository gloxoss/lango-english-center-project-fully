import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { classSections, classes, mediums, promotionBatches, sections, sessionYears, tenants, user } from '@/models/Schema';
import { POST } from '@/app/api/students/promotions/route';

const authState = vi.hoisted(() => ({ tenantId: '', userId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: authState.tenantId, userId: authState.userId, role: 'school_admin', branchId: null }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));

const available = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!available)('promotion decision and target guards', () => {
  const tenantId = randomUUID();
  const classSectionId = randomUUID();
  const currentYearId = randomUUID();
  const nextYearId = randomUUID();
  const studentId = `PROMO-${tenantId}`;

  beforeAll(async () => {
    authState.tenantId = tenantId;
    authState.userId = studentId;
    const mediumId = randomUUID();
    const classId = randomUUID();
    const sectionId = randomUUID();
    await db.insert(tenants).values({ id: tenantId, name: 'Promotion Guard Test', slug: `promo-${tenantId}` });
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'French' });
    await db.insert(classes).values({ id: classId, tenantId, name: 'Class', mediumId });
    await db.insert(sections).values({ id: sectionId, tenantId, name: 'A' });
    await db.insert(classSections).values({ id: classSectionId, tenantId, classId, sectionId, mediumId });
    await db.insert(sessionYears).values([
      { id: currentYearId, tenantId, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true },
      { id: nextYearId, tenantId, name: '2027-2028', startDate: '2027-09-01', endDate: '2028-06-30' },
    ]);
    await db.insert(user).values({ id: studentId, tenantId, name: 'Student', email: `${studentId}@example.test`, role: 'student', classSectionId });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function submit(targetSessionYearId: string, decision: 'hold' | 'promote') {
    return POST(new Request('http://localhost/api/students/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceClassSectionId: classSectionId, targetSessionYearId, idempotencyKey: randomUUID(),
        decisions: [{ studentId, decision, targetClassSectionId: decision === 'promote' ? classSectionId : undefined }],
      }),
    }));
  }

  it('rejects current-year targets and pending decisions without creating a batch', async () => {
    const sameYear = await submit(currentYearId, 'promote');
    expect(sameYear.status).toBe(422);
    expect((await sameYear.json()).error.code).toBe('INVALID_TARGET_SESSION');
    const pending = await submit(nextYearId, 'hold');
    expect(pending.status).toBe(409);
    expect((await pending.json()).error.code).toBe('PENDING_DECISIONS');
    expect(await db.select().from(promotionBatches).where(eq(promotionBatches.tenantId, tenantId))).toHaveLength(0);
  });
});
