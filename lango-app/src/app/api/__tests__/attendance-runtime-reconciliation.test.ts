import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getAttendanceAggregate } from '@/libs/api/attendance-aggregate';
import { recalculateStudentAttendanceSummary } from '@/libs/api/attendance-summary';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceExcuses,
  attendanceFlags,
  attendanceRegisters,
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

// RUNTIME DB RECONCILIATION — one deterministic fixture reconciles raw rows,
// registers, the canonical aggregate, the summary cache and flags across two
// tenants, two sessions and multiple sections. Invariants: no cross-tenant or
// cross-session leakage, no voided inflation, no fake 100, no duplicate active
// marks, and no raw absent counted unjustified when an exact approved excuse
// exists.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const T1 = crypto.randomUUID();
const T2 = crypto.randomUUID();
const ADMIN = `REC-ADMIN-${suffix}`;
const SA = crypto.randomUUID();
const SB = crypto.randomUUID();
const SC = crypto.randomUUID();
const SD = crypto.randomUUID();
const T2_STUDENT = crypto.randomUUID();
const date = '2026-10-06';
const priorDate = '2026-03-10';

let t1SectionA = '';
let t1SectionB = '';
let t1CurrentSession = '';
let t1PriorSession = '';
let t2Section = '';
let t2Session = '';

