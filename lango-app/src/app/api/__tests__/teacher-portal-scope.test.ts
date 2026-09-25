import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Teacher-portal scope regression suite.
//
// Covers the AUD-TEACHER-01 invariants:
//   - a teacher reads ranked class results only for the class-subjects they
//     currently teach (the client-supplied classSubjectId was an IDOR);
//   - the class-subject picker is narrowed the same way;
//   - the portal timetable reads the canonical published class_schedule_slots,
//     never the seed-only legacy timetable_slots;
//   - the portal lists every section the teacher actually teaches
//     (subject assignments, not only homeroom rows);
//   - a teacher never receives the school-wide overdue aggregate on the
//     student directory, while finance roles still do.

let currentSessionUserId: string | null = null;

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { casablancaTodayIso } = await import('@/libs/finance/today');
const { weekdayNameFor } = await import('@/libs/api/school-day');
const {
  classScheduleSlots,
  classSections,
  classSubjects,
  classes,
  invoices,
  mediums,
  sections,
  sessionYears,
  subjectTeachers,
  subjects,
  tenants,
  timetableVersions,
  user,
} = await import('@/models/Schema');
const classResultsRoute = await import('@/app/api/academics/class-results/route');
const classSubjectsRoute = await import('@/app/api/academics/class-subjects/route');
const teacherTimetableRoute = await import('@/app/api/teacher/me/timetable/route');
const teacherHomeRoute = await import('@/app/api/teacher/me/home/route');
const studentsRoute = await import('@/app/api/students/route');

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('teacher portal scope', () => {
  const tenantId = crypto.randomUUID();
  const suffix = tenantId.slice(0, 8);

  const teacherOwnId = `USR-TPO-OWN-${suffix}`;
  const teacherForeignId = `USR-TPO-FOREIGN-${suffix}`;
  const adminId = `USR-TPO-ADMIN-${suffix}`;
  const studentId = `USR-TPO-STU-${suffix}`;

  let ownClassSubjectId = '';
  let foreignClassSubjectId = '';
  const todayWeekday = weekdayNameFor(casablancaTodayIso());

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Teacher Portal Test', slug: `tpo-${suffix}` });

    await db.insert(user).values([
      { id: teacherOwnId, tenantId, name: 'Owner Teacher', email: `tpo-own-${suffix}@t.local`, role: 'teacher', userStatus: 'active' },
      { id: teacherForeignId, tenantId, name: 'Foreign Teacher', email: `tpo-foreign-${suffix}@t.local`, role: 'teacher', userStatus: 'active' },
      { id: adminId, tenantId, name: 'Admin', email: `tpo-admin-${suffix}@t.local`, role: 'school_admin', userStatus: 'active' },
      { id: studentId, tenantId, name: 'Student One', email: `tpo-stu-${suffix}@t.local`, role: 'student', userStatus: 'active' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `M-${suffix}` }).returning();
    const [classRow] = await db.insert(classes).values({ tenantId, name: `1A-${suffix}`, mediumId: medium!.id }).returning();
    const [section] = await db.insert(sections).values({ tenantId, name: `S-${suffix}` }).returning();
    const [classSection] = await db.insert(classSections).values({
      tenantId,
      classId: classRow!.id,
      sectionId: section!.id,
      mediumId: medium!.id,
    }).returning();

    await db.update(user).set({ classSectionId: classSection!.id }).where(eq(user.id, studentId));

    const subjectRows = await db.insert(subjects).values([
      { tenantId, name: `SVT-${suffix}`, mediumId: medium!.id, type: 'theory' },
      { tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' },
    ]).returning();

    const classSubjectRows = await db.insert(classSubjects).values([
      { tenantId, classId: classRow!.id, subjectId: subjectRows[0]!.id, type: 'compulsory' },
      { tenantId, classId: classRow!.id, subjectId: subjectRows[1]!.id, type: 'compulsory' },
    ]).returning();
    ownClassSubjectId = classSubjectRows[0]!.id;
    foreignClassSubjectId = classSubjectRows[1]!.id;

    // teacherOwn teaches SVT in the section; teacherForeign teaches Maths.
    await db.insert(subjectTeachers).values([
      { tenantId, classSectionId: classSection!.id, subjectId: subjectRows[0]!.id, classSubjectId: ownClassSubjectId, teacherId: teacherOwnId },
      { tenantId, classSectionId: classSection!.id, subjectId: subjectRows[1]!.id, classSubjectId: foreignClassSubjectId, teacherId: teacherForeignId },
    ]);

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
      createdBy: adminId,
      publishedBy: adminId,
      publishedAt: new Date().toISOString(),
    }).returning();

    // Canonical published slot today at 08:00. Only canonical rows exist: a
    // portal that still read the legacy timetable_slots table would answer
    // empty and fail the assertions below.
    await db.insert(classScheduleSlots).values({
      tenantId,
      classSectionId: classSection!.id,
      classSubjectId: ownClassSubjectId,
      teacherId: teacherOwnId,
      dayOfWeek: todayWeekday as 'monday',
      startTime: '08:00',
      endTime: '09:00',
      roomLabel: 'Salle 1',
      versionId: version!.id,
    });

    // An overdue invoice proves the finance aggregate exists but is gated.
    await db.insert(invoices).values({
      tenantId,
      studentId,
      invoiceNumber: `INV-${suffix}`,
      amount: 1000,
      netAmount: 1000,
      paidAmount: 0,
      status: 'overdue',
      dueDate: '2026-01-01',
    });
  });

  afterAll(async () => {
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('lets a teacher read their own class-subject results', async () => {
    currentSessionUserId = teacherOwnId;
    const res = await classResultsRoute.GET(new Request(`http://x/api/academics/class-results?classSubjectId=${ownClassSubjectId}`));

    expect(res.status).toBe(200);
  });

  it('refuses a teacher reading another teacher class-subject results', async () => {
    currentSessionUserId = teacherOwnId;
    const res = await classResultsRoute.GET(new Request(`http://x/api/academics/class-results?classSubjectId=${foreignClassSubjectId}`));

    expect(res.status).toBe(403);
  });

  it('narrows the class-subject picker to the teacher own subjects', async () => {
    currentSessionUserId = teacherOwnId;
    const res = await classSubjectsRoute.GET(new Request('http://x/api/academics/class-subjects?pageSize=100'));
    const body = await res.json();
    const ids = body.data.map((row: { id: string }) => row.id);

    expect(res.status).toBe(200);
    expect(ids).toContain(ownClassSubjectId);
    expect(ids).not.toContain(foreignClassSubjectId);
  });

  it('serves the canonical timetable and ignores the legacy table', async () => {
    currentSessionUserId = teacherOwnId;
    const res = await teacherTimetableRoute.GET(new Request('http://x/api/teacher/me/timetable'));
    const body = await res.json();
    const slots = body.data.days.flatMap((day: { slots: { startTime: string }[] }) => day.slots);

    expect(res.status).toBe(200);
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe('08:00');
  });

  it('lists subject-assigned sections and today canonical session', async () => {
    currentSessionUserId = teacherOwnId;
    const res = await teacherHomeRoute.GET(new Request('http://x/api/teacher/me/home'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.widgets.myClasses).toBe(1);
    expect(body.data.classes[0].subjects).toContain(`SVT-${suffix}`);
    expect(body.data.today).toHaveLength(1);
    expect(body.data.today[0].room).toBe('Salle 1');
  });

  it('hides the school-wide overdue aggregate from teachers but not admins', async () => {
    currentSessionUserId = teacherOwnId;
    const teacherRes = await studentsRoute.GET(new Request('http://x/api/students?pageSize=5'));
    const teacherBody = await teacherRes.json();

    expect(teacherRes.status).toBe(200);
    expect(teacherBody.stats.totalOverdueMAD).toBe(0);
    expect(teacherBody.stats.overdueStudentsCount).toBe(0);

    currentSessionUserId = adminId;
    const adminRes = await studentsRoute.GET(new Request('http://x/api/students?pageSize=5'));
    const adminBody = await adminRes.json();

    expect(adminRes.status).toBe(200);
    expect(adminBody.stats.totalOverdueMAD).toBe(1000);
  });
});
