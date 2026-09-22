import type { RequestContext } from '@/libs/api/context';
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as copySession } from '@/app/api/academics/class-offerings/copy/route';
import { db } from '@/libs/DB';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import {
  academicClassOfferings,
  attendance,
  auditLogs,
  branches,
  classes,
  classSections,
  classSubjects,
  classTeachers,
  mediums,
  sections,
  sessionYears,
  studentPlacements,
  subjects,
  subjectTeachers,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed proof for GROUP 7 — session copy.
//
// Copies: offerings, curriculum (coefficient/weeklyMinutes/displayOrder/
// curriculumLabel/passThreshold/isActive), current teacher assignments scoped
// to the TARGET session year, branch ownership (class/section unchanged).
// Excludes: placements, attendance, marks, historical closed assignments.
// Duplicate copy is idempotent per key and dedup-safe per different key.

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

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

// NOTE: the audit module is intentionally NOT mocked here — the copy route's
// idempotency key is stored in audit_logs, so the real writer must run.

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const ADMIN = `USR-COPY-${suffix}`;
const TEACHER_PRIMARY = `USR-COPY-P-${suffix}`;
const TEACHER_SUB = `USR-COPY-S-${suffix}`;
const TEACHER_HISTORICAL = `USR-COPY-H-${suffix}`;
const TEACHER_TARGET = `USR-COPY-T-${suffix}`;

let sourceYear = '';
let targetYear = '';
let classId = '';
let classSectionId = '';
let sourceOfferingId = '';
let targetOfferingId = '';
let sourceClassSubjectId = '';
let sourceSubjectTeacherId = '';
let studentId = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId: ADMIN, tenantId, role: 'school_admin', branchId: null } as RequestContext);
}

