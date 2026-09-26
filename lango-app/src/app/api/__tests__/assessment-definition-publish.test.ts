import type { RequestContext } from '@/libs/api/context';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from '@/app/api/academics/assessment-definitions/[id]/publish/route';
import {
  assessmentAudiences,
  assessmentDefinitions,
  assessmentOutcomes,
} from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';
import {
  classes,
  classSections,
  classTeachers,
  mediums,
  sections,
  tenants,
  user,
} from '@/models/Schema';

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

vi.mock('@/libs/api/audit', () => ({
  recordAudit: vi.fn(),
}));

describe('Assessment Definition Publish & Unpublish Route Invariants (schoolos_audit)', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();

  const TEACHER_OWN = `usr-tch-own-${crypto.randomUUID()}`;
  const TEACHER_OTHER = `usr-tch-oth-${crypto.randomUUID()}`;
  const ADMIN_OTHER_TENANT = `usr-adm-oth-${crypto.randomUUID()}`;

  const STUDENT_1 = `usr-stu-1-${crypto.randomUUID()}`;

  const classId = crypto.randomUUID();
  const mediumId = crypto.randomUUID();
  const sectionId = crypto.randomUUID();
  const classSectionId = crypto.randomUUID();

  const defId = crypto.randomUUID();

  beforeAll(async () => {
    // 1. Tenants
    await db.insert(tenants).values([
      { id: tenantId, name: 'Publish Route Tenant', slug: `pub-rt-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Other Route Tenant', slug: `oth-rt-${otherTenantId.slice(0, 8)}` },
    ]);

    // 2. Users
    await db.insert(user).values([
      { id: TEACHER_OWN, tenantId, email: `${TEACHER_OWN}@atlas.ma`, name: 'Teacher Own', role: 'teacher' },
      { id: TEACHER_OTHER, tenantId, email: `${TEACHER_OTHER}@atlas.ma`, name: 'Teacher Other', role: 'teacher' },
      { id: ADMIN_OTHER_TENANT, tenantId: otherTenantId, email: `${ADMIN_OTHER_TENANT}@ninos.ma`, name: 'Other Admin', role: 'school_admin' },
      { id: STUDENT_1, tenantId, email: `${STUDENT_1}@atlas.ma`, name: 'Student 1', role: 'student' },
    ]);

    // 3. Academic Structure
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Standard Medium' });
    await db.insert(classes).values({ id: classId, tenantId, name: '3ème', mediumId });
    await db.insert(sections).values({ id: sectionId, tenantId, name: 'Section A' });
    await db.insert(classSections).values({ id: classSectionId, tenantId, classId, sectionId, mediumId, maxStudents: 30 });

    // 4. Assign TEACHER_OWN to classSectionId
    await db.insert(classTeachers).values({
      tenantId,
      classSectionId,
      teacherId: TEACHER_OWN,
      status: 'active',
    });

    // 5. Create assessment definition targeted to classSectionId
    await db.insert(assessmentDefinitions).values({
      id: defId,
      tenantId,
      title: 'Devoir de Contrôle Continu 1',
      type: 'quiz',
      maximumScore: '20.00',
      coefficient: '1.00',
      passMark: '10.00',
      status: 'draft',
    });

    await db.insert(assessmentAudiences).values({
      assessmentDefinitionId: defId,
      sectionId: classSectionId,
    });

    // 6. Record draft outcome for STUDENT_1
    await db.insert(assessmentOutcomes).values({
      tenantId,
      assessmentDefinitionId: defId,
      studentId: STUDENT_1,
      rawScore: '16.00',
      maximumScoreSnapshot: '20.00',
      normalizedScore: '16.00',
      grade: 'Très Bien',
      status: 'graded',
      moderationState: 'draft',
      sourceType: 'paper_exam',
      markerId: TEACHER_OWN,
    });
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(inArray(assessmentOutcomes.tenantId, [tenantId, otherTenantId]));
    await db.delete(assessmentAudiences).where(eq(assessmentAudiences.assessmentDefinitionId, defId));
    await db.delete(assessmentDefinitions).where(inArray(assessmentDefinitions.tenantId, [tenantId, otherTenantId]));
    await db.delete(classTeachers).where(inArray(classTeachers.tenantId, [tenantId, otherTenantId]));
    await db.delete(classSections).where(inArray(classSections.tenantId, [tenantId, otherTenantId]));
    await db.delete(sections).where(inArray(sections.tenantId, [tenantId, otherTenantId]));
    await db.delete(classes).where(inArray(classes.tenantId, [tenantId, otherTenantId]));
    await db.delete(mediums).where(inArray(mediums.tenantId, [tenantId, otherTenantId]));
    await db.delete(user).where(inArray(user.tenantId, [tenantId, otherTenantId]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  function mockContext(role: 'school_admin' | 'teacher', userId: string, tId: string): RequestContext {
    return {
      userId,
      tenantId: tId,
      branchId: null,
      role,
      baseRole: role,
      name: 'Test Actor',
      email: `${userId}@test.ma`,
    };
  }

  it('allows assigned teacher to publish grades (200 OK)', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValueOnce(mockContext('teacher', TEACHER_OWN, tenantId));

    const req = new Request(`http://localhost:3000/api/academics/assessment-definitions/${defId}/publish`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: defId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.count).toBe(1);

    // Verify DB
    const [outcome] = await db
      .select({ moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, defId));
    expect(outcome?.moderationState).toBe('published');
  });

  it('forbids unassigned teacher from publishing grades (403 Forbidden)', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValueOnce(mockContext('teacher', TEACHER_OTHER, tenantId));

    const req = new Request(`http://localhost:3000/api/academics/assessment-definitions/${defId}/publish`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: defId }) });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for teacher or admin of another tenant (isolation)', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValueOnce(mockContext('school_admin', ADMIN_OTHER_TENANT, otherTenantId));

    const req = new Request(`http://localhost:3000/api/academics/assessment-definitions/${defId}/publish`, {
      method: 'POST',
    });

    const res = await POST(req, { params: Promise.resolve({ id: defId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('unpublishes grades with a required reason', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');

    // 1. Without reason -> 400
    vi.mocked(requireRequestContext).mockResolvedValueOnce(mockContext('teacher', TEACHER_OWN, tenantId));
    const reqNoReason = new Request(`http://localhost:3000/api/academics/assessment-definitions/${defId}/publish`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: '   ' }),
    });

    const resNoReason = await DELETE(reqNoReason, { params: Promise.resolve({ id: defId }) });
    expect([400, 422]).toContain(resNoReason.status);

    // 2. With reason -> 200 and transitions to locked
    vi.mocked(requireRequestContext).mockResolvedValueOnce(mockContext('teacher', TEACHER_OWN, tenantId));
    const reqValid = new Request(`http://localhost:3000/api/academics/assessment-definitions/${defId}/publish`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Correction demandée par la direction' }),
    });

    const resValid = await DELETE(reqValid, { params: Promise.resolve({ id: defId }) });
    const jsonValid = await resValid.json();

    expect(resValid.status).toBe(200);
    expect(jsonValid.success).toBe(true);
    expect(jsonValid.data.count).toBe(1);

    const [outcome] = await db
      .select({ moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, defId));
    expect(outcome?.moderationState).toBe('locked');
  });
});
