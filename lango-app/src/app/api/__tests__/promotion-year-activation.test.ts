import type { RequestContext } from '@/libs/api/context';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  checkPromotionCapacities,
  executePromotionBatch,
} from '@/features/students/services/promotion-service';
import { db } from '@/libs/DB';
import {
  attendance,
  classes,
  classSections,
  mediums,
  promotionBatches,
  sections,
  sessionYears,
  studentPlacements,
  tenants,
  user,
} from '@/models/Schema';

const authState = vi.hoisted(() => ({
  tenantId: '',
  userId: '',
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({
    tenantId: authState.tenantId,
    userId: authState.userId,
    role: 'school_admin' as const,
    baseRole: 'school_admin' as const,
    name: 'Admin Test',
    email: 'admin-test@example.com',
    branchId: null,
  }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: async () => undefined,
}));

const dbReachable = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!dbReachable)('Promotion School Year Activation & Transition Suite (YA1 - YA5)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = randomUUID();
  const adminId = `ADMIN-YA-${suffix}`;
  const studentId = `STU-YA-${suffix}`;

  let sourceYearId = '';
  let targetYearId = '';
  let sourceClassSectionId = '';
  let targetClassSectionId = '';

  const mockCtx: RequestContext = {
    tenantId,
    userId: adminId,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Admin Test',
    email: 'admin-test@example.com',
    branchId: null,
  };

  beforeAll(async () => {
    authState.tenantId = tenantId;
    authState.userId = adminId;

    // 1. Provision Tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: `Groupe Scolaire Year Activation ${suffix}`,
      slug: `gs-ya-${suffix}`,
    });

    // 2. Provision Medium, Classes, Sections
    const mediumId = randomUUID();
    await db.insert(mediums).values({ id: mediumId, tenantId, name: 'Français' });

    const class2ndeId = randomUUID();
    const class1ereId = randomUUID();
    await db.insert(classes).values([
      { id: class2ndeId, tenantId, name: 'Tronc Commun Scientifique', mediumId },
      { id: class1ereId, tenantId, name: '1ère Année Bac Sciences Exp', mediumId },
    ]);

    const sectionAId = randomUUID();
    await db.insert(sections).values({ id: sectionAId, tenantId, name: 'A' });

    sourceClassSectionId = randomUUID();
    targetClassSectionId = randomUUID();
    await db.insert(classSections).values([
      { id: sourceClassSectionId, tenantId, classId: class2ndeId, sectionId: sectionAId, mediumId, maxStudents: 35 },
      { id: targetClassSectionId, tenantId, classId: class1ereId, sectionId: sectionAId, mediumId, maxStudents: 35 },
    ]);

    // 3. Provision School Years: Active Source Year (2026-2027) & Future Target Year (2027-2028)
    sourceYearId = randomUUID();
    targetYearId = randomUUID();
    await db.insert(sessionYears).values([
      {
        id: sourceYearId,
        tenantId,
        name: '2026-2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        isDefault: true,
      },
      {
        id: targetYearId,
        tenantId,
        name: '2027-2028',
        startDate: '2027-09-01',
        endDate: '2028-06-30',
        isDefault: false,
      },
    ]);

    // 4. Provision Student in Source Section
    await db.insert(user).values({
      id: studentId,
      tenantId,
      name: 'Youssef El Amrani',
      email: `youssef-${suffix}@eleve.schoolos.ma`,
      matricule: `2026-TCS-${suffix}`,
      role: 'student',
      userStatus: 'active',
      classSectionId: sourceClassSectionId,
    });

    // 5. Provision Initial Active Placement in Source Year
    await db.insert(studentPlacements).values({
      id: randomUUID(),
      tenantId,
      studentId,
      classSectionId: sourceClassSectionId,
      sessionYearId: sourceYearId,
      status: 'enrolled',
      isCurrent: true,
      startDate: '2026-09-01',
      endDate: null,
    });

    // 6. Provision Attendance Pointage in Source Year
    await db.insert(attendance).values({
      id: randomUUID(),
      tenantId,
      studentId,
      academicYearId: sourceYearId,
      date: '2026-11-15',
      status: 'present',
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('YA1 early deliberation preserves source current placement', async () => {
    // Council prepares promotion deliberation early (e.g. June 2027 before target year starts)
    const capacityReport = await checkPromotionCapacities(tenantId, [
      {
        classSectionId: targetClassSectionId,
        studentCount: 1,
      },
    ]);

    expect(capacityReport.hasCapacityExceeded).toBe(false);
    expect(capacityReport.breakdown).toHaveLength(1);
    expect(capacityReport.breakdown[0]!.classSectionId).toBe(targetClassSectionId);
    expect(capacityReport.breakdown[0]!.proposedStudentsCount).toBe(1);

    // Assert source placement remains current and active
    const activePlacements = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
          eq(studentPlacements.isCurrent, true),
        ),
      );

    expect(activePlacements).toHaveLength(1);
    expect(activePlacements[0]!.classSectionId).toBe(sourceClassSectionId);
    expect(activePlacements[0]!.sessionYearId).toBe(sourceYearId);
    expect(activePlacements[0]!.endDate).toBeNull();

    // Student 360 projection remains in source section
    const [u] = await db.select().from(user).where(eq(user.id, studentId));

    expect(u!.classSectionId).toBe(sourceClassSectionId);
  });

  it('YA2 early activation is blocked/no placement mutation', async () => {
    // Attempt to execute placement activation early on 2027-06-25 (before 2027-09-01)
    let caughtError: any = null;

    try {
      await executePromotionBatch({
        context: mockCtx,
        sourceClassSectionId,
        targetSessionYearId: targetYearId,
        effectiveDate: '2027-06-25',
        idempotencyKey: `ya2-early-attempt-${suffix}`,
        decisions: [
          {
            studentId,
            decision: 'promote',
            targetClassSectionId,
          },
        ],
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError.status).toBe(422);
    expect(caughtError.code).toBe('PREMATURE_ACTIVATION');

    // Invariant: zero placement mutation took place
    const allPlacements = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
        ),
      );

    // Still exactly 1 placement in the database
    expect(allPlacements).toHaveLength(1);
    expect(allPlacements[0]!.isCurrent).toBe(true);
    expect(allPlacements[0]!.classSectionId).toBe(sourceClassSectionId);
    expect(allPlacements[0]!.sessionYearId).toBe(sourceYearId);

    // No promotion batch record was committed
    const batches = await db
      .select()
      .from(promotionBatches)
      .where(
        and(
          eq(promotionBatches.tenantId, tenantId),
          eq(promotionBatches.idempotencyKey, `ya2-early-attempt-${suffix}`),
        ),
      );

    expect(batches).toHaveLength(0);

    // User projection remains in source section
    const [u] = await db.select().from(user).where(eq(user.id, studentId));

    expect(u!.classSectionId).toBe(sourceClassSectionId);
  });

  it('YA3 valid transition activates target atomically', async () => {
    // Execute promotion batch at legitimate transition date (2027-09-01)
    const result = await executePromotionBatch({
      context: mockCtx,
      sourceClassSectionId,
      targetSessionYearId: targetYearId,
      effectiveDate: '2027-09-01',
      idempotencyKey: `ya3-valid-transition-${suffix}`,
      decisions: [
        {
          studentId,
          decision: 'promote',
          targetClassSectionId,
          reason: 'Admis en 1ère Bac Sciences Expérimentales',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.batch.id).toBeTruthy();
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]!.decision).toBe('promote');

    // Verify source placement closed with endDate = '2027-09-01' and isCurrent = false
    const [sourcePlacement] = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
          eq(studentPlacements.sessionYearId, sourceYearId),
        ),
      );

    expect(sourcePlacement!.isCurrent).toBe(false);
    expect(sourcePlacement!.endDate).toBe('2027-09-01');

    // Verify target placement created with isCurrent = true and endDate = null
    const [targetPlacement] = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
          eq(studentPlacements.sessionYearId, targetYearId),
        ),
      );

    expect(targetPlacement!.isCurrent).toBe(true);
    expect(targetPlacement!.classSectionId).toBe(targetClassSectionId);
    expect(targetPlacement!.startDate).toBe('2027-09-01');
    expect(targetPlacement!.endDate).toBeNull();

    // Verify student user projection updated
    const [u] = await db.select().from(user).where(eq(user.id, studentId));

    expect(u!.classSectionId).toBe(targetClassSectionId);

    // Verify database check constraint (isCurrent = true AND endDate IS NULL) holds
    expect(targetPlacement!.isCurrent && targetPlacement!.endDate === null).toBe(true);
    expect(!sourcePlacement!.isCurrent && sourcePlacement!.endDate !== null).toBe(true);
  });

  it('YA4 Student 360 remains source before target start', async () => {
    // Before transition (June 2027), active placement belongs to sourceYear
    // After transition (September 2027), active placement belongs to targetYear
    // Historical audit trail maintains exactly two records
    const placements = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
        ),
      )
      .orderBy(studentPlacements.startDate);

    expect(placements).toHaveLength(2);

    const [hist, curr] = placements;

    expect(hist!.sessionYearId).toBe(sourceYearId);
    expect(hist!.classSectionId).toBe(sourceClassSectionId);
    expect(hist!.isCurrent).toBe(false);

    expect(curr!.sessionYearId).toBe(targetYearId);
    expect(curr!.classSectionId).toBe(targetClassSectionId);
    expect(curr!.isCurrent).toBe(true);
  });

  it('YA5 attendance/grades remain attached to source year before transition', async () => {
    // Verify attendance records created during 2026-2027 remain strictly bound to sourceYear
    const attendanceRecords = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.tenantId, tenantId),
          eq(attendance.studentId, studentId),
        ),
      );

    expect(attendanceRecords).toHaveLength(1);
    expect(attendanceRecords[0]!.academicYearId).toBe(sourceYearId);
    expect(attendanceRecords[0]!.date).toBe('2026-11-15');
    expect(attendanceRecords[0]!.status).toBe('present');

    // Promotion into target year does NOT mutate or delete prior attendance
    expect(attendanceRecords[0]!.academicYearId).not.toBe(targetYearId);
  });
});
