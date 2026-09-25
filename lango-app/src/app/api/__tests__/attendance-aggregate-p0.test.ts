import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAttendanceAggregate } from '@/libs/api/attendance-aggregate';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceExcuses,
  attendanceSummary,
  branches,
  classes,
  classSections,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// G14 core (Phase 7A) — canonical aggregation:
// G14.1 voided excluded · G14.2 corrected counted once · G14.7 prior session
// excluded · G14.8 zero denominator != 100 · G14.9 unjustified reconciles
// approved excuse · G14.10 late/excused named semantics · G14.12 section scope
// cannot leak foreign rows. Cache (guardian/student source) reconciled.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const d1 = '2026-10-05';
const d2 = '2026-10-06';

let sessionB = '';
let sessionA = '';
let sectionA = '';
let sectionC = '';

describe.skipIf(!dbReachable)('attendance canonical aggregate P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Att Agg ${suffix}`, slug: `att-agg-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `AG-${suffix}` }).returning();
    await db.insert(user).values([
      { id: STUDENT_A, tenantId, branchId: branch!.id, name: 'Student A', email: `agg-a-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branch!.id, name: 'Student B', email: `agg-b-${suffix}@t.local`, role: 'student' },
    ]);
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `1A-${suffix}`, mediumId: medium!.id }).returning();
    const labels = await db.insert(sections).values([
      { tenantId, name: `A-${suffix}` },
      { tenantId, name: `C-${suffix}` },
    ]).returning();
    const csRows = await db.insert(classSections).values([
      { tenantId, classId: cls!.id, sectionId: labels[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: cls!.id, sectionId: labels[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();
    sectionA = csRows[0]!.id;
    sectionC = csRows[1]!.id;

    const years = await db.insert(sessionYears).values([
      { tenantId, name: `2025-2026-${suffix}`, startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-06-30T00:00:00.000Z', isDefault: false },
      { tenantId, name: `2026-2027-${suffix}`, startDate: '2026-09-01T00:00:00.000Z', endDate: '2027-06-30T00:00:00.000Z', isDefault: true },
    ]).returning();
    sessionA = years[0]!.id;
    sessionB = years[1]!.id;

    // Session B fixture (current session).
    await db.insert(attendance).values([
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d1, period: 1, status: 'present', isVoided: false },
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d1, period: 2, status: 'absent', isVoided: false },
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d1, period: 3, status: 'late', isVoided: false },
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d1, period: 4, status: 'excused', isVoided: false },
      // G14.2: one row corrected in place (absent -> present), counted once.
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d1, period: 5, status: 'present', isVoided: false },
      // G14.1: historical voided row — stored, never counted.
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d1, period: 6, status: 'absent', isVoided: true },
      // G14.9: absent mark with an APPROVED excuse matching its exact scope.
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionB, date: d2, period: 7, status: 'absent', isVoided: false },
      // G14.12: foreign-section row (must not leak into section-A scope).
      { tenantId, studentId: STUDENT_A, classSectionId: sectionC, academicYearId: sessionB, date: d1, period: 8, status: 'present', isVoided: false },
      // G14.7: prior-session row — stored, never counted in session B.
      { tenantId, studentId: STUDENT_A, classSectionId: sectionA, academicYearId: sessionA, date: '2026-03-10', period: 1, status: 'absent', isVoided: false },
    ]);
    await db.insert(attendanceExcuses).values({
      tenantId,
      studentId: STUDENT_A,
      classSectionId: sectionA,
      period: 7,
      sessionYearId: sessionB,
      date: d2,
      reason: 'certificat médical',
      status: 'approved',
    });
  });

  afterAll(async () => {
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('G14.1/G14.2/G14.7/G14.9/G14.10/G14.12: canonical aggregate over the deterministic fixture', async () => {
    const scoped = await getAttendanceAggregate({ tenantId, sessionYearId: sessionB, studentId: STUDENT_A, classSectionId: sectionA });

    expect(scoped.presentCount).toBe(2); // p1 + corrected p5 (counted once)
    expect(scoped.absentCount).toBe(2); // p2 + p7
    expect(scoped.lateCount).toBe(1);
    expect(scoped.excusedCount).toBe(1);
    expect(scoped.recordedTotal).toBe(6); // voided p6 + foreign p8 + prior session excluded
    expect(scoped.unjustifiedAbsentCount).toBe(1); // p7 justified by approved excuse
    expect(scoped.presenceRate).toBe(50); // (2+1)/6 — physical presence only, excused excluded

    const unscoped = await getAttendanceAggregate({ tenantId, sessionYearId: sessionB, studentId: STUDENT_A });

    expect(unscoped.recordedTotal).toBe(7); // foreign-section row included here
    expect(unscoped.presenceRate).toBe(57.14); // (3+1)/7
  });

  it('G14.8: zero denominator yields a NULL rate, never 100', async () => {
    const zero = await getAttendanceAggregate({ tenantId, sessionYearId: sessionB, studentId: STUDENT_B });

    expect(zero.recordedTotal).toBe(0);
    expect(zero.presenceRate).toBeNull();
  });

  it('G14.8b: presence rate counts PHYSICAL presence — an excused absence is not attendance', async () => {
    // The product rule, stated once: Present = in the room. Late = in the room.
    // Excused = absent but justified, which is still absent in the room.
    // Counting excused as present inflates the one number a director reads.
    const scoped = await getAttendanceAggregate({ tenantId, sessionYearId: sessionB, studentId: STUDENT_A, classSectionId: sectionA });

    expect(scoped.presentCount + scoped.lateCount).toBe(3);
    expect(scoped.excusedCount).toBe(1);
    expect(scoped.recordedTotal).toBe(6);

    expect(scoped.presenceRate).toBe(50); // 3/6, excused NOT in the numerator
    expect(scoped.presenceRate).not.toBe(
      Number((((scoped.presentCount + scoped.lateCount + scoped.excusedCount) / scoped.recordedTotal) * 100).toFixed(2)),
    );
  });

  it('cache (guardian/student source) reconciles with the canonical aggregate and stores NULL for zero data', async () => {
    const cached = await recalculateStudentAttendanceSummary(tenantId, STUDENT_A);
    const canonical = await getAttendanceAggregate({ tenantId, sessionYearId: sessionB, studentId: STUDENT_A });

    expect(cached!.totalSessions).toBe(canonical.recordedTotal);
    expect(cached!.totalPresent).toBe(canonical.presentCount);
    expect(cached!.totalAbsent).toBe(canonical.absentCount);
    expect(cached!.totalLate).toBe(canonical.lateCount);
    expect(cached!.totalExcused).toBe(canonical.excusedCount);
    expect(Number(cached!.attendanceRate)).toBe(canonical.presenceRate);

    const zeroCached = await recalculateStudentAttendanceSummary(tenantId, STUDENT_B);

    expect(zeroCached!.totalSessions).toBe(0);
    expect(zeroCached!.attendanceRate).toBeNull();
  });
});
