import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import {
  assessmentDefinitions,
  assessmentOutcomes,
  examSchedules,
  examTerms,
} from '../models/assessment-schema';
import { tenants, user } from '@/models/Schema';
import { OutcomeService } from '../services/outcome-service';
import { and, eq, inArray } from 'drizzle-orm';

vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn(),
}));

describe('OutcomeService Publishing & Unpublishing Invariants (schoolos_audit)', () => {
  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();

  const studentA1 = `stu-a1-${crypto.randomUUID()}`;
  const studentA2 = `stu-a2-${crypto.randomUUID()}`;
  const studentA3 = `stu-a3-${crypto.randomUUID()}`;
  const studentB1 = `stu-b1-${crypto.randomUUID()}`;

  const markerId = `usr-marker-${crypto.randomUUID()}`;

  const defA1 = crypto.randomUUID();
  const defA2Term = crypto.randomUUID();
  const defB1 = crypto.randomUUID();

  const examTermA = crypto.randomUUID();

  beforeAll(async () => {
    // 1. Create tenants
    await db.insert(tenants).values([
      { id: tenantA, name: 'Tenant A Publishing', slug: `tenant-a-${tenantA.slice(0, 8)}` },
      { id: tenantB, name: 'Tenant B Publishing', slug: `tenant-b-${tenantB.slice(0, 8)}` },
    ]);

    // 2. Create users (students and marker)
    await db.insert(user).values([
      { id: studentA1, tenantId: tenantA, email: `${studentA1}@atlas.ma`, name: 'Student A1', role: 'student' },
      { id: studentA2, tenantId: tenantA, email: `${studentA2}@atlas.ma`, name: 'Student A2', role: 'student' },
      { id: studentA3, tenantId: tenantA, email: `${studentA3}@atlas.ma`, name: 'Student A3', role: 'student' },
      { id: studentB1, tenantId: tenantB, email: `${studentB1}@ninos.ma`, name: 'Student B1', role: 'student' },
      { id: markerId, tenantId: tenantA, email: `${markerId}@atlas.ma`, name: 'Teacher Marker', role: 'teacher' },
    ]);

    // 3. Create exam term for Tenant A
    await db.insert(examTerms).values({
      id: examTermA,
      tenantId: tenantA,
      name: 'Semestre 1 Test Term',
      code: 'S1-TEST',
      startDate: '2026-09-01',
      endDate: '2026-10-31',
      status: 'active',
      isPublished: false,
    });

    // 4. Create assessment definitions
    await db.insert(assessmentDefinitions).values([
      {
        id: defA1,
        tenantId: tenantA,
        title: 'Quiz Mathématiques (No Term)',
        type: 'quiz',
        maximumScore: '20.00',
        coefficient: '1.00',
        passMark: '10.00',
        status: 'draft',
      },
      {
        id: defA2Term,
        tenantId: tenantA,
        termId: examTermA,
        title: 'Examen Français (In Term)',
        type: 'paper_exam',
        maximumScore: '20.00',
        coefficient: '2.00',
        passMark: '10.00',
        status: 'draft',
      },
      {
        id: defB1,
        tenantId: tenantB,
        title: 'Examen Tenant B',
        type: 'paper_exam',
        maximumScore: '20.00',
        coefficient: '1.00',
        passMark: '10.00',
        status: 'draft',
      },
    ]);
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await db.delete(assessmentOutcomes).where(inArray(assessmentOutcomes.tenantId, [tenantA, tenantB]));
    await db.delete(examSchedules).where(inArray(examSchedules.tenantId, [tenantA, tenantB]));
    await db.delete(assessmentDefinitions).where(inArray(assessmentDefinitions.tenantId, [tenantA, tenantB]));
    await db.delete(examTerms).where(inArray(examTerms.tenantId, [tenantA, tenantB]));
    await db.delete(user).where(inArray(user.tenantId, [tenantA, tenantB]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
  });

  it('publishes draft outcomes and counts them accurately', async () => {
    // Record two draft outcomes for defA1 in Tenant A
    await OutcomeService.recordOutcome({
      tenantId: tenantA,
      assessmentDefinitionId: defA1,
      studentId: studentA1,
      rawScore: 15,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId,
    });

    await OutcomeService.recordOutcome({
      tenantId: tenantA,
      assessmentDefinitionId: defA1,
      studentId: studentA2,
      rawScore: 12,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId,
    });

    // Record an outcome for Tenant B in defB1 (should not be touched)
    await OutcomeService.recordOutcome({
      tenantId: tenantB,
      assessmentDefinitionId: defB1,
      studentId: studentB1,
      rawScore: 18,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId,
    });

    const ctxA = { tenantId: tenantA, userId: markerId, role: 'teacher' as const };
    const res = await OutcomeService.publishOutcomes(ctxA, { assessmentDefinitionId: defA1 });

    expect(res.count).toBe(2);

    // Verify in DB that tenant A outcomes are now published
    const outcomesA = await db
      .select({ id: assessmentOutcomes.id, moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, defA1));

    expect(outcomesA).toHaveLength(2);
    expect(outcomesA.every(o => o.moderationState === 'published')).toBe(true);

    // Verify Tenant B outcome remains draft
    const [outcomeB] = await db
      .select({ moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, defB1));

    expect(outcomeB?.moderationState).toBe('draft');
  });

  it('leaves already published outcomes untouched on re-publish', async () => {
    const ctxA = { tenantId: tenantA, userId: markerId, role: 'teacher' as const };
    const res = await OutcomeService.publishOutcomes(ctxA, { assessmentDefinitionId: defA1 });

    expect(res.count).toBe(0);
  });

  it('publishes outcomes via examTermId cascade', async () => {
    // Record outcome for defA2Term linked to examTermA
    await OutcomeService.recordOutcome({
      tenantId: tenantA,
      assessmentDefinitionId: defA2Term,
      studentId: studentA1,
      rawScore: 14,
      status: 'graded',
      sourceType: 'paper_exam',
      markerId,
    });

    // Also record an absent mark for studentA3
    await OutcomeService.recordOutcome({
      tenantId: tenantA,
      assessmentDefinitionId: defA2Term,
      studentId: studentA3,
      status: 'absent',
      sourceType: 'paper_exam',
      markerId,
    });

    const ctxAdmin = { tenantId: tenantA, userId: markerId, role: 'school_admin' as const };
    const res = await OutcomeService.publishOutcomes(ctxAdmin, { examTermId: examTermA });

    expect(res.count).toBe(2);

    const outcomes = await db
      .select({ studentId: assessmentOutcomes.studentId, moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, defA2Term));

    expect(outcomes).toHaveLength(2);
    expect(outcomes.every(o => o.moderationState === 'published')).toBe(true);
  });

  it('requires a reason when unpublishing outcomes and transitions them to locked', async () => {
    const ctxA = { tenantId: tenantA, userId: markerId, role: 'school_admin' as const };

    // 1. Calling without reason should reject with REASON_REQUIRED (400)
    await expect(
      OutcomeService.unpublishOutcomes(ctxA, {
        assessmentDefinitionId: defA1,
        reason: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'REASON_REQUIRED',
      status: 400,
    });

    // 2. Unpublish with valid reason transitions published outcomes to 'locked'
    const res = await OutcomeService.unpublishOutcomes(ctxA, {
      assessmentDefinitionId: defA1,
      reason: 'Erreur de barème signalée par l\'inspection pédagogique',
    });

    expect(res.count).toBe(2);

    const outcomesA = await db
      .select({ id: assessmentOutcomes.id, moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, defA1));

    expect(outcomesA).toHaveLength(2);
    expect(outcomesA.every(o => o.moderationState === 'locked')).toBe(true);

    // Calling again returns 0 since no outcomes are in 'published' state
    const res2 = await OutcomeService.unpublishOutcomes(ctxA, {
      assessmentDefinitionId: defA1,
      reason: 'Second unpublish attempt',
    });
    expect(res2.count).toBe(0);
  });

  it('only publishes outcomes with status graded, exempted, or absent (withheld stays draft)', async () => {
    // Record an outcome with status withheld
    await OutcomeService.recordOutcome({
      tenantId: tenantA,
      assessmentDefinitionId: defA1,
      studentId: studentA3,
      rawScore: 10,
      status: 'withheld',
      sourceType: 'paper_exam',
      markerId,
    });

    const ctxA = { tenantId: tenantA, userId: markerId, role: 'school_admin' as const };
    const res = await OutcomeService.publishOutcomes(ctxA, { assessmentDefinitionId: defA1 });

    // The withheld outcome should NOT have been published
    const [withheldOutcome] = await db
      .select({ moderationState: assessmentOutcomes.moderationState, status: assessmentOutcomes.status })
      .from(assessmentOutcomes)
      .where(and(
        eq(assessmentOutcomes.assessmentDefinitionId, defA1),
        eq(assessmentOutcomes.studentId, studentA3),
      ));

    expect(withheldOutcome?.status).toBe('withheld');
    expect(withheldOutcome?.moderationState).toBe('draft');
  });
});
