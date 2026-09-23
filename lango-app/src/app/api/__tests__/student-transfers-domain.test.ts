import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { executeStudentTransfer } from '@/features/students/services/transfer-service';
import { db } from '@/libs/DB';
import {
  academicYears,
  attendance,
  auditLogs,
  branches,
  classes,
  classSections,
  guardians,
  guardianStudents,
  invoices,
  mediums,
  sections,
  sessionYears,
  studentPlacements,
  tenants,
  user,
} from '@/models/Schema';

const dbReachable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbReachable)('Student Transfers Domain Service & Acceptance Suite (T1-T12)', () => {
  const tenantId = crypto.randomUUID();
  let branch1Id: string;
  let branch2Id: string;
  let foreignBranchId: string;
  let sessionYearId: string;
  let academicYearId: string;
  let mediumId: string;
  let sectionAId: string;
  let sectionBId: string;

  // Class sections
  let csAlphaAId: string;
  let csAlphaBId: string;
  let csBetaAId: string;
  let csBetaBId: string;
  let csBetaFullId: string;
  let csBetaUncappedId: string;

  const adminActor = {
    userId: `admin-${crypto.randomUUID()}`,
    role: 'school_admin' as const,
    branchId: null,
    name: 'Directeur Général',
  };

  beforeAll(async () => {
    // 1. Seed Tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Transfers Acceptance Academy',
      slug: `transfers-acc-${Date.now()}`,
      isActive: true,
      planTier: 'standard',
    });

    // 2. Seed Branches
    const [b1] = await db
      .insert(branches)
      .values({
        tenantId,
        name: 'Campus Alpha',
        code: `CA-${Date.now().toString().slice(-4)}`,
        isActive: true,
      })
      .returning();
    branch1Id = b1!.id;

    const [b2] = await db
      .insert(branches)
      .values({
        tenantId,
        name: 'Campus Beta',
        code: `CB-${Date.now().toString().slice(-4)}`,
        isActive: true,
      })
      .returning();
    branch2Id = b2!.id;

    const [bForeign] = await db
      .insert(branches)
      .values({
        tenantId,
        name: 'Campus Gamma (Foreign)',
        code: `CG-${Date.now().toString().slice(-4)}`,
        isActive: true,
      })
      .returning();
    foreignBranchId = bForeign!.id;

    // 3. Seed Session Year & Medium
    const [sy] = await db
      .insert(sessionYears)
      .values({
        tenantId,
        name: `2026-2027-${Date.now().toString().slice(-4)}`,
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        isDefault: true,
      })
      .returning();
    sessionYearId = sy!.id;

    const [ay] = await db
      .insert(academicYears)
      .values({
        tenantId,
        name: `AY-2026-2027-${Date.now().toString().slice(-4)}`,
        startDate: '2026-09-01 00:00:00',
        endDate: '2027-06-30 23:59:59',
        isActive: true,
      })
      .returning();
    academicYearId = ay!.id;

    const [med] = await db
      .insert(mediums)
      .values({
        tenantId,
        name: `Bilingue-${Date.now().toString().slice(-4)}`,
      })
      .returning();
    mediumId = med!.id;

    // 4. Seed Sections
    const [secA] = await db.insert(sections).values({ tenantId, name: `Section A-${Date.now().toString().slice(-4)}` }).returning();
    const [secB] = await db.insert(sections).values({ tenantId, name: `Section B-${Date.now().toString().slice(-4)}` }).returning();
    const [secC] = await db.insert(sections).values({ tenantId, name: `Section C-${Date.now().toString().slice(-4)}` }).returning();
    sectionAId = secA!.id;
    sectionBId = secB!.id;
    const sectionCId = secC!.id;

    // 5. Seed Classes & Class Sections
    const [cAlpha] = await db
      .insert(classes)
      .values({
        tenantId,
        branchId: branch1Id,
        name: '1ère Bac Sciences - Alpha',
        mediumId,
      })
      .returning();

    const [cBeta] = await db
      .insert(classes)
      .values({
        tenantId,
        branchId: branch2Id,
        name: '1ère Bac Sciences - Beta',
        mediumId,
      })
      .returning();

    // Sections for Class Alpha (Branch 1)
    const [csAA] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: cAlpha!.id,
        sectionId: sectionAId,
        mediumId,
        maxStudents: 10,
      })
      .returning();
    csAlphaAId = csAA!.id;

    const [csAB] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: cAlpha!.id,
        sectionId: sectionBId,
        mediumId,
        maxStudents: 10,
      })
      .returning();
    csAlphaBId = csAB!.id;

    // Sections for Class Beta (Branch 2)
    const [csBA] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: cBeta!.id,
        sectionId: sectionAId,
        mediumId,
        maxStudents: 10,
      })
      .returning();
    csBetaAId = csBA!.id;

    const [secD] = await db.insert(sections).values({ tenantId, name: `Section D-${Date.now().toString().slice(-4)}` }).returning();
    const [csBB] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: cBeta!.id,
        sectionId: secD!.id,
        mediumId,
        maxStudents: 15,
      })
      .returning();
    csBetaBId = csBB!.id;

    const [csBF] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: cBeta!.id,
        sectionId: sectionBId,
        mediumId,
        maxStudents: 1, // Only capacity for 1 student!
      })
      .returning();
    csBetaFullId = csBF!.id;

    const [csBU] = await db
      .insert(classSections)
      .values({
        tenantId,
        classId: cBeta!.id,
        sectionId: sectionCId,
        mediumId,
        maxStudents: null, // Unconfigured capacity
      })
      .returning();
    csBetaUncappedId = csBU!.id;
  });

  afterAll(async () => {
    // Cleanup tenant cascade
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  // Helper to create a student in a specific section & branch
  async function createTestStudent(opts: {
    name: string;
    branchId: string;
    classSectionId: string;
    matricule: string;
    nationalId: string;
    placementStartDate?: string;
  }) {
    const studentId = `std-${crypto.randomUUID()}`;
    const email = `${studentId}@test-transfers.ma`;
    const startDate = opts.placementStartDate || '2026-09-01';

    await db.insert(user).values({
      id: studentId,
      tenantId,
      branchId: opts.branchId,
      classSectionId: opts.classSectionId,
      name: opts.name,
      email,
      role: 'student',
      userStatus: 'active',
      matricule: opts.matricule,
      nationalId: opts.nationalId,
    });

    const [placement] = await db
      .insert(studentPlacements)
      .values({
        tenantId,
        studentId,
        sessionYearId,
        classSectionId: opts.classSectionId,
        status: 'enrolled',
        startDate,
        isCurrent: true,
      })
      .returning();

    return { studentId, placementId: placement!.id };
  }

  // T1: Cross-campus transfer (source branch != dest branch)
  it('T1: Cross-campus transfer correctly mutates placements, user projection and records audit', async () => {
    const { studentId, placementId } = await createTestStudent({
      name: 'Youssef El Mansouri',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T1-001',
      nationalId: 'MAS-T1-001',
      placementStartDate: '2026-09-01',
    });

    const result = await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaAId,
      effectiveDate: '2026-09-15',
      reason: 'Déménagement à Rabat',
      actor: adminActor,
    });

    expect(result.success).toBe(true);
    expect(result.fromBranchId).toBe(branch1Id);
    expect(result.toBranchId).toBe(branch2Id);
    expect(result.isSameCampusSectionMove).toBe(false);

    // Verify user projection updated
    const [updatedUser] = await db.select().from(user).where(eq(user.id, studentId));
    expect(updatedUser?.branchId).toBe(branch2Id);
    expect(updatedUser?.classSectionId).toBe(csBetaAId);

    // Verify old placement closed
    const [oldPlacement] = await db.select().from(studentPlacements).where(eq(studentPlacements.id, placementId));
    expect(oldPlacement?.isCurrent).toBe(false);
    expect(oldPlacement?.endDate).toBe('2026-09-15');

    // Verify new placement created
    const [newPlacement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(newPlacement).toBeDefined();
    expect(newPlacement?.classSectionId).toBe(csBetaAId);
    expect(newPlacement?.startDate).toBe('2026-09-15');
    expect(newPlacement?.endDate).toBeNull();
    expect(newPlacement?.promotedFromPlacementId).toBe(placementId);

    // Invariant: Exactly 1 current placement
    const activePlacements = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(activePlacements.length).toBe(1);

    // Audit trail truth: records real transfer movement without false claims of attestation/notification
    await new Promise(r => setTimeout(r, 60));
    const [auditLog] = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.entityId, studentId),
        eq(auditLogs.entityType, 'student_transfer'),
      ));
    expect(auditLog).toBeDefined();
    const meta = auditLog?.metadata as Record<string, unknown>;
    expect(meta.fromBranchId).toBe(branch1Id);
    expect(meta.toBranchId).toBe(branch2Id);
    expect(meta.toClassSectionId).toBe(csBetaAId);
    expect(meta.isSameCampusSectionMove).toBe(false);
    expect(meta.generateCertificate).toBeUndefined();
    expect(meta.notifyGuardian).toBeUndefined();
  });

  // T2: Same-campus section move (source branch == dest branch, section A -> section B)
  it('T2: Same-campus section move handles intra-campus transition seamlessly', async () => {
    const { studentId, placementId } = await createTestStudent({
      name: 'Salma Benjelloun',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T2-002',
      nationalId: 'MAS-T2-002',
      placementStartDate: '2026-09-01',
    });

    const result = await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch1Id,
      targetClassSectionId: csAlphaBId,
      effectiveDate: '2026-09-16',
      reason: 'Rééquilibrage pédagogique',
      actor: adminActor,
    });

    expect(result.success).toBe(true);
    expect(result.isSameCampusSectionMove).toBe(true);
    expect(result.fromClassSectionId).toBe(csAlphaAId);
    expect(result.toClassSectionId).toBe(csAlphaBId);

    // Verify user projection updated
    const [updatedUser] = await db.select().from(user).where(eq(user.id, studentId));
    expect(updatedUser?.branchId).toBe(branch1Id);
    expect(updatedUser?.classSectionId).toBe(csAlphaBId);

    // Verify placement history
    const [oldPlacement] = await db.select().from(studentPlacements).where(eq(studentPlacements.id, placementId));
    expect(oldPlacement?.isCurrent).toBe(false);
    expect(oldPlacement?.endDate).toBe('2026-09-16');

    const [currentPlacement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(currentPlacement?.classSectionId).toBe(csAlphaBId);
  });

  // T3: Capacity exceeded (maxStudents reached -> 409 CAPACITY_EXCEEDED)
  it('T3: Capacity exceeded rejects transfer with 409 and leaves state untouched', async () => {
    // Fill csBetaFull (capacity 1) with an existing student
    await createTestStudent({
      name: 'Occupant Student',
      branchId: branch2Id,
      classSectionId: csBetaFullId,
      matricule: 'MAT-T3-OCC',
      nationalId: 'MAS-T3-OCC',
    });

    // Create a student wishing to transfer to the full section
    const { studentId, placementId } = await createTestStudent({
      name: 'Rejected Student',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T3-003',
      nationalId: 'MAS-T3-003',
    });

    await expect(
      executeStudentTransfer({
        tenantId,
        studentId,
        targetBranchId: branch2Id,
        targetClassSectionId: csBetaFullId,
        actor: adminActor,
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'CAPACITY_EXCEEDED',
    });

    // Verify student was NOT transferred
    const [unchangedUser] = await db.select().from(user).where(eq(user.id, studentId));
    expect(unchangedUser?.branchId).toBe(branch1Id);
    expect(unchangedUser?.classSectionId).toBe(csAlphaAId);

    const [activePlacement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(activePlacement?.id).toBe(placementId);
    expect(activePlacement?.classSectionId).toBe(csAlphaAId);
  });

  // T4: Capacity unconfigured (maxStudents = null -> reject 422 CAPACITY_NOT_CONFIGURED)
  it('T4: Capacity unconfigured rejects transfer with 422 CAPACITY_NOT_CONFIGURED and leaves state untouched', async () => {
    const { studentId, placementId } = await createTestStudent({
      name: 'Nadia Chraibi',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T4-004',
      nationalId: 'MAS-T4-004',
      placementStartDate: '2026-09-01',
    });

    await expect(
      executeStudentTransfer({
        tenantId,
        studentId,
        targetBranchId: branch2Id,
        targetClassSectionId: csBetaUncappedId,
        effectiveDate: '2026-09-18',
        actor: adminActor,
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'CAPACITY_NOT_CONFIGURED',
    });

    // Verify zero user mutation
    const [unchangedUser] = await db.select().from(user).where(eq(user.id, studentId));
    expect(unchangedUser?.branchId).toBe(branch1Id);
    expect(unchangedUser?.classSectionId).toBe(csAlphaAId);

    // Verify zero placement mutation
    const [activePlacement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(activePlacement?.id).toBe(placementId);
    expect(activePlacement?.classSectionId).toBe(csAlphaAId);

    // Verify zero transfer audit
    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.entityId, studentId),
        eq(auditLogs.entityType, 'student_transfer'),
      ));
    expect(logs).toHaveLength(0);
  });

  // T5: No-op guard (same branch and same section -> 409 NO_OP_TRANSFER)
  it('T5: No-op transfer attempts are blocked with 409 NO_OP_TRANSFER', async () => {
    const { studentId } = await createTestStudent({
      name: 'Hamza Tazi',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T5-005',
      nationalId: 'MAS-T5-005',
    });

    await expect(
      executeStudentTransfer({
        tenantId,
        studentId,
        targetBranchId: branch1Id,
        targetClassSectionId: csAlphaAId,
        actor: adminActor,
      })
    ).rejects.toMatchObject({
      status: 409,
      code: 'NO_OP_TRANSFER',
    });
  });

  // T6: Branch-limited operator authorization (actor.branchId foreign -> 403 FORBIDDEN_BRANCH_SCOPE)
  it('T6: Branch-scoped operator cannot transfer a student belonging to a different branch', async () => {
    const { studentId } = await createTestStudent({
      name: 'Amina Alami',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T6-006',
      nationalId: 'MAS-T6-006',
    });

    const foreignActor = {
      userId: `foreign-user-${crypto.randomUUID()}`,
      role: 'school_admin' as const,
      branchId: foreignBranchId, // Operates solely in Campus Gamma
      name: 'Directeur Campus Gamma',
    };

    await expect(
      executeStudentTransfer({
        tenantId,
        studentId,
        targetBranchId: branch2Id,
        targetClassSectionId: csBetaAId,
        actor: foreignActor,
      })
    ).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN_BRANCH_SCOPE',
    });
  });

  // T7: Concurrent transfer race (parallel execution, advisory lock serializes, 1 active placement)
  it('T7: Advisory xact lock serializes concurrent transfers, preserving single current placement invariant', async () => {
    const { studentId } = await createTestStudent({
      name: 'Rachid Berrada',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T7-007',
      nationalId: 'MAS-T7-007',
      placementStartDate: '2026-09-01',
    });

    // Execute two transfers in parallel (e.g. race condition between two operators)
    const run1 = executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaAId,
      effectiveDate: '2026-09-20',
      reason: 'Mutation Parallèle 1',
      actor: adminActor,
    });

    const run2 = executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch1Id,
      targetClassSectionId: csAlphaBId,
      effectiveDate: '2026-09-20',
      reason: 'Mutation Parallèle 2',
      actor: adminActor,
    });

    const settled = await Promise.allSettled([run1, run2]);
    const fulfilled = settled.filter(s => s.status === 'fulfilled');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    // Crucial Invariant: Exactly 1 current placement exists in DB
    const activePlacements = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(activePlacements.length).toBe(1);

    // User projection matches that single active placement
    const [currentUser] = await db.select().from(user).where(eq(user.id, studentId));
    expect(currentUser?.classSectionId).toBe(activePlacements[0]!.classSectionId);
  });

  // T8: Student 360 reconciliation
  it('T8: Student 360 projection accurately reflects destination class and placement chain', async () => {
    const { studentId, placementId: firstPlacementId } = await createTestStudent({
      name: 'Kenza Bennani',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T8-008',
      nationalId: 'MAS-T8-008',
      placementStartDate: '2026-09-01',
    });

    // Perform transfer
    await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaAId,
      effectiveDate: '2026-09-10',
      actor: adminActor,
    });

    // Fetch user and all placements
    const [studentProfile] = await db.select().from(user).where(eq(user.id, studentId));
    const placements = await db
      .select()
      .from(studentPlacements)
      .where(eq(studentPlacements.studentId, studentId));

    expect(studentProfile?.branchId).toBe(branch2Id);
    expect(studentProfile?.classSectionId).toBe(csBetaAId);
    expect(placements.length).toBe(2);

    const closed = placements.find(p => !p.isCurrent);
    const active = placements.find(p => p.isCurrent);

    expect(closed?.id).toBe(firstPlacementId);
    expect(closed?.endDate).toBe('2026-09-10');
    expect(active?.classSectionId).toBe(csBetaAId);
    expect(active?.promotedFromPlacementId).toBe(firstPlacementId);
  });

  // T9: Attendance historical continuity (past attendance in source class preserved)
  it('T9: Historic attendance records remain intact and unchanged after transfer', async () => {
    const { studentId } = await createTestStudent({
      name: 'Omar Sqalli',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T9-009',
      nationalId: 'MAS-T9-009',
      placementStartDate: '2026-09-01',
    });

    // Seed historic attendance in source class
    const [att] = await db
      .insert(attendance)
      .values({
        tenantId,
        studentId,
        academicYearId: sessionYearId,
        date: '2026-09-05',
        status: 'present',
        period: 1,
      })
      .returning();

    // Perform transfer
    await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaAId,
      effectiveDate: '2026-09-15',
      actor: adminActor,
    });

    // Verify historic attendance row is completely unaltered
    const [existingAtt] = await db.select().from(attendance).where(eq(attendance.id, att!.id));
    expect(existingAtt).toBeDefined();
    expect(existingAtt?.studentId).toBe(studentId);
    expect(existingAtt?.status).toBe('present');
    expect(existingAtt?.isVoided).toBe(false);
  });

  // T10: Guardian & finance preservation
  it('T10: Guardian relationships and financial invoices remain attached across transfers', async () => {
    const { studentId } = await createTestStudent({
      name: 'Leila Filali',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T10-010',
      nationalId: 'MAS-T10-010',
      placementStartDate: '2026-09-01',
    });

    // Create a guardian and link to student
    const [guardian] = await db
      .insert(guardians)
      .values({
        tenantId,
        firstName: 'Mohammed',
        lastName: 'Filali',
        phone: '0661000000',
        email: 'mohammed.filali@test.ma',
      })
      .returning();

    const [link] = await db
      .insert(guardianStudents)
      .values({
        tenantId,
        studentId,
        guardianId: guardian!.id,
        relationshipType: 'father',
        isPrimaryContact: true,
      })
      .returning();

    // Create an invoice
    const [inv] = await db
      .insert(invoices)
      .values({
        tenantId,
        studentId,
        invoiceNumber: `INV-T10-${Date.now().toString().slice(-4)}`,
        status: 'pending',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30',
        amount: 2500,
        netAmount: 2500,
        paidAmount: 0,
      })
      .returning();

    // Perform transfer
    const result = await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaAId,
      effectiveDate: '2026-09-12',
      actor: adminActor,
    });

    expect(result.success).toBe(true);

    // Verify guardian link still active
    const [guardianLink] = await db
      .select()
      .from(guardianStudents)
      .where(eq(guardianStudents.id, link!.id));
    expect(guardianLink).toBeDefined();
    expect(guardianLink?.studentId).toBe(studentId);

    // Verify invoice still attached and unchanged
    const [invoiceRecord] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, inv!.id));
    expect(invoiceRecord).toBeDefined();
    expect(invoiceRecord?.studentId).toBe(studentId);
    expect(invoiceRecord?.amount).toBe(2500);
  });

  // T11: Transactional rollback on write failure
  it('T11: Transactional failure rolls back all mutations, leaving zero partial state', async () => {
    const { studentId, placementId } = await createTestStudent({
      name: 'Mehdi Amrani',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: 'MAT-T11-011',
      nationalId: 'MAS-T11-011',
    });

    // Provide non-existent target branch ID
    const fakeBranchId = crypto.randomUUID();

    await expect(
      executeStudentTransfer({
        tenantId,
        studentId,
        targetBranchId: fakeBranchId,
        targetClassSectionId: csBetaAId,
        actor: adminActor,
      })
    ).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_REFERENCE',
    });

    // Verify rollback: student still in branch1Id and original placement
    const [unchangedUser] = await db.select().from(user).where(eq(user.id, studentId));
    expect(unchangedUser?.branchId).toBe(branch1Id);
    expect(unchangedUser?.classSectionId).toBe(csAlphaAId);

    const [activePlacement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    expect(activePlacement?.id).toBe(placementId);
    expect(activePlacement?.classSectionId).toBe(csAlphaAId);
  });

  // T12: Massar & internal matricule stability
  it('T12: Moroccan Massar ID and internal student matricule remain strictly unchanged', async () => {
    const originalMatricule = 'MAT-T12-999';
    const originalMassar = 'MAS-T12-999';

    const { studentId } = await createTestStudent({
      name: 'Fatima Zahra Tahiri',
      branchId: branch1Id,
      classSectionId: csAlphaAId,
      matricule: originalMatricule,
      nationalId: originalMassar,
      placementStartDate: '2026-09-01',
    });

    // 1st transfer: Cross-campus
    await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaAId,
      effectiveDate: '2026-09-10',
      actor: adminActor,
    });

    const [postTransfer1] = await db.select().from(user).where(eq(user.id, studentId));
    expect(postTransfer1?.matricule).toBe(originalMatricule);
    expect(postTransfer1?.nationalId).toBe(originalMassar);

    // 2nd transfer: Same-campus section move
    await executeStudentTransfer({
      tenantId,
      studentId,
      targetBranchId: branch2Id,
      targetClassSectionId: csBetaBId,
      effectiveDate: '2026-09-20',
      actor: adminActor,
    });

    const [postTransfer2] = await db.select().from(user).where(eq(user.id, studentId));
    expect(postTransfer2?.matricule).toBe(originalMatricule);
    expect(postTransfer2?.nationalId).toBe(originalMassar);
  });
});