function copyRequest(body: unknown): Request {
  return new Request('http://x/api/academics/class-offerings/copy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

async function tableCounts() {
  const [offerings] = await db.select({ n: count() }).from(academicClassOfferings).where(eq(academicClassOfferings.tenantId, tenantId));
  const [subjectsCount] = await db.select({ n: count() }).from(classSubjects).where(eq(classSubjects.tenantId, tenantId));
  const [classTeachersCount] = await db.select({ n: count() }).from(classTeachers).where(eq(classTeachers.tenantId, tenantId));
  const [subjectTeachersCount] = await db.select({ n: count() }).from(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
  const [placements] = await db.select({ n: count() }).from(studentPlacements).where(eq(studentPlacements.tenantId, tenantId));
  const [attendanceRows] = await db.select({ n: count() }).from(attendance).where(eq(attendance.tenantId, tenantId));
  return {
    offerings: Number(offerings!.n),
    classSubjects: Number(subjectsCount!.n),
    classTeachers: Number(classTeachersCount!.n),
    subjectTeachers: Number(subjectTeachersCount!.n),
    placements: Number(placements!.n),
    attendance: Number(attendanceRows!.n),
  };
}

describe.skipIf(!dbReachable)('session copy P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `P0 Copy ${suffix}`, slug: `p0-copy-${suffix}` });

    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `CP-${suffix}` }).returning();
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();

    const yearRows = await db.insert(sessionYears).values([
      { tenantId, name: `2026-2027-${suffix}`, startDate: '2026-09-01T00:00:00.000Z', endDate: '2027-06-30T00:00:00.000Z', isDefault: true },
      { tenantId, name: `2027-2028-${suffix}`, startDate: '2027-09-01T00:00:00.000Z', endDate: '2028-06-30T00:00:00.000Z', isDefault: false },
    ]).returning();
    sourceYear = yearRows[0]!.id;
    targetYear = yearRows[1]!.id;

    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: null, name: 'Admin', email: `copy-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER_PRIMARY, tenantId, branchId: branch!.id, name: 'Primary', email: `copyp-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_SUB, tenantId, branchId: branch!.id, name: 'Substitute', email: `copys-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_HISTORICAL, tenantId, branchId: branch!.id, name: 'Historical', email: `copyh-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_TARGET, tenantId, branchId: branch!.id, name: 'Target Primary', email: `copyt-${suffix}@t.local`, role: 'teacher' },
      { id: studentId = crypto.randomUUID(), tenantId, branchId: branch!.id, name: 'Student', email: `copyst-${suffix}@t.local`, role: 'student' },
    ]);

    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `2nde-${suffix}`, mediumId: medium!.id }).returning();
    classId = cls!.id;
    const [label] = await db.insert(sections).values({ tenantId, name: `A-${suffix}` }).returning();
    const [classSection] = await db.insert(classSections).values({ tenantId, classId, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    classSectionId = classSection!.id;

    const [subject] = await db.insert(subjects).values({ tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();

    const [sourceOffering] = await db.insert(academicClassOfferings).values({
      tenantId,
      sessionYearId: sourceYear,
      classId,
      sectionId: label!.id,
      capacity: 30,
      status: 'active',
      displayOrder: 1,
    }).returning();
    sourceOfferingId = sourceOffering!.id;

    const [targetOffering] = await db.insert(academicClassOfferings).values({
      tenantId,
      sessionYearId: targetYear,
      classId,
      sectionId: label!.id,
      capacity: 25,
      status: 'active',
      displayOrder: 1,
    }).returning();
    targetOfferingId = targetOffering!.id;

    const [sourceClassSubject] = await db.insert(classSubjects).values({
      tenantId,
      classId,
      subjectId: subject!.id,
      type: 'compulsory',
      offeringId: sourceOfferingId,
      coefficient: '4.00',
      weeklyMinutes: 180,
      displayOrder: 3,
      curriculumLabel: `Programme-${suffix}`,
      passThreshold: '10.00',
      isActive: true,
    }).returning();
    sourceClassSubjectId = sourceClassSubject!.id;

    await db.insert(classTeachers).values([
      { tenantId, classSectionId, teacherId: TEACHER_PRIMARY, offeringId: sourceOfferingId, role: 'primary', startsOn: '2026-09-01', status: 'active' },
      { tenantId, classSectionId, teacherId: TEACHER_SUB, offeringId: sourceOfferingId, role: 'substitute', startsOn: '2026-09-01', status: 'active' },
      { tenantId, classSectionId, teacherId: TEACHER_HISTORICAL, offeringId: sourceOfferingId, role: 'primary', startsOn: '2025-09-01', endsOn: '2026-06-30', status: 'inactive' },
      { tenantId, classSectionId, teacherId: TEACHER_TARGET, offeringId: targetOfferingId, role: 'primary', startsOn: '2027-09-01', status: 'active' },
    ]);

    const [sourceSubjectTeacher] = await db.insert(subjectTeachers).values({
      tenantId,
      classSectionId,
      subjectId: subject!.id,
      classSubjectId: sourceClassSubjectId,
      teacherId: TEACHER_SUB,
      offeringId: sourceOfferingId,
      sessionYearId: sourceYear,
      startsOn: '2026-09-01',
      status: 'active',
    }).returning();
    sourceSubjectTeacherId = sourceSubjectTeacher!.id;

    await db.insert(subjectTeachers).values({
      tenantId,
      classSectionId,
      subjectId: subject!.id,
      classSubjectId: sourceClassSubjectId,
      teacherId: TEACHER_HISTORICAL,
      offeringId: sourceOfferingId,
      sessionYearId: sourceYear,
      startsOn: '2025-09-01',
      endsOn: '2026-06-30',
      status: 'inactive',
    });

    // Noise that must NOT be copied.
    await recordStudentPlacement({ tenantId, studentId, sessionYearId: sourceYear, classSectionId });
    await db.insert(attendance).values({
      tenantId,
      studentId,
      classSectionId,
      studentGroupId: classId,
      period: 1,
      date: '2026-10-05',
      status: 'present',
      isVoided: false,
    });
  });

  beforeEach(async () => {
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(academicClassOfferings).where(eq(academicClassOfferings.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('preview reports source and destination expectations without writing', async () => {
    const before = await tableCounts();

    const res = await copySession(copyRequest({
      sourceSessionYearId: sourceYear,
      targetSessionYearId: targetYear,
      mode: 'preview',
    }));

    expect(res.status).toBe(200);

    const body = await bodyOf(res);

    expect(body.summary.sourceOfferingsCount).toBe(1);
    expect(body.summary.offeringsToCreateCount).toBe(0);
    expect(body.summary.classSubjectsToCreateCount).toBe(1);
    expect(body.summary.classTeachersToCreateCount).toBe(2);
    expect(body.summary.subjectTeachersToCreateCount).toBe(1);

    const after = await tableCounts();

    expect(after).toEqual(before);
  });

  it('commit copies curriculum and current assignments with target-session semantics, excludes history and operational data', async () => {
    const before = await tableCounts();

    const res = await copySession(copyRequest({
      sourceSessionYearId: sourceYear,
      targetSessionYearId: targetYear,
      mode: 'commit',
      idempotencyKey: 'copy-key-1',
    }));

    expect(res.status).toBe(200);

    const body = await bodyOf(res);
    const summary = body.data;

    const after = await tableCounts();
    // eslint-disable-next-line no-console
    console.log('[G7] source vs destination counts', { before, after, summary });

    // Offerings: target already existed -> skipped, never duplicated.
    expect(summary.offeringsCreated).toBe(0);
    expect(summary.offeringsSkipped).toBe(1);
    expect(after.offerings).toBe(before.offerings);

    // Curriculum configuration copied to the TARGET offering.
    expect(summary.classSubjectsCreated).toBe(1);

    const [targetCs] = await db
      .select()
      .from(classSubjects)
      .where(and(eq(classSubjects.offeringId, targetOfferingId), eq(classSubjects.tenantId, tenantId)));

    expect(targetCs).toBeTruthy();
    expect(targetCs!.id).not.toBe(sourceClassSubjectId);
    expect(Number(targetCs!.coefficient)).toBe(4);
    expect(targetCs!.weeklyMinutes).toBe(180);
    expect(targetCs!.displayOrder).toBe(3);
    expect(targetCs!.curriculumLabel).toBe(`Programme-${suffix}`);
    expect(Number(targetCs!.passThreshold)).toBe(10);

    // classTeachers: substitute copied; primary conflict reported, not silently replaced.
    expect(summary.classTeachersCreated).toBe(1);
    expect(summary.warnings.length).toBeGreaterThanOrEqual(1);

    const targetTeachers = await db
      .select({ teacherId: classTeachers.teacherId, role: classTeachers.role, status: classTeachers.status })
      .from(classTeachers)
      .where(and(eq(classTeachers.offeringId, targetOfferingId), eq(classTeachers.status, 'active')));

    expect(targetTeachers.filter(t => t.role === 'primary')).toHaveLength(1);
    expect(targetTeachers.find(t => t.role === 'primary')!.teacherId).toBe(TEACHER_TARGET);
    expect(targetTeachers.some(t => t.teacherId === TEACHER_SUB)).toBe(true);
    expect(targetTeachers.some(t => t.teacherId === TEACHER_HISTORICAL)).toBe(false);

    // subjectTeachers: target session year, target classSubject, new identity.
    expect(summary.subjectTeachersCreated).toBe(1);

    const targetSt = await db
      .select()
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.offeringId, targetOfferingId), eq(subjectTeachers.tenantId, tenantId)));

    expect(targetSt).toHaveLength(1);
    expect(targetSt[0]!.id).not.toBe(sourceSubjectTeacherId);
    expect(targetSt[0]!.sessionYearId).toBe(targetYear);
    expect(targetSt[0]!.status).toBe('active');
    expect(targetSt[0]!.classSubjectId).toBe(targetCs!.id);
    expect(targetSt[0]!.teacherId).toBe(TEACHER_SUB);
    expect(targetSt[0]!.endsOn).toBeNull();

    // Historical closed rows are NOT reactivated anywhere.
    const historicalActive = await db
      .select({ n: count() })
      .from(subjectTeachers)
      .where(and(
        eq(subjectTeachers.tenantId, tenantId),
        eq(subjectTeachers.teacherId, TEACHER_HISTORICAL),
        eq(subjectTeachers.status, 'active'),
      ));

    expect(Number(historicalActive[0]!.n)).toBe(0);

    // Exclusions: placements and attendance untouched.
    expect(after.placements).toBe(before.placements);
    expect(after.attendance).toBe(before.attendance);

    // Branch ownership: target offering points at the same branch-owned class.
    const [targetOffering] = await db.select({ classId: academicClassOfferings.classId }).from(academicClassOfferings).where(eq(academicClassOfferings.id, targetOfferingId));
    const [cls] = await db.select({ branchId: classes.branchId }).from(classes).where(eq(classes.id, targetOffering!.classId));

    expect(targetOffering!.classId).toBe(classId);
    expect(cls!.branchId).not.toBeNull();

    // Source rows untouched.
    const [sourceSt] = await db.select({ status: subjectTeachers.status }).from(subjectTeachers).where(eq(subjectTeachers.id, sourceSubjectTeacherId));

    expect(sourceSt!.status).toBe('active');
  });

  it('re-running commit with the same idempotency key is a no-op', async () => {
    const before = await tableCounts();

    const res = await copySession(copyRequest({
      sourceSessionYearId: sourceYear,
      targetSessionYearId: targetYear,
      mode: 'commit',
      idempotencyKey: 'copy-key-1',
    }));

    expect(res.status).toBe(200);

    const body = await bodyOf(res);

    expect(body.idempotent).toBe(true);

    const after = await tableCounts();

    expect(after).toEqual(before);
  });

  it('re-running commit with a different key never duplicates rows', async () => {
    const before = await tableCounts();

    const res = await copySession(copyRequest({
      sourceSessionYearId: sourceYear,
      targetSessionYearId: targetYear,
      mode: 'commit',
      idempotencyKey: 'copy-key-2',
    }));

    expect(res.status).toBe(200);

    const body = await bodyOf(res);

    expect(body.data.offeringsCreated).toBe(0);
    expect(body.data.classSubjectsCreated).toBe(0);
    expect(body.data.subjectTeachersCreated).toBe(0);

    const after = await tableCounts();

    expect(after).toEqual(before);
  });

  it('rejects an invalid source/target pair before writing anything', async () => {
    const before = await tableCounts();

    const res = await copySession(copyRequest({
      sourceSessionYearId: sourceYear,
      targetSessionYearId: sourceYear,
      mode: 'commit',
      idempotencyKey: 'copy-key-3',
    }));

    expect(res.status).toBe(422);

    const after = await tableCounts();

    expect(after).toEqual(before);
  });
});
