import { and, count, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Teacher directory hardening suite.
//
// Covers the P0/P1 invariants from the Corps Enseignant audit:
//   - tenant + branch isolation on list/detail/update/delete
//   - redacted list payload / HR-sensitive detail boundary
//   - server pagination + institution-wide KPI summary independent of filters
//   - planned workload from the published timetable (never user.workload_hours)
//   - dossier completeness, HR on_leave, employee-id reservation
//   - onboarding provisioning, branch pinning, duplicate refusal
//   - ended assignments stop granting attendance and grade access
//   - subject-level grade authorization
//   - lifecycle preserves history; hard delete is refused with dependencies

const currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
  requireAnyCapability: vi.fn(async () => undefined),
  requirePlanTier: vi.fn(async () => undefined),
  hasCapability: vi.fn(async () => true),
  getEffectivePermissions: vi.fn(async () => ({})),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const { db } = await import('@/libs/DB');
const { assessmentAudiences, assessmentDefinitions, assessmentOutcomes } = await import('@/features/assessment/models/assessment-schema');
const {
  accountSetupTokens,
  branches,
  classSections,
  classSubjects,
  classTeachers,
  classes,
  mediums,
  sections,
  sessionYears,
  subjectTeachers,
  subjects,
  tenants,
  timetableVersions,
  classScheduleSlots,
  user,
  employeeProfiles,
} = await import('@/models/Schema');
const teacherRoutes = await import('@/app/api/teachers/route');
const teacherOptionsRoute = await import('@/app/api/teachers/options/route');
const teacherExportRoute = await import('@/app/api/teachers/export/route');
const attendanceRoutes = await import('@/app/api/attendance/route');
const gradeEntryRoutes = await import('@/app/api/academics/grade-entry/route');
const classTeachersRoutes = await import('@/app/api/academics/class-teachers/route');
const subjectTeachersRoutes = await import('@/app/api/academics/subject-teachers/route');
const photoRoute = await import('@/app/api/teachers/photo/route');
const { reserveTeacherEmployeeId } = await import('@/features/teachers/server/teacher-service');
const { getTeacherClassSectionIds } = await import('@/libs/api/teacher-scope');
const { loadScopedMarksheet } = await import('@/features/assessment/services/marksheet-access');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('teacher directory hardening', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const adminA = `USR-ADM-A-${suffix}`;
  const adminAll = `USR-ADM-ALL-${suffix}`;
  const teacherA = `USR-TCH-A-${suffix}`;
  const teacherB = `USR-TCH-B-${suffix}`;
  const teacherClean = `USR-TCH-CLEAN-${suffix}`;
  const teacherComplete = `USR-TCH-COMPLETE-${suffix}`;
  const teacherOtherTenant = `USR-TCH-OTHER-${suffix}`;
  const studentA = `USR-STU-A-${suffix}`;

  let branchA = '';
  let branchB = '';
  let sectionA1 = '';
  let sectionB1 = '';
  let mathClassSubjectId = '';
  let frenchClassSubjectId = '';
  let mathDefinitionId = '';
  let frenchDefinitionId = '';

  async function asPrincipal(userId: string, role: string, branchId: string | null = null) {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId, branchId, role } as never);
  }

  function jsonRequest(url: string, method: string, body?: unknown): Request {
    return new Request(url, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Teacher Test', slug: `tch-${suffix}` },
      { id: otherTenantId, name: 'Teacher Other', slug: `tch-other-${suffix}` },
    ]);

    const branchRows = await db.insert(branches).values([
      { tenantId, name: 'Campus A', code: `A-${suffix}` },
      { tenantId, name: 'Campus B', code: `B-${suffix}` },
    ]).returning();
    branchA = branchRows[0]!.id;
    branchB = branchRows[1]!.id;

    await db.insert(user).values([
      { id: adminA, tenantId, branchId: branchA, name: 'Admin Campus A', email: `admin-a-${suffix}@t.local`, role: 'school_admin' },
      { id: adminAll, tenantId, branchId: null, name: 'Admin Whole School', email: `admin-all-${suffix}@t.local`, role: 'school_admin' },
      {
        id: teacherA,
        tenantId,
        branchId: branchA,
        name: 'Aicha Teacher',
        email: `tch-a-${suffix}@t.local`,
        role: 'teacher',
        specialization: 'Mathématiques',
        hireDate: '2024-09-01',
        employeeId: `EMP-A-${suffix}`,
        documents: { contract: true, cin: true, diploma: true },
      },
      { id: teacherB, tenantId, branchId: branchB, name: 'Brahim Teacher', email: `tch-b-${suffix}@t.local`, role: 'teacher' },
      { id: teacherClean, tenantId, branchId: branchA, name: 'Clean Teacher', email: `tch-clean-${suffix}@t.local`, role: 'teacher' },
      {
        id: teacherComplete,
        tenantId,
        branchId: branchA,
        name: 'Complete Teacher',
        email: `tch-complete-${suffix}@t.local`,
        role: 'teacher',
        specialization: 'Physique',
        hireDate: '2023-09-01',
        employeeId: `EMP-C-${suffix}`,
        documents: { contract: true, cin: true, diploma: true },
      },
      { id: teacherOtherTenant, tenantId: otherTenantId, name: 'Other Tenant Teacher', email: `tch-other-${suffix}@t.local`, role: 'teacher' },
      { id: studentA, tenantId, name: 'Student A', email: `stu-a-${suffix}@t.local`, role: 'student' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const classRows = await db.insert(classes).values([
      { tenantId, branchId: branchA, name: `1A-${suffix}`, mediumId: medium!.id },
      { tenantId, branchId: branchB, name: `1B-${suffix}`, mediumId: medium!.id },
    ]).returning();
    const sectionRows = await db.insert(sections).values([
      { tenantId, name: `S1-${suffix}` },
      { tenantId, name: `S2-${suffix}` },
    ]).returning();

    const classSectionRows = await db.insert(classSections).values([
      { tenantId, classId: classRows[0]!.id, sectionId: sectionRows[0]!.id, mediumId: medium!.id },
      { tenantId, classId: classRows[1]!.id, sectionId: sectionRows[1]!.id, mediumId: medium!.id },
    ]).returning();
    sectionA1 = classSectionRows[0]!.id;
    sectionB1 = classSectionRows[1]!.id;

    await db.update(user).set({ classSectionId: sectionA1 }).where(eq(user.id, studentA));

    const subjectRows = await db.insert(subjects).values([
      { tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' },
      { tenantId, name: `Français-${suffix}`, mediumId: medium!.id, type: 'theory' },
    ]).returning();

    const classSubjectRows = await db.insert(classSubjects).values([
      { tenantId, classId: classRows[0]!.id, subjectId: subjectRows[0]!.id, type: 'compulsory' },
      { tenantId, classId: classRows[0]!.id, subjectId: subjectRows[1]!.id, type: 'compulsory' },
    ]).returning();
    mathClassSubjectId = classSubjectRows[0]!.id;
    frenchClassSubjectId = classSubjectRows[1]!.id;

    // teacherA teaches Maths (not Français) in section A1 — current assignment.
    await db.insert(subjectTeachers).values([
      { tenantId, classSectionId: sectionA1, subjectId: subjectRows[0]!.id, classSubjectId: mathClassSubjectId, teacherId: teacherA },
    ]);
    // teacherB has an ENDED class assignment (ended yesterday) — must not grant access.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await db.insert(classTeachers).values([
      { tenantId, teacherId: teacherA, classSectionId: sectionA1, role: 'primary' },
      { tenantId, teacherId: teacherB, classSectionId: sectionB1, role: 'primary', endsOn: yesterday },
    ]);

    const definitionRows = await db.insert(assessmentDefinitions).values([
      { tenantId, classSubjectId: mathClassSubjectId, title: `Devoir Maths ${suffix}`, type: 'quiz', maximumScore: '20.00' },
      { tenantId, classSubjectId: frenchClassSubjectId, title: `Devoir Français ${suffix}`, type: 'quiz', maximumScore: '20.00' },
    ]).returning();
    mathDefinitionId = definitionRows[0]!.id;
    frenchDefinitionId = definitionRows[1]!.id;

    await db.insert(assessmentAudiences).values([
      { assessmentDefinitionId: mathDefinitionId, sectionId: sectionA1 },
      { assessmentDefinitionId: frenchDefinitionId, sectionId: sectionA1 },
    ]);

    // Published timetable with one 2h slot for teacherA.
    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `2026-2027-${suffix}`,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-06-30T00:00:00.000Z',
      isDefault: true,
    }).returning();
    const [version] = await db.insert(timetableVersions).values({
      tenantId,
      sessionYearId: sessionYear!.id,
      status: 'published',
      createdBy: adminAll,
      publishedBy: adminAll,
      publishedAt: new Date().toISOString(),
    }).returning();
    await db.insert(classScheduleSlots).values({
      tenantId,
      classSectionId: sectionA1,
      classSubjectId: mathClassSubjectId,
      teacherId: teacherA,
      dayOfWeek: 'monday',
      startTime: '08:00',
      endTime: '10:00',
      versionId: version!.id,
    });
  });

  afterAll(async () => {
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(assessmentAudiences).where(inArray(assessmentAudiences.assessmentDefinitionId, [mathDefinitionId, frenchDefinitionId]));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(employeeProfiles).where(eq(employeeProfiles.tenantId, tenantId));
    await db.delete(accountSetupTokens).where(eq(accountSetupTokens.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('list is tenant-scoped and excludes other tenants', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?pageSize=100'));

    expect(res.status).toBe(200);

    const body = await res.json();
    const ids = body.data.map((item: { id: string }) => item.id);

    expect(ids).toContain(teacherA);
    expect(ids).not.toContain(teacherOtherTenant);
  });

  it('cross-tenant detail is a 404', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request(`http://x/api/teachers?id=${teacherOtherTenant}`));

    expect(res.status).toBe(404);
  });

  it('branch-limited admin sees only their campus', async () => {
    await asPrincipal(adminA, 'school_admin', branchA);
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?pageSize=100'));
    const body = await res.json();
    const ids = body.data.map((item: { id: string }) => item.id);

    expect(ids).toContain(teacherA);
    expect(ids).not.toContain(teacherB);
    expect(ids).not.toContain(teacherOtherTenant);
  });

  it('branch-limited admin cannot request another campus', async () => {
    await asPrincipal(adminA, 'school_admin', branchA);
    const res = await teacherRoutes.GET(new Request(`http://x/api/teachers?branchId=${branchB}`));

    expect(res.status).toBe(403);
  });

  it('branch-limited admin cannot read, update or delete another campus teacher', async () => {
    await asPrincipal(adminA, 'school_admin', branchA);

    const read = await teacherRoutes.GET(new Request(`http://x/api/teachers?id=${teacherB}`));

    expect(read.status).toBe(404);

    const update = await teacherRoutes.PUT(jsonRequest('http://x/api/teachers', 'PUT', { id: teacherB, fullName: 'Hacked' }));

    expect(update.status).toBe(404);

    const remove = await teacherRoutes.DELETE(new Request(`http://x/api/teachers?id=${teacherB}`));

    expect(remove.status).toBe(404);
  });

  it('whole-school admin sees every campus', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?pageSize=100'));
    const body = await res.json();
    const ids = body.data.map((item: { id: string }) => item.id);
    expect(ids).toContain(teacherA);
    expect(ids).toContain(teacherB);
    expect(body.scope.allBranches).toBe(true);
    expect(body.scope.effectiveBranchId).toBeNull();
  });

  it('selected branch drives list, KPIs, options and export from one scope', async () => {
    await asPrincipal(adminAll, 'school_admin');

    const listRes = await teacherRoutes.GET(new Request(`http://x/api/teachers?branchId=${branchA}&pageSize=100`));
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    const ids = list.data.map((item: { id: string }) => item.id);
    expect(list.scope.effectiveBranchId).toBe(branchA);
    expect(list.scope.allBranches).toBe(false);
    expect(list.scope.branchName).toBe('Campus A');
    expect(ids).toContain(teacherA);
    expect(ids).not.toContain(teacherB);

    // KPI + dossier + workload summary are computed for the SAME branch, not
    // institution-wide.
    const expectedScoped = await db
      .select({ n: count() })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'teacher'), eq(user.branchId, branchA)));
    expect(list.summary.scopedTeachers).toBe(Number(expectedScoped[0]?.n ?? 0));
    expect(list.total).toBe(Number(expectedScoped[0]?.n ?? 0));

    // Filter options are scoped to the branch too.
    const optionsRes = await teacherOptionsRoute.GET(new Request(`http://x/api/teachers/options?branchId=${branchA}`));
    const options = await optionsRes.json();
    expect(options.data.scope.effectiveBranchId).toBe(branchA);
    expect(options.data.branches.map((branch: { id: string }) => branch.id)).toContain(branchA);
    expect(options.data.classes.map((classItem: { id: string }) => classItem.id)).toContain(sectionA1);
    expect(options.data.classes.map((classItem: { id: string }) => classItem.id)).not.toContain(sectionB1);

    // Export uses the same scope: branch A teacher in, branch B teacher out.
    const exportRes = await teacherExportRoute.GET(new Request(`http://x/api/teachers/export?branchId=${branchA}`));
    expect(exportRes.status).toBe(200);
    const csv = await exportRes.text();
    expect(csv).toContain('Aicha Teacher');
    expect(csv).not.toContain('Brahim Teacher');
  });

  it('rejects a branch id that does not belong to the tenant', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request(`http://x/api/teachers?branchId=${crypto.randomUUID()}`));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_BRANCH');
  });

  it('list payload carries no HR-sensitive fields', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?pageSize=100'));
    const body = await res.json();
    const sample = body.data[0];

    expect(sample).not.toHaveProperty('salary');
    expect(sample).not.toHaveProperty('nationalId');
    expect(sample).not.toHaveProperty('dateOfBirth');
    expect(sample).not.toHaveProperty('address');
    expect(sample).not.toHaveProperty('sensitiveHr');
  });

  it('detail redacts HR-sensitive data without hr.sensitive.read and includes it with it', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const { hasCapability } = await import('@/libs/api/permissions');

    vi.mocked(hasCapability).mockResolvedValueOnce(false);
    const redacted = await teacherRoutes.GET(new Request(`http://x/api/teachers?id=${teacherA}`));
    const redactedBody = await redacted.json();

    expect(redactedBody.data.sensitiveRedacted).toBe(true);
    expect(redactedBody.data.sensitiveHr).toBeNull();

    vi.mocked(hasCapability).mockResolvedValueOnce(true);
    const full = await teacherRoutes.GET(new Request(`http://x/api/teachers?id=${teacherA}`));
    const fullBody = await full.json();

    expect(fullBody.data.sensitiveRedacted).toBe(false);
    expect(fullBody.data.sensitiveHr).not.toBeNull();
  });

  it('paginates server-side with a stable order and total', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?page=1&pageSize=2'));
    const body = await res.json();

    expect(body.total).toBeGreaterThanOrEqual(4);
    expect(body.totalPages).toBe(Math.ceil(body.total / 2));
    expect(body.data).toHaveLength(2);

    const names = body.data.map((item: { name: string }) => item.name);

    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it('summary KPIs are independent of the current search filter', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request(`http://x/api/teachers?search=${encodeURIComponent('Clean Teacher')}&pageSize=1`));
    const body = await res.json();

    expect(body.data).toHaveLength(1);
    expect(body.summary.activeTeachers).toBeGreaterThanOrEqual(4);
  });

  it('computes planned workload from the published timetable', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request(`http://x/api/teachers?search=${encodeURIComponent('Aicha Teacher')}`));
    const body = await res.json();

    expect(body.data[0].weeklyScheduledHours).toBe(2);
    expect(body.summary.workload.hasTimetable).toBe(true);
    expect(body.summary.workload.source).toBe('published_timetable');
  });

  it('computes dossier completeness from documents + required profile fields', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?pageSize=100'));
    const body = await res.json();
    const clean = body.data.find((item: { id: string }) => item.id === teacherClean);
    const complete = body.data.find((item: { id: string }) => item.id === teacherComplete);

    expect(clean.dossier.complete).toBe(false);
    expect(clean.dossier.missingItems).toEqual(expect.arrayContaining(['contract', 'cin', 'diploma', 'hireDate', 'specialization']));
    expect(complete.dossier.complete).toBe(true);
    expect(body.summary.dossiers.complete).toBeGreaterThanOrEqual(1);
    expect(body.summary.attention.length).toBeLessThanOrEqual(3);
  });

  it('counts on_leave from the linked HR profile only', async () => {
    await db.insert(employeeProfiles).values({
      tenantId,
      userId: teacherA,
      employeeId: `EMP-HR-${suffix}`,
      firstName: 'Aicha',
      lastName: 'Teacher',
      employmentStatus: 'on_leave',
    });
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.GET(new Request('http://x/api/teachers?pageSize=1'));
    const body = await res.json();

    expect(body.summary.onLeave).toBe(1);
  });

  it('reserves sequential tenant-scoped employee ids', async () => {
    const first = await reserveTeacherEmployeeId(tenantId);
    const second = await reserveTeacherEmployeeId(tenantId);

    expect(first).toMatch(/^EMP-\d{4}-\d{4}$/);
    expect(second).not.toBe(first);
  });

  it('creates a teacher with branch pinning and account provisioning', async () => {
    await asPrincipal(adminA, 'school_admin', branchA);
    const res = await teacherRoutes.POST(jsonRequest('http://x/api/teachers', 'POST', {
      fullName: 'Nouvelle Enseignante',
      email: `nouvelle-${suffix}@t.local`,
      phone: '0612345678',
      specialization: 'Anglais',
    }));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.data.branchId).toBe(branchA);
    expect(body.data.employeeId).toMatch(/^EMP-\d{4}-\d{4}$/);
    expect(body.provisioning.tokenCreated).toBe(true);
    expect(body.provisioning.setupUrl).toContain('/setup-account?token=');

    const tokens = await db.select().from(accountSetupTokens).where(eq(accountSetupTokens.tenantId, tenantId));

    expect(tokens.some(token => token.userId === body.data.id)).toBe(true);
  });

  it('refuses creating a teacher on another campus for a branch-limited admin', async () => {
    await asPrincipal(adminA, 'school_admin', branchA);
    const res = await teacherRoutes.POST(jsonRequest('http://x/api/teachers', 'POST', {
      fullName: 'Cross Campus',
      branchId: branchB,
    }));

    expect(res.status).toBe(403);
  });

  it('refuses duplicate emails instead of creating a second identity', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.POST(jsonRequest('http://x/api/teachers', 'POST', {
      fullName: 'Duplicate Email',
      email: `tch-a-${suffix}@t.local`,
    }));

    expect(res.status).toBe(409);

    const body = await res.json();

    expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('blocks attendance for an ended assignment', async () => {
    await asPrincipal(teacherB, 'teacher', branchB);
    const today = new Date().toISOString().slice(0, 10);
    const res = await attendanceRoutes.POST(jsonRequest('http://x/api/attendance', 'POST', {
      date: today,
      period: 1,
      records: [{ studentId: studentA, status: 'present' }],
    }));

    expect(res.status).toBe(403);

    const sectionsForTeacher = await getTeacherClassSectionIds(tenantId, teacherB);

    expect(sectionsForTeacher).toHaveLength(0);
  });

  it('enforces subject-level grade authorization', async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({ userId: teacherA, tenantId, branchId: branchA, role: 'teacher' } as never);

    const math = await loadScopedMarksheet({ userId: teacherA, tenantId, branchId: branchA, role: 'teacher' } as never, tenantId, mathDefinitionId);

    expect(math?.students.map(student => student.studentId)).toContain(studentA);

    const french = await loadScopedMarksheet({ userId: teacherA, tenantId, branchId: branchA, role: 'teacher' } as never, tenantId, frenchDefinitionId);

    expect(french?.students).toHaveLength(0);

    const res = await gradeEntryRoutes.POST(jsonRequest('http://x/api/academics/grade-entry', 'POST', {
      assessmentDefinitionId: frenchDefinitionId,
      marks: [{ studentId: studentA, rawScore: 12 }],
    }));

    expect(res.status).toBe(403);
  });

  it('blocks cross-branch class assignment', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await classTeachersRoutes.POST(jsonRequest('http://x/api/academics/class-teachers', 'POST', {
      classSectionId: sectionB1,
      teacherId: teacherA, // branch A vs class branch B
    }));

    expect(res.status).toBe(422);

    const body = await res.json();

    expect(body.error.code).toBe('CROSS_BRANCH_ASSIGNMENT');
  });

  it('blocks a teacher mutating another teacher photo', async () => {
    await asPrincipal(teacherA, 'teacher', branchA);
    const form = new FormData();
    form.append('teacherId', teacherB);
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }));
    const res = await photoRoute.POST(new Request('http://x/api/teachers/photo', { method: 'POST', body: form }));

    expect(res.status).toBe(403);
  });

  it('blocks destructive subject reassignment when history exists', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const [assignment] = await db
      .select()
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.teacherId, teacherA)));
    expect(assignment).toBeTruthy();

    const res = await subjectTeachersRoutes.DELETE(new Request(`http://x/api/academics/subject-teachers?id=${assignment!.id}`));
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error.code).toBe('SUBJECT_ASSIGNMENT_HISTORY_MIGRATION_REQUIRED');

    // Nothing may be deleted — the row is the only record of the relationship.
    const [stillThere] = await db.select().from(subjectTeachers).where(eq(subjectTeachers.id, assignment!.id));
    expect(stillThere).toBeTruthy();
  });

  it('allows removing a co-teacher row that leaves the assignment context intact', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const [classSubject] = await db.select().from(classSubjects).where(eq(classSubjects.id, mathClassSubjectId));

    const [coTeacher] = await db
      .insert(subjectTeachers)
      .values({
        tenantId,
        classSectionId: sectionA1,
        subjectId: classSubject!.subjectId,
        classSubjectId: mathClassSubjectId,
        teacherId: teacherComplete,
      })
      .returning();

    const res = await subjectTeachersRoutes.DELETE(new Request(`http://x/api/academics/subject-teachers?id=${coTeacher!.id}`));
    expect(res.status).toBe(200);

    // teacherA's only historical record for the pair is untouched.
    const [primary] = await db
      .select()
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.teacherId, teacherA), eq(subjectTeachers.classSubjectId, mathClassSubjectId)));
    expect(primary).toBeTruthy();
  });

  it('blocks a direct campus change while current assignments exist', async () => {
    await asPrincipal(adminAll, 'school_admin');

    const res = await teacherRoutes.PUT(jsonRequest('http://x/api/teachers', 'PUT', { id: teacherA, branchId: branchB }));
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.error.code).toBe('TEACHER_BRANCH_TRANSFER_REQUIRED');
    expect(body.blockers.length).toBeGreaterThan(0);

    // Nothing moved: branch and assignment untouched.
    const [teacherRow] = await db.select().from(user).where(eq(user.id, teacherA));
    expect(teacherRow!.branchId).toBe(branchA);
    const assignments = await db
      .select()
      .from(classTeachers)
      .where(and(eq(classTeachers.teacherId, teacherA), eq(classTeachers.status, 'active')));
    expect(assignments).toHaveLength(1);
  });

  it('allows an authorized campus change for a teacher with no current assignments', async () => {
    await asPrincipal(adminAll, 'school_admin');

    const res = await teacherRoutes.PUT(jsonRequest('http://x/api/teachers', 'PUT', { id: teacherClean, branchId: branchB }));
    expect(res.status).toBe(200);

    const [teacherRow] = await db.select().from(user).where(eq(user.id, teacherClean));
    expect(teacherRow!.branchId).toBe(branchB);
  });

  it('deactivation closes class assignments, preserves history, and hard delete is refused', async () => {
    await asPrincipal(adminAll, 'school_admin');

    // Seed a graded mark authored by teacherA to prove lifecycle does not erase it.
    await db.insert(assessmentOutcomes).values({
      tenantId,
      assessmentDefinitionId: mathDefinitionId,
      studentId: studentA,
      rawScore: '15.00',
      status: 'graded',
      markerId: teacherA,
    });

    const res = await teacherRoutes.PUT(jsonRequest('http://x/api/teachers', 'PUT', { id: teacherA, status: 'inactive' }));

    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.statusChange.closedClassAssignments).toBe(1);

    const [teacherRow] = await db.select().from(user).where(eq(user.id, teacherA));

    expect(teacherRow!.userStatus).toBe('inactive');

    const closedAssignments = await db.select().from(classTeachers).where(and(eq(classTeachers.teacherId, teacherA), eq(classTeachers.status, 'inactive')));

    expect(closedAssignments).toHaveLength(1);
    expect(closedAssignments[0]!.endsOn).toBeTruthy();

    // subject assignment + grade history survive.
    const subjectRows = await db.select().from(subjectTeachers).where(eq(subjectTeachers.teacherId, teacherA));

    expect(subjectRows.length).toBeGreaterThanOrEqual(1);

    const outcomes = await db.select().from(assessmentOutcomes).where(eq(assessmentOutcomes.markerId, teacherA));

    expect(outcomes).toHaveLength(1);

    const remove = await teacherRoutes.DELETE(new Request(`http://x/api/teachers?id=${teacherA}`));

    expect(remove.status).toBe(409);

    const removeBody = await remove.json();

    expect(removeBody.error.code).toBe('CANNOT_HARD_DELETE');
    expect(removeBody.dependencies.length).toBeGreaterThan(0);

    const [stillThere] = await db.select().from(user).where(eq(user.id, teacherA));

    expect(stillThere).toBeTruthy();
  });

  it('hard deletes a clean record', async () => {
    await asPrincipal(adminAll, 'school_admin');
    const res = await teacherRoutes.DELETE(new Request(`http://x/api/teachers?id=${teacherClean}`));

    expect(res.status).toBe(200);

    const [gone] = await db.select().from(user).where(eq(user.id, teacherClean));

    expect(gone).toBeUndefined();
  });
});
