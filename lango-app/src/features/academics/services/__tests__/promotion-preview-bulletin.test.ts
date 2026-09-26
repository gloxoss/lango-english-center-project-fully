import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { OutcomeService } from '@/features/assessment/services/outcome-service';
import {
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import {
  classSections,
  classSubjects,
  classes,
  mediums,
  sections,
  subjects,
  tenants,
  user,
} from '@/models/Schema';

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));
vi.mock('@/libs/api/permissions', async (orig) => ({
  ...(await orig<typeof import('@/libs/api/permissions')>()),
  requireCapability: vi.fn(async () => undefined),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);

const tenantId = crypto.randomUUID();
const mediumId = crypto.randomUUID();
const classId = crypto.randomUUID();
const sectionId = crypto.randomUUID();
const classSectionId = crypto.randomUUID();
const eliminated = `STU-EL-${crypto.randomUUID()}`;
const balanced = `STU-OK-${crypto.randomUUID()}`;
const math = { subjectId: crypto.randomUUID(), classSubjectId: crypto.randomUUID(), defId: crypto.randomUUID() };
const fr = { subjectId: crypto.randomUUID(), classSubjectId: crypto.randomUUID(), defId: crypto.randomUUID() };

describe.skipIf(!dbReachable)('promotion preview uses the bulletin decision (canonical store)', () => {
  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({
      userId: 'USR-PROMO-TEST', tenantId, branchId: null, role: 'school_admin', baseRole: 'school_admin', name: 'T', email: 't@t.local',
    } as never);

    await db.insert(tenants).values({ id: tenantId, name: 'Promo Bulletin', slug: `pb-${tenantId}` });
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Arabe' });
    await db.insert(sections).values({ id: sectionId, tenantId, name: 'A' });
    await db.insert(classes).values({ id: classId, tenantId, name: '2AC', mediumId });
    await db.insert(classSections).values({ id: classSectionId, tenantId, classId, sectionId, mediumId });
    await db.insert(user).values([
      { id: eliminated, tenantId, name: 'Eliminé Test', email: `e-${tenantId}@t.local`, role: 'student', classSectionId },
      { id: balanced, tenantId, name: 'Equilibre Test', email: `b-${tenantId}@t.local`, role: 'student', classSectionId },
    ]);
    for (const [s, name, coef] of [[math, 'Maths', '4.00'], [fr, 'Français', '1.00']] as const) {
      await db.insert(subjects).values({ id: s.subjectId, tenantId, name, mediumId, type: 'theory' });
      await db.insert(classSubjects).values({ id: s.classSubjectId, tenantId, classId, subjectId: s.subjectId, type: 'compulsory', coefficient: coef });
      await db.insert(assessmentDefinitions).values({
        id: s.defId,
        tenantId,
        classSubjectId: s.classSubjectId,
        title: `${name} CC1`,
        maximumScore: '20.00',
        coefficient: '1.00',
        status: 'draft',
      });
    }

    // Weighted (18*4 + 4*1)/5 = 15.2/20 — above the pass mark, but Français
    // 4/20 is under the default eliminatory mark (5): must be retained.
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: math.defId,
      studentId: eliminated,
      rawScore: 18,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: fr.defId,
      studentId: eliminated,
      rawScore: 4,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });

    // 12/20 and 12/20: promoted.
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: math.defId,
      studentId: balanced,
      rawScore: 12,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
    await OutcomeService.recordOutcome({
      tenantId,
      assessmentDefinitionId: fr.defId,
      studentId: balanced,
      rawScore: 12,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId: 'marker-1',
    });
  }, 30_000);

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('retains a student under the eliminatory mark and promotes a balanced one', async () => {
    const { GET } = await import('@/app/api/students/promotions/preview/route');
    const res = await GET(new NextRequest(`http://localhost/api/students/promotions/preview?sourceSectionId=${classSectionId}`));
    const json = await res.json();
    expect(res.status).toBe(200);
    const rows = json.data as Array<{ studentId: string; decision: string; grade20: number | null }>;
    const el = rows.find(r => r.studentId === eliminated)!;
    const ok = rows.find(r => r.studentId === balanced)!;
    expect(el.grade20).toBe(15.2);
    expect(el.decision).toBe('repeat');
    expect(['promote', 'graduate']).toContain(ok.decision);
  });
});