async function provisionTenant(tenantId: string, name: string) {
  await db.insert(tenants).values({ id: tenantId, name: `${name}-${suffix}`, slug: `${name}-${suffix}` });
  const [branch] = await db.insert(branches).values({ tenantId, name: `Campus-${suffix}`, code: `RC-${suffix}-${tenantId.slice(0, 4)}` }).returning();
  const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
  const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `RC1-${suffix}`, mediumId: medium!.id }).returning();
  const labels = await db.insert(sections).values([
    { tenantId, name: `A-${suffix}` },
    { tenantId, name: `B-${suffix}` },
  ]).returning();
  const csRows = await db.insert(classSections).values([
    { tenantId, classId: cls!.id, sectionId: labels[0]!.id, mediumId: medium!.id, maxStudents: 30 },
    { tenantId, classId: cls!.id, sectionId: labels[1]!.id, mediumId: medium!.id, maxStudents: 30 },
  ]).returning();
  const sessions = await db.insert(sessionYears).values([
    { tenantId, name: `2025-2026-${suffix}`, startDate: '2025-09-01', endDate: '2026-06-30', isDefault: false },
    { tenantId, name: `2026-2027-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true },
  ]).returning();
  return { classId: cls!.id, sectionA: csRows[0]!.id, sectionB: csRows[1]!.id, priorSession: sessions[0]!.id, currentSession: sessions[1]!.id, branchId: branch!.id };
}

describe.skipIf(!dbReachable)('attendance runtime DB reconciliation — DB-backed', () => {
  beforeAll(async () => {
    const t1 = await provisionTenant(T1, 'rec-one');
    t1SectionA = t1.sectionA;
    t1SectionB = t1.sectionB;
    t1CurrentSession = t1.currentSession;
    t1PriorSession = t1.priorSession;

    const t2 = await provisionTenant(T2, 'rec-two');
    t2Section = t2.sectionA;
    t2Session = t2.currentSession;

    await db.insert(user).values([
      { id: ADMIN, tenantId: T1, branchId: t1.branchId, name: 'Rec Admin', email: `rec-admin-${suffix}@t.local`, role: 'school_admin' },
      { id: SA, tenantId: T1, branchId: t1.branchId, name: 'Rec SA', email: `rec-sa-${suffix}@t.local`, role: 'student', classSectionId: t1SectionA },
      { id: SB, tenantId: T1, branchId: t1.branchId, name: 'Rec SB', email: `rec-sb-${suffix}@t.local`, role: 'student', classSectionId: t1SectionA },
      { id: SC, tenantId: T1, branchId: t1.branchId, name: 'Rec SC', email: `rec-sc-${suffix}@t.local`, role: 'student', classSectionId: t1SectionB },
      { id: SD, tenantId: T1, branchId: t1.branchId, name: 'Rec SD', email: `rec-sd-${suffix}@t.local`, role: 'student', classSectionId: t1SectionA },
      { id: T2_STUDENT, tenantId: T2, branchId: t2.branchId, name: 'Rec T2', email: `rec-t2-${suffix}@t.local`, role: 'student', classSectionId: t2Section },
    ]);

    const mark = (studentId: string, d: string, period: number, status: 'present' | 'late' | 'absent' | 'excused', sessionId: string, sectionId: string, isVoided = false) => ({
      tenantId: T1,
      studentId,
      classSectionId: sectionId,
      academicYearId: sessionId,
      date: d,
      period,
      status,
      isVoided,
    });

    // SA — rich current-session fixture.
    await db.insert(attendance).values([
      mark(SA, date, 1, 'present', t1CurrentSession, t1SectionA),
      mark(SA, date, 2, 'late', t1CurrentSession, t1SectionA),
      mark(SA, date, 3, 'excused', t1CurrentSession, t1SectionA),
      mark(SA, date, 4, 'absent', t1CurrentSession, t1SectionA),
      // Corrected in place: absent -> present (same row, counted once).
      mark(SA, date, 5, 'absent', t1CurrentSession, t1SectionA),
      // Voided historical row — stored, never counted.
      mark(SA, date, 6, 'absent', t1CurrentSession, t1SectionA, true),
    ]);
    await db.update(attendance)
      .set({ status: 'present', updatedAt: new Date().toISOString() })
      .where(and(eq(attendance.tenantId, T1), eq(attendance.studentId, SA), eq(attendance.period, 5), eq(attendance.date, date)));

    // SC — prior-session mark only (never counted by current-session truth).
    await db.insert(attendance).values([
      mark(SC, priorDate, 1, 'absent', t1PriorSession, t1SectionB),
    ]);

    // SD — absent with an approved excuse covering the exact scope.
    await db.insert(attendance).values([
      mark(SD, date, 1, 'absent', t1CurrentSession, t1SectionA),
    ]);
    await db.insert(attendanceExcuses).values({
      tenantId: T1,
      studentId: SD,
      classSectionId: t1SectionA,
      period: 1,
      sessionYearId: t1CurrentSession,
      date,
      reason: 'certificat médical',
      status: 'approved',
    });

    // T2 — a foreign-tenant mark that must never surface in T1 truth.
    await db.insert(attendance).values({
      tenantId: T2,
      studentId: T2_STUDENT,
      classSectionId: t2Section,
      academicYearId: t2Session,
      date,
      period: 1,
      status: 'present',
      isVoided: false,
    });

    // Registers: one LOCKED, one REOPENED (lifecycle states coexist).
    const [t1ClassRow] = await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, t1SectionA)).limit(1);
    await db.insert(attendanceRegisters).values([
      {
        tenantId: T1,
        classId: t1ClassRow!.classId,
        classSectionId: t1SectionA,
        sessionYearId: t1CurrentSession,
        date,
        period: 1,
        reference: `REC-LOCK-${suffix}`,
        status: 'LOCKED',
        submittedAt: new Date().toISOString(),
        submittedById: ADMIN,
      },
      {
        tenantId: T1,
        classId: t1ClassRow!.classId,
        classSectionId: t1SectionA,
        sessionYearId: t1CurrentSession,
        date,
        period: 2,
        reference: `REC-REOPEN-${suffix}`,
        status: 'REOPENED',
        submittedAt: new Date().toISOString(),
        submittedById: ADMIN,
        reopenedAt: new Date().toISOString(),
        reopenReason: 'correction demandée',
      },
    ]);

    // Canonical caches for the reconciliation consumers.
    await recalculateStudentAttendanceSummary(T1, SA);
    await recalculateStudentAttendanceSummary(T1, SB);
    await recalculateStudentAttendanceSummary(T1, SC);
    await recalculateStudentAttendanceSummary(T1, SD);
  });

  afterAll(async () => {
    for (const tenantId of [T1, T2]) {
      await db.delete(attendanceFlags).where(eq(attendanceFlags.tenantId, tenantId));
      await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
      await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, tenantId));
      await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
      await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
      await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
      await db.delete(user).where(eq(user.tenantId, tenantId));
      await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
      await db.delete(classes).where(eq(classes.tenantId, tenantId));
      await db.delete(sections).where(eq(sections.tenantId, tenantId));
      await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
      await db.delete(branches).where(eq(branches.tenantId, tenantId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
  });

  it('R1: raw rows reconcile exactly with the canonical aggregate (corrections once, voided excluded)', async () => {
    const aggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SA });

    expect(aggregate.presentCount).toBe(2); // period 1 + corrected period 5
    expect(aggregate.lateCount).toBe(1);
    expect(aggregate.excusedCount).toBe(1);
    expect(aggregate.absentCount).toBe(1);
    expect(aggregate.recordedTotal).toBe(5); // voided period 6 never counts
    expect(aggregate.presenceRate).toBe(60); // (2+1)/5 — physical presence only, excused excluded

    const rawActive = await db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, T1),
        eq(attendance.studentId, SA),
        eq(attendance.academicYearId, t1CurrentSession),
        eq(attendance.isVoided, false),
      ));

    expect(rawActive).toHaveLength(5); // raw eligible set == aggregate denominator
  });

  it('R2: summary cache matches the aggregate exactly', async () => {
    const aggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SA });
    const [cache] = await db
      .select()
      .from(attendanceSummary)
      .where(and(eq(attendanceSummary.tenantId, T1), eq(attendanceSummary.studentId, SA)));

    expect(cache!.totalPresent).toBe(aggregate.presentCount);
    expect(cache!.totalLate).toBe(aggregate.lateCount);
    expect(cache!.totalExcused).toBe(aggregate.excusedCount);
    expect(cache!.totalAbsent).toBe(aggregate.absentCount);
    expect(cache!.totalSessions).toBe(aggregate.recordedTotal);
    expect(Number(cache!.attendanceRate)).toBe(aggregate.presenceRate);
  });

  it('R3: no cross-tenant leakage in aggregates, caches or flags', async () => {
    const t1Aggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: T2_STUDENT });

    expect(t1Aggregate.recordedTotal).toBe(0); // T2's mark is invisible to T1

    const t2Aggregate = await getAttendanceAggregate({ tenantId: T2, sessionYearId: t2Session, studentId: T2_STUDENT });

    expect(t2Aggregate.recordedTotal).toBe(1);
    expect(t2Aggregate.presentCount).toBe(1);

    const foreignFlags = await db.select({ id: attendanceFlags.id }).from(attendanceFlags).where(eq(attendanceFlags.tenantId, T2));

    expect(foreignFlags).toHaveLength(0);
  });

  it('R4: no cross-session leakage (prior-session marks stay out of current truth)', async () => {
    const current = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SC });

    expect(current.recordedTotal).toBe(0);
    expect(current.presenceRate).toBeNull();

    const prior = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1PriorSession, studentId: SC });

    expect(prior.recordedTotal).toBe(1);
    expect(prior.absentCount).toBe(1);
  });

  it('R5: zero-data student is NULL everywhere — never a fake 100', async () => {
    const aggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SB });

    expect(aggregate.recordedTotal).toBe(0);
    expect(aggregate.presenceRate).toBeNull();

    const [cache] = await db
      .select()
      .from(attendanceSummary)
      .where(and(eq(attendanceSummary.tenantId, T1), eq(attendanceSummary.studentId, SB)));

    expect(cache!.totalSessions).toBe(0);
    expect(cache!.attendanceRate).toBeNull();
  });

  it('R6: one active mark per (student, session, date, period, section) — duplicates are refused', async () => {
    let duplicateRejected = false;
    try {
      await db.insert(attendance).values({
        tenantId: T1,
        studentId: SA,
        classSectionId: t1SectionA,
        academicYearId: t1CurrentSession,
        date,
        period: 1,
        status: 'absent',
        isVoided: false,
      });
    } catch {
      duplicateRejected = true;
    }

    expect(duplicateRejected).toBe(true);

    const period1 = await db
      .select({ id: attendance.id })
      .from(attendance)
      .where(and(
        eq(attendance.tenantId, T1),
        eq(attendance.studentId, SA),
        eq(attendance.academicYearId, t1CurrentSession),
        eq(attendance.date, date),
        eq(attendance.period, 1),
        eq(attendance.isVoided, false),
      ));

    expect(period1).toHaveLength(1);
  });

  it('R7: an exact-scope approved excuse makes the raw absent justified', async () => {
    const aggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SD });

    expect(aggregate.absentCount).toBe(1); // raw absent remains a stored fact
    expect(aggregate.unjustifiedAbsentCount).toBe(0); // but it is justified

    const saAggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SA });

    expect(saAggregate.absentCount).toBe(1);
    expect(saAggregate.unjustifiedAbsentCount).toBe(1); // no excuse covers it
  });

  it('R8: register lifecycle states coexist truthfully (locked + reopened, no data distortion)', async () => {
    const registers = await db
      .select({ reference: attendanceRegisters.reference, status: attendanceRegisters.status })
      .from(attendanceRegisters)
      .where(and(eq(attendanceRegisters.tenantId, T1), eq(attendanceRegisters.date, date)));
    const byRef = new Map(registers.map(r => [r.reference, r.status]));

    expect(byRef.get(`REC-LOCK-${suffix}`)).toBe('LOCKED');
    expect(byRef.get(`REC-REOPEN-${suffix}`)).toBe('REOPENED');

    // Register state never changes the eligible mark set.
    const aggregate = await getAttendanceAggregate({ tenantId: T1, sessionYearId: t1CurrentSession, studentId: SA });

    expect(aggregate.recordedTotal).toBe(5);
  });
});
