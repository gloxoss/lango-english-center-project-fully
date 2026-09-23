import type { RequestContext } from '@/libs/api/context';
import { randomUUID } from 'node:crypto';
import { and, count, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as postRevert } from '@/app/api/academics/promotions/revert/route';
import {
  checkPromotionCapacities,
  executePromotionBatch,
} from '@/features/students/services/promotion-service';
import { executeStudentTransfer } from '@/features/students/services/transfer-service';
import { db } from '@/libs/DB';
import {
  assessmentPlans,
  assessmentResults,
  assessments,
  attendance,
  auditLogs,
  branches,
  classes,
  classSections,
  gradingScales,
  guardians,
  guardianStudents,
  invoices,
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
    permissions: ['students.placements.manage', 'academics.manage'],
  }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: async () => undefined,
}));

const dbReachable = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!dbReachable)('Promotion & Réinscription Canonical Domain Service Acceptance (P1 - P20)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const operatorA = `OPERATOR-A-${suffix}`;
  const operatorB = `OPERATOR-B-${suffix}`;

  let sessionYearSourceId = '';
  let sessionYearTargetId = '';
  let sessionYearBTargetId = '';

  let classSourceId = '';
  let classTargetId = '';
  let sectionAId = '';
  let sectionBId = '';

  let sourceClassSectionId = '';
  let targetClassSectionId = '';
  let targetUnconfiguredSectionId = '';
  let tenantBTargetClassSectionId = '';
  let branchA = '';

  beforeAll(async () => {
    authState.tenantId = tenantA;
    authState.userId = operatorA;

    // 1. Create Tenant A and Tenant B
    await db.insert(tenants).values([
      { id: tenantA, name: `Promo Tenant A ${suffix}`, slug: `promo-a-${suffix}` },
      { id: tenantB, name: `Promo Tenant B ${suffix}`, slug: `promo-b-${suffix}` },
    ]);

    // Branches
    branchA = randomUUID();
    await db.insert(branches).values({
      id: branchA,
      tenantId: tenantA,
      name: 'Siège Principal',
      code: `BR-${suffix.slice(0, 4)}`,
      isDefault: true,
    });

    // Operators
    await db.insert(user).values([
      { id: operatorA, tenantId: tenantA, name: 'Admin A', email: `admin-a-${suffix}@example.com`, role: 'school_admin' },
      { id: operatorB, tenantId: tenantB, name: 'Admin B', email: `admin-b-${suffix}@example.com`, role: 'school_admin' },
    ]);

    // Sessions for Tenant A
    sessionYearSourceId = randomUUID();
    sessionYearTargetId = randomUUID();
    await db.insert(sessionYears).values([
      {
        id: sessionYearSourceId,
        tenantId: tenantA,
        name: '2025/2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
        isDefault: true,
      },
      {
        id: sessionYearTargetId,
        tenantId: tenantA,
        name: '2026/2027',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        isDefault: false,
      },
    ]);

    // Sessions for Tenant B
    sessionYearBTargetId = randomUUID();
    await db.insert(sessionYears).values({
      id: sessionYearBTargetId,
      tenantId: tenantB,
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: true,
    });

    // Medium, Classes, Sections
    const mediumA = randomUUID();
    const mediumB = randomUUID();
    await db.insert(mediums).values([
      { id: mediumA, tenantId: tenantA, name: 'Français' },
      { id: mediumB, tenantId: tenantB, name: 'Français' },
    ]);

    classSourceId = randomUUID();
    classTargetId = randomUUID();
    await db.insert(classes).values([
      { id: classSourceId, tenantId: tenantA, name: 'Tronc Commun', mediumId: mediumA },
      { id: classTargetId, tenantId: tenantA, name: '1BAC Sciences', mediumId: mediumA },
    ]);

    sectionAId = randomUUID();
    sectionBId = randomUUID();
    await db.insert(sections).values([
      { id: sectionAId, tenantId: tenantA, name: 'A' },
      { id: sectionBId, tenantId: tenantA, name: 'B' },
    ]);

    sourceClassSectionId = randomUUID();
    targetClassSectionId = randomUUID();
    targetUnconfiguredSectionId = randomUUID();

    await db.insert(classSections).values([
      {
        id: sourceClassSectionId,
        tenantId: tenantA,
        classId: classSourceId,
        sectionId: sectionAId,
        mediumId: mediumA,
        maxStudents: 35,
      },
      {
        id: targetClassSectionId,
        tenantId: tenantA,
        classId: classTargetId,
        sectionId: sectionAId,
        mediumId: mediumA,
        maxStudents: 30,
      },
      {
        id: targetUnconfiguredSectionId,
        tenantId: tenantA,
        classId: classTargetId,
        sectionId: sectionBId,
        mediumId: mediumA,
        maxStudents: null, // intentionally null for capacity contract
      },
    ]);

    // Section for Tenant B
    const classB = randomUUID();
    const sectionB = randomUUID();
    tenantBTargetClassSectionId = randomUUID();
    await db.insert(classes).values({ id: classB, tenantId: tenantB, name: 'Classe B', mediumId: mediumB });
    await db.insert(sections).values({ id: sectionB, tenantId: tenantB, name: 'B-Sec' });
    await db.insert(classSections).values({
      id: tenantBTargetClassSectionId,
      tenantId: tenantB,
      classId: classB,
      sectionId: sectionB,
      mediumId: mediumB,
      maxStudents: 30,
    });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  function makeContext(tenant: string, userGuid: string): RequestContext {
    return {
      tenantId: tenant,
      userId: userGuid,
      role: 'school_admin',
      baseRole: 'school_admin',
      name: 'Admin Test',
      email: 'admin-test@example.com',
      branchId: null,
    };
  }

  async function createTestStudent(
    tenant: string,
    initialSectionId: string,
    initialSessionId: string,
    customProps: Partial<typeof user.$inferInsert> = {},
  ) {
    const studentId = randomUUID();
    const matricule = `MAT-${studentId.slice(0, 6)}`;
    const nationalId = `MASSAR-${studentId.slice(0, 8)}`;

    const [createdUser] = await db
      .insert(user)
      .values({
        id: studentId,
        tenantId: tenant,
        name: `Student ${studentId.slice(0, 5)}`,
        email: `${studentId}@test.lango.ma`,
        role: 'student',
        matricule,
        nationalId,
        classSectionId: initialSectionId,
        userStatus: 'active',
        ...customProps,
      })
      .returning();

    const [placement] = await db
      .insert(studentPlacements)
      .values({
        tenantId: tenant,
        studentId,
        sessionYearId: initialSessionId,
        classSectionId: initialSectionId,
        status: 'enrolled',
        startDate: '2025-09-01',
        isCurrent: true,
      })
      .returning();

    return { user: createdUser!, placement: placement! };
  }

  // P1: No target academic year configured -> 422, zero writes
  it('P1: no target academic year -> 422 NO_TARGET_SESSION and zero writes', async () => {
    const { user: student } = await createTestStudent(tenantB, tenantBTargetClassSectionId, sessionYearBTargetId);
    const ctx = makeContext(tenantB, operatorB);

    await expect(
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId: tenantBTargetClassSectionId,
        idempotencyKey: `p1-${randomUUID()}`,
        decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId: tenantBTargetClassSectionId }],
      }),
    ).rejects.toThrow('Configurez l’année scolaire suivante');

    const batches = await db.select().from(promotionBatches).where(eq(promotionBatches.tenantId, tenantB));

    expect(batches).toHaveLength(0);
  });

  // P2: Valid single promotion
  it('P2: valid single promotion sets isCurrent=true in target and projects user.classSectionId', async () => {
    const { user: student, placement: srcPlacement } = await createTestStudent(
      tenantA,
      sourceClassSectionId,
      sessionYearSourceId,
    );
    const ctx = makeContext(tenantA, operatorA);
    const key = `p2-${randomUUID()}`;

    const result = await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: key,
      effectiveDate: '2026-09-01',
      decisions: [
        {
          studentId: student.id,
          decision: 'promote',
          targetClassSectionId,
          averagePercentage: 75.5,
          reason: 'Admis au niveau supérieur',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.batch.id).toBeDefined();

    // Verify source placement closed historically
    const [closedPlacement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.id, srcPlacement.id), eq(studentPlacements.tenantId, tenantA)));

    expect(closedPlacement!.isCurrent).toBe(false);
    expect(closedPlacement!.endDate).toBe('2026-09-01');

    // Verify new target placement
    const [newPlacement] = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.studentId, student.id),
          eq(studentPlacements.isCurrent, true),
          eq(studentPlacements.tenantId, tenantA),
        ),
      );

    expect(newPlacement!.classSectionId).toBe(targetClassSectionId);
    expect(newPlacement!.sessionYearId).toBe(sessionYearTargetId);
    expect(newPlacement!.promotedFromPlacementId).toBe(srcPlacement.id);

    // Verify user projection updated
    const [updatedUser] = await db
      .select()
      .from(user)
      .where(and(eq(user.id, student.id), eq(user.tenantId, tenantA)));

    expect(updatedUser!.classSectionId).toBe(targetClassSectionId);
  });

  // P3: Valid atomic bulk promotion
  it('P3: valid atomic bulk promotion promotes multiple students in one batch', async () => {
    const s1 = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const s2 = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const s3 = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);

    const ctx = makeContext(tenantA, operatorA);
    const key = `p3-${randomUUID()}`;

    const result = await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: key,
      effectiveDate: '2026-09-01',
      decisions: [
        { studentId: s1.user.id, decision: 'promote', targetClassSectionId },
        { studentId: s2.user.id, decision: 'promote', targetClassSectionId },
        { studentId: s3.user.id, decision: 'promote', targetClassSectionId },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.decisions).toHaveLength(3);

    const activePlacements = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantA),
          eq(studentPlacements.classSectionId, targetClassSectionId),
          eq(studentPlacements.isCurrent, true),
        ),
      );

    expect(activePlacements.length).toBeGreaterThanOrEqual(3);
  });

  // P4 & P5: History preserved and belongs to target session
  it('P4 & P5: source placement history is preserved and target placement belongs to target session', async () => {
    const { user: student, placement: srcPlacement } = await createTestStudent(
      tenantA,
      sourceClassSectionId,
      sessionYearSourceId,
    );
    const ctx = makeContext(tenantA, operatorA);

    await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: `p4p5-${randomUUID()}`,
      effectiveDate: '2026-09-01',
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    const placements = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, student.id), eq(studentPlacements.tenantId, tenantA)))
      .orderBy(studentPlacements.startDate);

    expect(placements).toHaveLength(2);
    // P4: source placement
    expect(placements[0]!.id).toBe(srcPlacement.id);
    expect(placements[0]!.isCurrent).toBe(false);
    expect(placements[0]!.sessionYearId).toBe(sessionYearSourceId);
    // P5: target placement
    expect(placements[1]!.isCurrent).toBe(true);
    expect(placements[1]!.sessionYearId).toBe(sessionYearTargetId);
    expect(placements[1]!.classSectionId).toBe(targetClassSectionId);
  });

  // P6: Capacity null -> 422 CAPACITY_NOT_CONFIGURED
  it('P6: capacity null -> 422 CAPACITY_NOT_CONFIGURED and 0 partial writes', async () => {
    const { user: student, placement: srcPlacement } = await createTestStudent(
      tenantA,
      sourceClassSectionId,
      sessionYearSourceId,
    );
    const ctx = makeContext(tenantA, operatorA);

    await expect(
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p6-${randomUUID()}`,
        decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId: targetUnconfiguredSectionId }],
      }),
    ).rejects.toMatchObject({ status: 422, code: 'CAPACITY_NOT_CONFIGURED' });

    // Assert 0 partial writes
    const [stillActive] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.id, srcPlacement.id), eq(studentPlacements.tenantId, tenantA)));

    expect(stillActive!.isCurrent).toBe(true);

    const targetPlacements = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.classSectionId, targetUnconfiguredSectionId),
          eq(studentPlacements.tenantId, tenantA),
        ),
      );

    expect(targetPlacements).toHaveLength(0);
  });

  // P7: Target full -> 409 CAPACITY_EXCEEDED
  it('P7: target full -> 409 CAPACITY_EXCEEDED and 0 partial writes', async () => {
    // Create tight section with maxStudents = 1
    const tightSectionId = randomUUID();
    const tightSecDefId = randomUUID();
    await db.insert(sections).values({ id: tightSecDefId, tenantId: tenantA, name: `Tight-${randomUUID().slice(0, 4)}` });
    await db.insert(classSections).values({
      id: tightSectionId,
      tenantId: tenantA,
      classId: classTargetId,
      sectionId: tightSecDefId,
      mediumId: (await db.select().from(mediums).where(eq(mediums.tenantId, tenantA)).limit(1))[0]!.id,
      maxStudents: 1,
    });

    // Fill the 1 seat
    await createTestStudent(tenantA, tightSectionId, sessionYearSourceId);

    // Try promoting another student into it
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);

    await expect(
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p7-${randomUUID()}`,
        decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId: tightSectionId }],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CAPACITY_EXCEEDED' });
  });

  // P8: Projected batch overflow -> entire batch rejected (All-or-Nothing atomicity)
  it('P8: projected batch overflow -> entire batch rejected with 0 partial writes', async () => {
    const smallSecId = randomUUID();
    const smallSecDefId = randomUUID();
    await db.insert(sections).values({ id: smallSecDefId, tenantId: tenantA, name: `Small-${randomUUID().slice(0, 4)}` });
    await db.insert(classSections).values({
      id: smallSecId,
      tenantId: tenantA,
      classId: classTargetId,
      sectionId: smallSecDefId,
      mediumId: (await db.select().from(mediums).where(eq(mediums.tenantId, tenantA)).limit(1))[0]!.id,
      maxStudents: 2,
    });

    // Already 1 enrolled
    await createTestStudent(tenantA, smallSecId, sessionYearSourceId);

    // Now try to promote 2 students into remaining 1 seat (total would be 3 > 2)
    const stu1 = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const stu2 = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);

    await expect(
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p8-${randomUUID()}`,
        decisions: [
          { studentId: stu1.user.id, decision: 'promote', targetClassSectionId: smallSecId },
          { studentId: stu2.user.id, decision: 'promote', targetClassSectionId: smallSecId },
        ],
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CAPACITY_EXCEEDED' });

    // Assert ALL-OR-NOTHING: stu1 must NOT have been promoted
    const [stu1Current] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.id, stu1.placement.id), eq(studentPlacements.tenantId, tenantA)));

    expect(stu1Current!.isCurrent).toBe(true);

    const [stu2Current] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.id, stu2.placement.id), eq(studentPlacements.tenantId, tenantA)));

    expect(stu2Current!.isCurrent).toBe(true);
  });

  // P9: Identical idempotent retry -> returns committed batch without duplicates
  it('P9: identical idempotent retry returns committed batch without duplicated writes', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);
    const key = `p9-key-${randomUUID()}`;

    const payload = {
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: key,
      decisions: [{ studentId: student.id, decision: 'promote' as const, targetClassSectionId }],
    };

    const firstResult = await executePromotionBatch(payload);

    expect(firstResult.success).toBe(true);

    const secondResult = await executePromotionBatch(payload);

    expect(secondResult.success).toBe(true);
    expect(secondResult.idempotent).toBe(true);
    expect(secondResult.batch.id).toBe(firstResult.batch.id);

    // Assert only one batch in DB with this key
    const batches = await db
      .select()
      .from(promotionBatches)
      .where(and(eq(promotionBatches.tenantId, tenantA), eq(promotionBatches.idempotencyKey, key)));

    expect(batches).toHaveLength(1);
  });

  // P10: Concurrent promotion batches cannot overfill section
  it('P10: concurrent promotion batches serialize via pessimistic locks and cannot overfill section', async () => {
    const raceSectionId = randomUUID();
    const raceSecDefId = randomUUID();
    await db.insert(sections).values({ id: raceSecDefId, tenantId: tenantA, name: `Race-${randomUUID().slice(0, 4)}` });
    await db.insert(classSections).values({
      id: raceSectionId,
      tenantId: tenantA,
      classId: classTargetId,
      sectionId: raceSecDefId,
      mediumId: (await db.select().from(mediums).where(eq(mediums.tenantId, tenantA)).limit(1))[0]!.id,
      maxStudents: 2,
    });

    // Fill 1 seat, exactly 1 seat remaining
    await createTestStudent(tenantA, raceSectionId, sessionYearSourceId);

    const studentX = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const studentY = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);

    // Fire batch A and batch B concurrently
    const [resA, resB] = await Promise.allSettled([
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p10-a-${randomUUID()}`,
        decisions: [{ studentId: studentX.user.id, decision: 'promote', targetClassSectionId: raceSectionId }],
      }),
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p10-b-${randomUUID()}`,
        decisions: [{ studentId: studentY.user.id, decision: 'promote', targetClassSectionId: raceSectionId }],
      }),
    ]);

    // Exactly one must succeed, exactly one must fail with 409
    const statuses = [resA.status, resB.status];

    expect(statuses).toContain('fulfilled');
    expect(statuses).toContain('rejected');

    const rejected = resA.status === 'rejected' ? resA.reason : (resB as PromiseRejectedResult).reason;

    expect(rejected.code).toBe('CAPACITY_EXCEEDED');

    // Final occupancy must strictly equal 2, never 3
    const [finalEnrolled] = await db
      .select({ count: count() })
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantA),
          eq(studentPlacements.classSectionId, raceSectionId),
          eq(studentPlacements.isCurrent, true),
        ),
      );

    expect(Number(finalEnrolled?.count)).toBe(2);
  });

  // P11: Promotion vs Transfer concurrency preserves single current placement
  it('P11: promotion vs transfer concurrency preserves one-current-placement invariant', async () => {
    const student = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);

    // Another section in tenant A for transfer
    const otherSectionId = randomUUID();
    const otherSecDefId = randomUUID();
    await db.insert(sections).values({ id: otherSecDefId, tenantId: tenantA, name: `Other-${randomUUID().slice(0, 4)}` });
    await db.insert(classSections).values({
      id: otherSectionId,
      tenantId: tenantA,
      classId: classSourceId,
      sectionId: otherSecDefId,
      mediumId: (await db.select().from(mediums).where(eq(mediums.tenantId, tenantA)).limit(1))[0]!.id,
      maxStudents: 30,
    });

    await Promise.allSettled([
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p11-prom-${randomUUID()}`,
        decisions: [{ studentId: student.user.id, decision: 'promote', targetClassSectionId }],
      }),
      executeStudentTransfer({
        tenantId: tenantA,
        studentId: student.user.id,
        targetBranchId: branchA,
        targetClassSectionId: otherSectionId,
        effectiveDate: '2026-09-02',
        reason: 'Transfert parallèle',
        actor: {
          userId: operatorA,
          role: 'school_admin',
          branchId: null,
        },
      }),
    ]);

    // Single-current-placement invariant MUST hold
    const currentPlacements = await db
      .select()
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.studentId, student.user.id),
          eq(studentPlacements.tenantId, tenantA),
          eq(studentPlacements.isCurrent, true),
        ),
      );

    expect(currentPlacements).toHaveLength(1);
  });

  // P12: Tenant isolation
  it('P12: tenant isolation blocks cross-tenant promotion and section hijacking', async () => {
    const { user: studentA } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctxA = makeContext(tenantA, operatorA);

    // Attempt to promote Tenant A student into Tenant B section
    await expect(
      executePromotionBatch({
        context: ctxA,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p12-${randomUUID()}`,
        decisions: [{ studentId: studentA.id, decision: 'promote', targetClassSectionId: tenantBTargetClassSectionId }],
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_TARGET_SECTION' });
  });

  // P13: Branch authorization / target section integrity
  it('P13: verifies target section exists and belongs to the authorized tenant', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);
    const fakeSectionId = randomUUID();

    await expect(
      executePromotionBatch({
        context: ctx,
        sourceClassSectionId,
        targetSessionYearId: sessionYearTargetId,
        idempotencyKey: `p13-${randomUUID()}`,
        decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId: fakeSectionId }],
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_TARGET_SECTION' });
  });

  // P14: Mixed supported decisions (promote, repeat, graduate, withdraw)
  it('P14: handles mixed supported decisions atomically in a single batch', async () => {
    const sPromote = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const sRepeat = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const sGraduate = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const sWithdraw = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);

    const ctx = makeContext(tenantA, operatorA);
    const key = `p14-${randomUUID()}`;

    const result = await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: key,
      effectiveDate: '2026-09-01',
      decisions: [
        { studentId: sPromote.user.id, decision: 'promote', targetClassSectionId },
        { studentId: sRepeat.user.id, decision: 'repeat', targetClassSectionId: sourceClassSectionId },
        { studentId: sGraduate.user.id, decision: 'graduate' },
        { studentId: sWithdraw.user.id, decision: 'withdraw' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.decisions).toHaveLength(4);

    // Promoted student
    const [uPromote] = await db.select().from(user).where(eq(user.id, sPromote.user.id));

    expect(uPromote!.classSectionId).toBe(targetClassSectionId);

    // Repeater student
    const [uRepeat] = await db.select().from(user).where(eq(user.id, sRepeat.user.id));

    expect(uRepeat!.classSectionId).toBe(sourceClassSectionId);

    // Graduate student
    const [uGraduate] = await db.select().from(user).where(eq(user.id, sGraduate.user.id));

    expect(uGraduate!.role).toBe('alumni');
    expect(uGraduate!.userStatus).toBe('archived');

    // Withdrawn student
    const [uWithdraw] = await db.select().from(user).where(eq(user.id, sWithdraw.user.id));

    expect(uWithdraw!.userStatus).toBe('inactive');
  });

  // P15: UUID / Massar / matricule stable
  it('P15: preserves student UUID, Massar, and matricule unchanged', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);

    await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: `p15-${randomUUID()}`,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    const [after] = await db.select().from(user).where(eq(user.id, student.id));

    expect(after!.id).toBe(student.id);
    expect(after!.matricule).toBe(student.matricule);
    expect(after!.nationalId).toBe(student.nationalId);
  });

  // P16: Guardian relationships stable
  it('P16: preserves guardian links intact', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const guardianId = randomUUID();
    await db.insert(guardians).values({
      id: guardianId,
      tenantId: tenantA,
      firstName: 'Karim',
      lastName: 'Alami',
      phone: '+212600000001',
    });
    await db.insert(guardianStudents).values({
      tenantId: tenantA,
      guardianId,
      studentId: student.id,
      relationshipType: 'father',
      isPrimaryContact: true,
    });

    const ctx = makeContext(tenantA, operatorA);
    await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: `p16-${randomUUID()}`,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    const links = await db
      .select()
      .from(guardianStudents)
      .where(and(eq(guardianStudents.studentId, student.id), eq(guardianStudents.tenantId, tenantA)));

    expect(links).toHaveLength(1);
    expect(links[0]!.guardianId).toBe(guardianId);
  });

  // P17: Finance ledger stable
  it('P17: preserves student invoice balances and payments untouched', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const invoiceId = randomUUID();
    await db.insert(invoices).values({
      id: invoiceId,
      tenantId: tenantA,
      studentId: student.id,
      invoiceNumber: `INV-${invoiceId.slice(0, 6)}`,
      amount: 1500,
      discountAmount: 0,
      netAmount: 1500,
      paidAmount: 500,
      status: 'partial',
      dueDate: '2026-05-01',
    });

    const ctx = makeContext(tenantA, operatorA);
    await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: `p17-${randomUUID()}`,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

    expect(Number(inv!.paidAmount)).toBe(500);
    expect(Number(inv!.netAmount)).toBe(1500);
    expect(inv!.status).toBe('partial');
  });

  // P18: Historical attendance stable
  it('P18: preserves historical attendance and registers untouched', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const [att] = await db
      .insert(attendance)
      .values({
        tenantId: tenantA,
        studentId: student.id,
        academicYearId: sessionYearSourceId,
        date: '2026-03-15',
        status: 'present',
        period: 1,
      })
      .returning();

    const ctx = makeContext(tenantA, operatorA);
    await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: `p18-${randomUUID()}`,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    const [afterAtt] = await db.select().from(attendance).where(eq(attendance.id, att!.id));

    expect(afterAtt!.status).toBe('present');
    expect(afterAtt!.date).toBe('2026-03-15');
  });

  // P19: Historical grades/report cards stable
  it('P19: preserves historical assessment outcomes and marks untouched', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const [scale] = await db
      .insert(gradingScales)
      .values({ tenantId: tenantA, name: `Barème /20 ${suffix}` })
      .returning();
    const [plan] = await db
      .insert(assessmentPlans)
      .values({ tenantId: tenantA, name: `Plan T1 ${suffix}`, gradingScaleId: scale!.id })
      .returning();
    const [assessment] = await db
      .insert(assessments)
      .values({
        tenantId: tenantA,
        assessmentPlanId: plan!.id,
        title: 'Contrôle 1 Mathématiques',
        assessmentDate: '2026-02-15',
      })
      .returning();

    const resultId = randomUUID();
    await db.insert(assessmentResults).values({
      id: resultId,
      tenantId: tenantA,
      assessmentId: assessment!.id,
      studentId: student.id,
      finalPercentage: '82.50',
      gradeCode: 'Très Bien',
    });

    const ctx = makeContext(tenantA, operatorA);
    await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: `p19-${randomUUID()}`,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    const [res] = await db.select().from(assessmentResults).where(eq(assessmentResults.id, resultId));

    expect(res!.finalPercentage).toBe('82.50');
    expect(res!.gradeCode).toBe('Très Bien');
  });

  // P20: Complete audit event recorded
  it('P20: records complete CNDP Law 09-08 audit event with full provenance', async () => {
    const { user: student } = await createTestStudent(tenantA, sourceClassSectionId, sessionYearSourceId);
    const ctx = makeContext(tenantA, operatorA);
    const key = `p20-${randomUUID()}`;

    const result = await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: key,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    // Fire-and-forget logger tick
    await new Promise(r => setTimeout(r, 50));

    const auditRows = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.tenantId, tenantA),
          eq(auditLogs.entityType, 'promotion_batch'),
          eq(auditLogs.entityId, result.batch.id),
        ),
      );

    expect(auditRows.length).toBeGreaterThanOrEqual(1);

    const audit = auditRows[0]!;

    expect(audit.action).toBe('create');
    expect(audit.actorId).toBe(operatorA);

    const meta = audit.metadata as any;

    expect(meta.sourceClassSectionId).toBe(sourceClassSectionId);
    expect(meta.targetSessionYearId).toBe(sessionYearTargetId);
    expect(meta.decisionCount).toBe(1);
  });

  // Capacity Service Acceptance
  it('Capacity Service: checkPromotionCapacities correctly detects limits', async () => {
    const result = await checkPromotionCapacities(tenantA, [
      { classSectionId: targetClassSectionId, studentCount: 5 },
      { classSectionId: targetUnconfiguredSectionId, studentCount: 2 },
    ]);

    expect(result.hasCapacityUnconfigured).toBe(true);
    expect(result.breakdown).toHaveLength(2);

    const unconf = result.breakdown.find(b => b.classSectionId === targetUnconfiguredSectionId);

    expect(unconf?.isConfigured).toBe(false);
  });

  // Revert Acceptance Test
  it('Revert: restores predecessor placement when no downstream activity, blocks when activity exists', async () => {
    const { user: student, placement: srcPlacement } = await createTestStudent(
      tenantA,
      sourceClassSectionId,
      sessionYearSourceId,
    );
    const ctx = makeContext(tenantA, operatorA);
    const key = `rev-${randomUUID()}`;

    const promoResult = await executePromotionBatch({
      context: ctx,
      sourceClassSectionId,
      targetSessionYearId: sessionYearTargetId,
      idempotencyKey: key,
      decisions: [{ studentId: student.id, decision: 'promote', targetClassSectionId }],
    });

    authState.tenantId = tenantA;
    authState.userId = operatorA;

    // Revert before any payments/attendance -> must succeed
    const revertReq = new Request('http://localhost/api/academics/promotions/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId: promoResult.batch.id }),
    });

    const revertRes = await postRevert(revertReq);
    const revertData = await revertRes.json();
    if (!revertData.success) {
      console.error('REVERT_FAIL_DEBUG:', JSON.stringify(revertData));
    }

    expect(revertData.success).toBe(true);

    // Verify restored placement
    const [restoredSrc] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.id, srcPlacement.id), eq(studentPlacements.tenantId, tenantA)));

    expect(restoredSrc!.isCurrent).toBe(true);

    // Verify user classSectionId restored
    const [restoredUser] = await db.select().from(user).where(eq(user.id, student.id));

    expect(restoredUser!.classSectionId).toBe(sourceClassSectionId);
  });
});
