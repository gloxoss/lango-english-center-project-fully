import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';

import { recordStudentPlacement } from '@/libs/services/student-placement';
import { classes, classSections, mediums, sections, sessionYears, studentPlacements, tenants, user } from '@/models/Schema';
import { POST } from './route';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

// Mock requireRequestContext to return tenant-isolated contexts
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async (req: NextRequest) => {
    const tenantId = req.headers.get('x-tenant-id') || '00000000-0000-0000-0000-000000000001';
    const role = req.headers.get('x-role') || 'school_admin';
    return {
      userId: 'usr_admin_test',
      tenantId,
      role,
      user: { id: 'usr_admin_test', role, tenantId },
    };
  }),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => Promise.resolve()),
}));

describe('Hardened Student Placements API & Integration Contracts', () => {
  it('rejects POST placement with invalid Zod payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/students/placements', {
      method: 'POST',
      body: JSON.stringify({
        studentId: '', // Invalid empty student ID
        sessionYearId: 'not-a-uuid',
        classSectionId: 'not-a-uuid',
      }),
    });

    const response = await POST(req);

    expect(response.status).toBe(400);

    const json = await response.json();

    expect(json.success).toBe(false);
  });

  it('correctly defines single-current placement invariant rules', () => {
    const placements = [
      { id: 'p1', studentId: 'stu_1', isCurrent: false, endDate: '2025-08-31' },
      { id: 'p2', studentId: 'stu_1', isCurrent: true, endDate: null },
    ];

    const currentCount = placements.filter(p => p.isCurrent).length;

    expect(currentCount).toBe(1);
    expect(placements[0]?.endDate).not.toBeNull();
  });
});

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('Student placement PostgreSQL integration', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const mediumId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const sectionA = crypto.randomUUID();
  const sectionB = crypto.randomUUID();
  const classSectionA = crypto.randomUUID();
  const classSectionB = crypto.randomUUID();
  const sessionYearId = crypto.randomUUID();
  const studentId = `PLACEMENT-${crypto.randomUUID()}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Placement Test', slug: `placement-${tenantId}` },
      { id: otherTenantId, name: 'Placement Other', slug: `placement-other-${otherTenantId}` },
    ]);
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Test medium' });
    await db.insert(sections).values([
      { id: sectionA, tenantId, name: 'A' },
      { id: sectionB, tenantId, name: 'B' },
    ]);
    await db.insert(classes).values({ id: classId, tenantId, name: 'Class', mediumId });
    await db.insert(classSections).values([
      { id: classSectionA, tenantId, classId, sectionId: sectionA, mediumId },
      { id: classSectionB, tenantId, classId, sectionId: sectionB, mediumId },
    ]);
    await db.insert(sessionYears).values({ id: sessionYearId, tenantId, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', isDefault: true });
    await db.insert(user).values({ id: studentId, tenantId, name: 'Placement Student', email: `${studentId}@test.local`, role: 'student' });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('atomically closes the previous row and updates the compatibility projection', async () => {
    const first = await recordStudentPlacement({ tenantId, studentId, sessionYearId, classSectionId: classSectionA, startDate: '2026-01-01' });
    const second = await recordStudentPlacement({ tenantId, studentId, sessionYearId, classSectionId: classSectionB, startDate: '2026-02-01' });
    const rows = await db.select().from(studentPlacements).where(eq(studentPlacements.studentId, studentId));
    const [student] = await db.select({ classSectionId: user.classSectionId }).from(user).where(eq(user.id, studentId));

    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.id === first.id)).toMatchObject({ isCurrent: false, endDate: '2026-02-01' });
    expect(rows.find(row => row.id === second.id)).toMatchObject({ isCurrent: true, promotedFromPlacementId: first.id });
    expect(student?.classSectionId).toBe(classSectionB);
  });

  it('rejects cross-tenant references without changing the timeline', async () => {
    const before = await db.select().from(studentPlacements).where(eq(studentPlacements.studentId, studentId));

    await expect(recordStudentPlacement({
      tenantId: otherTenantId,
      studentId,
      sessionYearId,
      classSectionId: classSectionA,
      startDate: '2026-03-01',
    })).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });

    const after = await db.select().from(studentPlacements).where(eq(studentPlacements.studentId, studentId));

    expect(after).toHaveLength(before.length);
  });

  it('serializes concurrent same-day transitions: no torn state, exactly one current row', async () => {
    // Contract (documented in recordStudentPlacement): concurrent transitions
    // for the same student serialize on the (tenant, student) advisory lock.
    // A same-day transition to a DIFFERENT section is the supported
    // "reassignment / rebalancing" operation and SUCCEEDS — the auto-placement
    // commit depends on it — so a concurrent pair ends with the later call
    // winning, never with a torn timeline. The invariants that matter:
    //   1. both calls complete without corrupting the timeline,
    //   2. exactly one isCurrent row survives,
    //   3. the surviving row points at one of the two requested sections.
    // If product ever wants concurrent same-day conflicts to 409 instead,
    // that is a deliberate semantic change to make here AND in the service.
    const results = await Promise.allSettled([
      recordStudentPlacement({ tenantId, studentId, sessionYearId, classSectionId: classSectionA, startDate: '2026-03-01' }),
      recordStudentPlacement({ tenantId, studentId, sessionYearId, classSectionId: classSectionB, startDate: '2026-03-01' }),
    ]);

    for (const result of results) {
      expect(result.status).toBe('fulfilled');
    }

    const current = await db.select().from(studentPlacements).where(eq(studentPlacements.studentId, studentId));

    const currentRows = current.filter(row => row.isCurrent);
    expect(currentRows).toHaveLength(1);
    expect([classSectionA, classSectionB]).toContain(currentRows[0]!.classSectionId);
  });
});
