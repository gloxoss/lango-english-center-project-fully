import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as verifyAndStage } from '@/app/api/attendance/qr/verify-and-stage/route';
import { POST as lateComplete } from '@/app/api/attendance/registers/late-complete/route';
import { POST as createException, DELETE as deleteException } from '@/app/api/attendance/session-exceptions/route';
import { attendanceScanEvents } from '@/features/attendance/models/attendance-qr-schema';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { weekdayNameFor } from '@/libs/api/school-day';
import {
  attendance,
  attendanceRegisters,
  branches,
  classScheduleSlots,
  classSections,
  classSessionExceptions,
  classSubjects,
  classes,
  mediums,
  notifications,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

const requestContext = vi.hoisted(() => ({
  userId: '',
  tenantId: '',
  branchId: null as string | null,
  role: 'receptionist' as string,
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({
    userId: requestContext.userId,
    tenantId: requestContext.tenantId,
    branchId: requestContext.branchId,
    role: requestContext.role,
  }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: async () => undefined,
  hasCapability: async () => true,
}));

async function databaseAvailable() {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

describe.skipIf(!available)('IMPL-ATTENDANCE-REFORM-01 Closeout Audit Tests', () => {
  const tenantId = randomUUID();
  const receptionId = `RECEPTION-${tenantId}`;
  const studentId = `STUDENT-${tenantId}`;
  const teacherId = `TEACHER-${tenantId}`;
  const matricule = `MAT-${tenantId.slice(0, 8)}`;
  const today = casablancaTodayIso();

  let branchId = '';
  let classSectionId = '';
  let slotId = '';

  beforeAll(async () => {
    requestContext.tenantId = tenantId;
    requestContext.userId = receptionId;
    requestContext.role = 'receptionist';

    await db.insert(tenants).values({
      id: tenantId,
      name: `Tenant ${tenantId}`,
      slug: `tenant-${tenantId}`,
    });

    const [branch] = await db.insert(branches).values({
      tenantId,
      name: `Branch ${tenantId}`,
      code: `B-${tenantId.slice(0, 6)}`,
    }).returning();
    branchId = branch!.id;

    const [med] = await db.insert(mediums).values({ tenantId, name: `Med-${tenantId}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId, name: `Cls-${tenantId}`, mediumId: med!.id }).returning();
    const [sec] = await db.insert(sections).values({ tenantId, name: `Sec-${tenantId}` }).returning();

    const [cs] = await db.insert(classSections).values({
      tenantId,
      classId: cls!.id,
      sectionId: sec!.id,
      mediumId: med!.id,
      maxStudents: 30,
    }).returning();
    classSectionId = cs!.id;

    await db.insert(user).values([
      {
        id: receptionId,
        tenantId,
        branchId,
        name: 'Reception User',
        email: `reception-${tenantId}@example.com`,
        role: 'receptionist',
      },
      {
        id: teacherId,
        tenantId,
        branchId,
        name: 'Teacher User',
        email: `teacher-${tenantId}@example.com`,
        role: 'teacher',
      },
      {
        id: studentId,
        tenantId,
        branchId,
        name: 'Student User',
        email: `student-${tenantId}@example.com`,
        role: 'student',
        matricule,
        classSectionId,
      },
    ]);

    const [sy] = await db.insert(sessionYears).values({
      tenantId,
      name: `Year ${today.slice(0, 4)}`,
      startDate: `${today.slice(0, 4)}-01-01`,
      endDate: `${today.slice(0, 4)}-12-31`,
    }).returning();

    const [subj] = await db.insert(subjects).values({
      tenantId,
      name: 'Informatique',
      mediumId: med!.id,
      type: 'theory',
    }).returning();

    const [cSubj] = await db.insert(classSubjects).values({
      tenantId,
      classId: cls!.id,
      subjectId: subj!.id,
      type: 'compulsory',
    }).returning();

    const [version] = await db.insert(timetableVersions).values({
      tenantId,
      sessionYearId: sy!.id,
      status: 'published',
      versionNumber: 1,
      effectiveFrom: `${today.slice(0, 4)}-01-01`,
      effectiveTo: `${today.slice(0, 4)}-12-31`,
      createdBy: receptionId,
    }).returning();

    const currentDayOfWeek = weekdayNameFor(today);

    const [slot] = await db.insert(classScheduleSlots).values({
      tenantId,
      classSectionId,
      classSubjectId: cSubj!.id,
      teacherId,
      versionId: version!.id,
      dayOfWeek: currentDayOfWeek,
      startTime: '08:00',
      endTime: '09:00',
      roomLabel: 'Room 101',
    }).returning();
    slotId = slot!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('P0-1: Entrance manual keypad records an arrival with ZERO attendance marks written', async () => {
    const marksBefore = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, studentId)));
    expect(marksBefore[0]!.count).toBe(0);

    const req = new Request('http://localhost/api/attendance/qr/verify-and-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricule }),
    });

    const res = await verifyAndStage(req);
    const json = await res.json();
    if (res.status !== 200) {
      console.log('verifyAndStage failed:', json);
    }
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.student.id).toBe(studentId);
    expect(json.data.resultStatus).toBe('accepted');

    // Attendance mark must STILL be zero
    const marksAfter = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, studentId)));
    expect(marksAfter[0]!.count).toBe(0);

    // Scan event row must exist
    const [scan] = await db
      .select()
      .from(attendanceScanEvents)
      .where(and(eq(attendanceScanEvents.tenantId, tenantId), eq(attendanceScanEvents.studentId, studentId)));
    expect(scan).toBeDefined();
    expect(scan!.resultStatus).toBe('accepted');
    expect(scan!.attendanceRecordId).toBeNull();
  });

  it('P0-4: Late completion allows creating an attendance register for a missed past lesson', async () => {
    requestContext.role = 'school_admin';
    requestContext.userId = receptionId;

    const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const req = new Request('http://localhost/api/attendance/registers/late-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slotId,
        date: pastDate,
        reason: 'Saisie tardive suite à panne réseau',
      }),
    });

    const res = await lateComplete(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe('REOPENED');
    expect(json.data.reopenReason).toContain('Saisie tardive');

    const [reg] = await db
      .select()
      .from(attendanceRegisters)
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classScheduleSlotId, slotId),
        eq(attendanceRegisters.date, pastDate),
      ));
    expect(reg).toBeDefined();
    expect(reg!.status).toBe('REOPENED');
  });

  it('P0-7: Session exceptions trigger notifications for teacher, students, and admins', async () => {
    requestContext.role = 'school_admin';

    const req = new Request('http://localhost/api/attendance/session-exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classScheduleSlotId: slotId,
        date: today,
        type: 'CANCELLED',
        reason: 'Professeur en formation pédagogique',
      }),
    });

    const res = await createException(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.notified.teachers).toBeGreaterThan(0);
    expect(json.notified.students).toBeGreaterThan(0);

    const notifs = await db
      .select()
      .from(notifications)
      .where(eq(notifications.tenantId, tenantId));
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs.some(n => n.template === 'attendance_exception_cancelled')).toBe(true);
  });
});
