import type { RequestContext } from '@/libs/api/context';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/academics/timetable-slots/route';
import { db } from '@/libs/DB';
import {
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  sections,
  sessionYears,
  subjectTeachers,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';
import { apiErrorResponse } from '@/libs/api/errors';
import { eq } from 'drizzle-orm';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5433/schoolos_audit',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

describe('Timetable Double-Booking Exclusion Constraint & Conflict Guards', () => {
  const tenantId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const sessionYearId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const versionBId = crypto.randomUUID();
  const mediumId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const sectionAId = crypto.randomUUID();
  const sectionBId = crypto.randomUUID();
  const classSectionAId = crypto.randomUUID();
  const classSectionBId = crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  const classSubjectId = crypto.randomUUID();

  const teacherAId = `USR-TCH-A-${crypto.randomUUID()}`;
  const teacherBId = `USR-TCH-B-${crypto.randomUUID()}`;
  const adminId = `USR-ADM-${crypto.randomUUID()}`;

  beforeAll(async () => {
    // Seed required tenant & academic structure
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Timetable Constraint Test School',
      slug: `timetable-school-${crypto.randomUUID()}`,
    });

    await db.insert(branches).values({
      id: branchId,
      tenantId,
      name: 'Main Campus',
      code: 'MAIN',
      isDefault: true,
    });

    await db.insert(sessionYears).values({
      id: sessionYearId,
      tenantId,
      name: '2026-2027',
      isDefault: true,
      startDate: '2026-09-01',
      endDate: '2027-06-30',
    });

    await db.insert(user).values([
      {
        id: adminId,
        tenantId,
        email: `admin-${crypto.randomUUID()}@school.ma`,
        name: 'Admin User',
        role: 'school_admin',
        branchId,
      },
      {
        id: teacherAId,
        tenantId,
        email: `teacherA-${crypto.randomUUID()}@school.ma`,
        name: 'Teacher Alpha',
        role: 'teacher',
        branchId,
      },
      {
        id: teacherBId,
        tenantId,
        email: `teacherB-${crypto.randomUUID()}@school.ma`,
        name: 'Teacher Beta',
        role: 'teacher',
        branchId,
      },
    ]);

    await db.insert(timetableVersions).values([
      {
        id: versionId,
        tenantId,
        sessionYearId,
        versionNumber: 1,
        status: 'draft',
        createdBy: adminId,
      },
      {
        id: versionBId,
        tenantId,
        sessionYearId,
        versionNumber: 2,
        status: 'draft',
        createdBy: adminId,
      },
    ]);

    await db.insert(mediums).values({
      id: mediumId,
      tenantId,
      name: 'Bilingual',
    });

    await db.insert(classes).values({
      id: classId,
      tenantId,
      mediumId,
      branchId,
      name: '1ère Bac',
    });

    await db.insert(sections).values([
      { id: sectionAId, tenantId, name: 'Section A' },
      { id: sectionBId, tenantId, name: 'Section B' },
    ]);

    await db.insert(classSections).values([
      { id: classSectionAId, tenantId, classId, sectionId: sectionAId, mediumId },
      { id: classSectionBId, tenantId, classId, sectionId: sectionBId, mediumId },
    ]);

    await db.insert(subjects).values({
      id: subjectId,
      tenantId,
      mediumId,
      name: 'Mathematics',
      code: `MATH-${crypto.randomUUID().slice(0, 6)}`,
      type: 'theory',
    });

    await db.insert(classSubjects).values({
      id: classSubjectId,
      tenantId,
      classId,
      subjectId,
      type: 'compulsory',
    });

    // Assign teachers to class-subjects in both sections
    await db.insert(subjectTeachers).values([
      {
        tenantId,
        classSectionId: classSectionAId,
        subjectId,
        classSubjectId,
        teacherId: teacherAId,
        status: 'active',
      },
      {
        tenantId,
        classSectionId: classSectionBId,
        subjectId,
        classSubjectId,
        teacherId: teacherAId,
        status: 'active',
      },
      {
        tenantId,
        classSectionId: classSectionBId,
        subjectId,
        classSubjectId,
        teacherId: teacherBId,
        status: 'active',
      },
    ]);

    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({
      userId: adminId,
      tenantId,
      role: 'school_admin',
    } as RequestContext);
  });

  afterAll(async () => {
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  function postSlot(slot: {
    classSectionId: string;
    classSubjectId: string;
    teacherId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    versionId?: string | null;
    roomLabel?: string;
  }): Promise<Response> {
    return POST(
      new Request('http://localhost/api/academics/timetable-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slot),
      })
    );
  }

  it('allows back-to-back slots (08:00–09:00 and 09:00–10:00) for the same teacher', async () => {
    const res1 = await postSlot({
      classSectionId: classSectionAId,
      classSubjectId,
      teacherId: teacherAId,
      dayOfWeek: 'monday',
      startTime: '08:00',
      endTime: '09:00',
      versionId,
      roomLabel: 'Room 101',
    });
    expect(res1.status).toBe(201);

    const res2 = await postSlot({
      classSectionId: classSectionBId,
      classSubjectId,
      teacherId: teacherAId,
      dayOfWeek: 'monday',
      startTime: '09:00',
      endTime: '10:00',
      versionId,
      roomLabel: 'Room 102',
    });
    expect(res2.status).toBe(201);
  });

  it('rejects concurrent overlapping slots for the same teacher with exactly one 201 and one 409', async () => {
    // Both try to book teacherA on tuesday 10:00-11:00 (overlapping 10:30-11:30)
    const [res1, res2] = await Promise.all([
      postSlot({
        classSectionId: classSectionAId,
        classSubjectId,
        teacherId: teacherAId,
        dayOfWeek: 'tuesday',
        startTime: '10:00',
        endTime: '11:00',
        versionId,
      }),
      postSlot({
        classSectionId: classSectionBId,
        classSubjectId,
        teacherId: teacherAId,
        dayOfWeek: 'tuesday',
        startTime: '10:30',
        endTime: '11:30',
        versionId,
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failedRes = res1.status === 409 ? res1 : res2;
    const errorJson = await failedRes.json();
    expect(['SCHEDULE_CONFLICT', 'TEACHER_CONFLICT']).toContain(errorJson.error.code);
  });

  it('rejects concurrent overlapping slots for the same class section with exactly one 201 and one 409', async () => {
    // Both try to book sectionB on wednesday 14:00-15:00 with different teachers
    const [res1, res2] = await Promise.all([
      postSlot({
        classSectionId: classSectionBId,
        classSubjectId,
        teacherId: teacherAId,
        dayOfWeek: 'wednesday',
        startTime: '14:00',
        endTime: '15:00',
        versionId,
      }),
      postSlot({
        classSectionId: classSectionBId,
        classSubjectId,
        teacherId: teacherBId,
        dayOfWeek: 'wednesday',
        startTime: '14:15',
        endTime: '15:15',
        versionId,
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const failedRes = res1.status === 409 ? res1 : res2;
    const errorJson = await failedRes.json();
    expect(['SCHEDULE_CONFLICT', 'CLASS_SECTION_CONFLICT']).toContain(errorJson.error.code);
  });

  it('allows same time slots across different timetable versions', async () => {
    const resA = await postSlot({
      classSectionId: classSectionAId,
      classSubjectId,
      teacherId: teacherAId,
      dayOfWeek: 'thursday',
      startTime: '08:00',
      endTime: '09:00',
      versionId,
    });
    expect(resA.status).toBe(201);

    const resB = await postSlot({
      classSectionId: classSectionAId,
      classSubjectId,
      teacherId: teacherAId,
      dayOfWeek: 'thursday',
      startTime: '08:00',
      endTime: '09:00',
      versionId: versionBId,
    });
    expect(resB.status).toBe(201);
  });

  it('maps PostgreSQL 23P01 exclusion violation directly to 409 SCHEDULE_CONFLICT', async () => {
    // Direct DB insertion bypassing assertSlotIsValid to specifically test 23P01 error mapping
    // We already have a slot on thursday 08:00-09:00 for teacherA in versionId.
    // Try inserting an overlapping slot directly via SQL and verify apiErrorResponse handles it
    let caughtErr: unknown;
    try {
      await db.insert(classScheduleSlots).values({
        tenantId,
        versionId,
        classSectionId: classSectionBId,
        classSubjectId,
        teacherId: teacherAId,
        dayOfWeek: 'thursday',
        startTime: '08:30',
        endTime: '09:30',
      });
    } catch (err: unknown) {
      caughtErr = err;
    }
    expect(caughtErr).toBeDefined();
    const res = apiErrorResponse(caughtErr);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('SCHEDULE_CONFLICT');
  });
});
