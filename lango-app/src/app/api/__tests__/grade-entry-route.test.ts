import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/academics/assessments/route';
import { db } from '@/libs/DB';
import { assessmentPlans, assessmentResults, assessments, gradingScales, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

// Gate 2 / academics route coverage.
//
// Measured 2026-08-28: of 789 API route files, ~36 are exercised by any test,
// and academics was 0 of 64 — including this one, the path that actually
// persists grades. The Moroccan grade engine had good unit coverage, but only
// of the pure functions (calculateMoroccanAverage, getMoroccanMention). Nothing
// called the handler, so the authorization, the Zod contract, the tenant
// scoping and the replace-on-resubmit behaviour were all unverified.
//
// The roadmap ranks a grading arithmetic/persistence bug alongside a money bug:
// "schools will not catch it until a parent disputes a transcript."

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantId = crypto.randomUUID();
const otherTenantId = crypto.randomUUID();
const TEACHER_ID = `USR-T-${crypto.randomUUID()}`;
const STUDENT_A = `USR-SA-${crypto.randomUUID()}`;
const STUDENT_B = `USR-SB-${crypto.randomUUID()}`;
const assessmentId = crypto.randomUUID();

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return { userId: TEACHER_ID, tenantId, role: 'teacher', ...overrides } as RequestContext;
}

async function setContext(value: RequestContext | Error) {
  const { requireRequestContext } = await import('@/libs/api/context');
  const mocked = vi.mocked(requireRequestContext);
  if (value instanceof Error) mocked.mockRejectedValue(value);
  else mocked.mockResolvedValue(value);
}

function postGrades(body: unknown): Promise<Response> {
  return POST(new Request('http://localhost/api/academics/assessments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe.skipIf(!dbReachable)('POST /api/academics/assessments — grade entry', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Grade Test', slug: `grade-${tenantId}` },
      { id: otherTenantId, name: 'Other', slug: `other-${otherTenantId}` },
    ]);
    await db.insert(user).values([
      { id: TEACHER_ID, tenantId, name: 'Prof Test', email: `t-${tenantId}@test.local`, role: 'teacher' },
      { id: STUDENT_A, tenantId, name: 'Eleve A', email: `a-${tenantId}@test.local`, role: 'student' },
      { id: STUDENT_B, tenantId, name: 'Eleve B', email: `b-${tenantId}@test.local`, role: 'student' },
    ]);

    // assessment_results.assessment_id is a real FK, so the row cannot be
    // faked: grading_scale -> assessment_plan -> assessment must exist first.
    // The foreign-tenant result row in the GET isolation test reuses this same
    // assessment id on purpose, so only the tenant filter can exclude it.
    for (const [tid, aid] of [[tenantId, assessmentId]] as const) {
      const [scale] = await db.insert(gradingScales)
        .values({ tenantId: tid, name: 'Barème /20' }).returning();
      const [plan] = await db.insert(assessmentPlans)
        .values({ tenantId: tid, name: 'Plan T1', gradingScaleId: scale!.id }).returning();
      await db.insert(assessments).values({
        id: aid,
        tenantId: tid,
        assessmentPlanId: plan!.id,
        title: 'Contrôle 1',
        assessmentDate: new Date().toISOString(),
      });
    }
  });

  afterAll(async () => {
    await db.delete(assessmentResults).where(eq(assessmentResults.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('persists grades with the Moroccan mention derived from the score', async () => {
    await setContext(ctx());
    const res = await postGrades({
      assessmentId,
      grades: [
        { studentId: STUDENT_A, score: 17 }, // >= 16 -> Très Bien
        { studentId: STUDENT_B, score: 9.5 }, // < 10  -> Insuffisant
      ],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);

    const rows = await db.select().from(assessmentResults)
      .where(and(eq(assessmentResults.tenantId, tenantId), eq(assessmentResults.assessmentId, assessmentId)));

    expect(rows).toHaveLength(2);
    const byStudent = Object.fromEntries(rows.map(r => [r.studentId, r]));
    expect(byStudent[STUDENT_A]!.gradeCode).toBe('Très Bien');
    expect(byStudent[STUDENT_B]!.gradeCode).toBe('Insuffisant');
    // Score is persisted on the /20 scale, not rescaled to a percentage.
    expect(Number(byStudent[STUDENT_A]!.finalPercentage)).toBe(17);
    expect(Number(byStudent[STUDENT_B]!.finalPercentage)).toBe(9.5);
  });

  it('replaces a prior grade instead of accumulating duplicate rows', async () => {
    await setContext(ctx());
    await postGrades({ assessmentId, grades: [{ studentId: STUDENT_A, score: 11 }] });

    const rows = await db.select().from(assessmentResults)
      .where(and(
        eq(assessmentResults.tenantId, tenantId),
        eq(assessmentResults.assessmentId, assessmentId),
        eq(assessmentResults.studentId, STUDENT_A),
      ));

    // A second submission for the same student must correct the grade, not
    // leave two conflicting rows for a transcript to pick between.
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]!.finalPercentage)).toBe(11);
    expect(rows[0]!.gradeCode).toBe('Passable'); // 11 -> >= 10
  });

  it('rejects a score outside the Moroccan 0-20 scale', async () => {
    await setContext(ctx());
    const tooHigh = await postGrades({ assessmentId, grades: [{ studentId: STUDENT_A, score: 21 }] });
    const negative = await postGrades({ assessmentId, grades: [{ studentId: STUDENT_A, score: -1 }] });

    expect(tooHigh.status).toBeGreaterThanOrEqual(400);
    expect(negative.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects unknown fields (Zod .strict) rather than silently ignoring them', async () => {
    await setContext(ctx());
    const res = await postGrades({
      assessmentId,
      grades: [{ studentId: STUDENT_A, score: 12, tenantId: otherTenantId }],
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('requires an authenticated context', async () => {
    await setContext(Object.assign(new Error('unauthorized'), { status: 401 }));
    const res = await postGrades({ assessmentId, grades: [{ studentId: STUDENT_A, score: 12 }] });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('GET returns only the calling tenant’s results', async () => {
    // Deliberately plant the foreign row on the SAME assessment id. If GET
    // filtered only by assessmentId and not by tenantId, this row would leak —
    // which is the exact D-5 shape. A different assessment id would not test it.
    await db.insert(user).values({
      id: `USR-X-${otherTenantId}`, tenantId: otherTenantId, name: 'Foreign', email: `x-${otherTenantId}@test.local`, role: 'student',
    });
    await db.insert(assessmentResults).values({
      tenantId: otherTenantId,
      assessmentId,
      studentId: `USR-X-${otherTenantId}`,
      finalPercentage: '20',
      gradeCode: 'Très Bien',
    });

    await setContext(ctx());
    const res = await GET(new Request(`http://localhost/api/academics/assessments?assessmentId=${assessmentId}`));
    expect(res.status).toBe(200);
    const json = await res.json();

    const returnedTenants = new Set(json.data.map((r: { studentId: string }) => r.studentId));
    expect(returnedTenants.has(`USR-X-${otherTenantId}`)).toBe(false);

    await db.delete(assessmentResults).where(eq(assessmentResults.tenantId, otherTenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
  });
});
