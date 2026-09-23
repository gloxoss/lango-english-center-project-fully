import { randomUUID } from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveEffectiveChildren } from '@/features/parent/services/relationship-resolver';
import { db } from '@/libs/DB';
import { transitionStudentToAlumni } from '@/libs/services/alumni-transition';
import {
  account,
  accountSetupTokens,
  alumniDirectoryConsent,
  alumniDocuments,
  attendance,
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

describe('Alumni Lifecycle & Domain Hardening (AL1 - AL15)', () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const branchA = randomUUID();
  const branchB = randomUUID();
  const mediumA = randomUUID();
  const sessionYearA = randomUUID();
  const classA = randomUUID();
  const sectionA = randomUUID();
  const classSectionA = randomUUID();

  const adminUserId = randomUUID();
  const student1Id = randomUUID();
  const student2Id = randomUUID();
  const student3Id = randomUUID();
  const studentSuspendedId = randomUUID();
  const staffUserId = randomUUID();
  const guardianUserId = randomUUID();
  const guardianProfileId = randomUUID();
  const relationshipId = randomUUID();
  const invoice1Id = randomUUID();
  const attendance1Id = randomUUID();

  beforeAll(async () => {
    // 1. Setup tenants & branches
    await db.insert(tenants).values([
      { id: tenantA, name: 'Tenant Alumni A', slug: `ta-${tenantA.slice(0, 6)}` },
      { id: tenantB, name: 'Tenant Alumni B', slug: `tb-${tenantB.slice(0, 6)}` },
    ]);
    await db.insert(branches).values([
      { id: branchA, tenantId: tenantA, name: 'Branch A', code: `BA-${branchA.slice(0, 4)}` },
      { id: branchB, tenantId: tenantB, name: 'Branch B', code: `BB-${branchB.slice(0, 4)}` },
    ]);

    // 2. Setup academic structure in Tenant A
    await db.insert(mediums).values({
      id: mediumA,
      tenantId: tenantA,
      name: 'Français',
    });
    await db.insert(sessionYears).values({
      id: sessionYearA,
      tenantId: tenantA,
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
    });
    await db.insert(classes).values({
      id: classA,
      tenantId: tenantA,
      name: 'Terminale Bac',
      mediumId: mediumA,
    });
    await db.insert(sections).values({
      id: sectionA,
      tenantId: tenantA,
      name: 'Section A',
    });
    await db.insert(classSections).values({
      id: classSectionA,
      tenantId: tenantA,
      classId: classA,
      sectionId: sectionA,
      mediumId: mediumA,
      maxStudents: 35,
    });

    // 3. Setup staff admin and teacher
    await db.insert(user).values([
      {
        id: adminUserId,
        tenantId: tenantA,
        branchId: branchA,
        name: 'Admin Alumni',
        email: `admin-alumni-${adminUserId.slice(0, 6)}@test.local`,
        role: 'school_admin',
        userStatus: 'active',
      },
      {
        id: staffUserId,
        tenantId: tenantA,
        branchId: branchA,
        name: 'Prof Hassan',
        email: `prof-${staffUserId.slice(0, 6)}@test.local`,
        role: 'teacher',
        userStatus: 'active',
      },
    ]);

    // 4. Setup Student 1 with active placement, matricule, Massar, invoice, attendance
    await db.insert(user).values({
      id: student1Id,
      tenantId: tenantA,
      branchId: branchA,
      name: 'Mehdi Alumni Candidate',
      email: `mehdi-${student1Id.slice(0, 6)}@test.local`,
      role: 'student',
      userStatus: 'active',
      dateOfBirth: '2006-05-15',
      matricule: 'MAT-2026-001',
      nationalId: 'M123456789',
    });
    await db.insert(studentPlacements).values({
      id: randomUUID(),
      tenantId: tenantA,
      studentId: student1Id,
      sessionYearId: sessionYearA,
      classSectionId: classSectionA,
      isCurrent: true,
      status: 'enrolled',
      startDate: '2025-09-01',
    });
    await db.insert(invoices).values({
      id: invoice1Id,
      tenantId: tenantA,
      studentId: student1Id,
      invoiceNumber: `INV-${invoice1Id.slice(0, 6)}`,
      amount: 2500,
      netAmount: 2500,
      paidAmount: 0,
      dueDate: '2026-01-15',
      status: 'pending',
    });
    await db.insert(attendance).values({
      id: attendance1Id,
      tenantId: tenantA,
      studentId: student1Id,
      academicYearId: sessionYearA,
      date: '2025-10-15',
      status: 'present',
    });

    // 5. Setup Student 2 with active placement
    await db.insert(user).values({
      id: student2Id,
      tenantId: tenantA,
      branchId: branchA,
      name: 'Fatima Alumni Candidate',
      email: `fatima-${student2Id.slice(0, 6)}@test.local`,
      role: 'student',
      userStatus: 'active',
      dateOfBirth: '2006-08-20',
      matricule: 'MAT-2026-002',
      nationalId: 'F987654321',
    });
    await db.insert(studentPlacements).values({
      id: randomUUID(),
      tenantId: tenantA,
      studentId: student2Id,
      sessionYearId: sessionYearA,
      classSectionId: classSectionA,
      isCurrent: true,
      status: 'enrolled',
      startDate: '2025-09-01',
    });

    // 6. Setup Student 3 (for concurrency testing)
    await db.insert(user).values({
      id: student3Id,
      tenantId: tenantA,
      branchId: branchA,
      name: 'Youssef Concurrency Candidate',
      email: `youssef-${student3Id.slice(0, 6)}@test.local`,
      role: 'student',
      userStatus: 'active',
      dateOfBirth: '2006-03-10',
      matricule: 'MAT-2026-003',
      nationalId: 'Y112233445',
    });
    await db.insert(studentPlacements).values({
      id: randomUUID(),
      tenantId: tenantA,
      studentId: student3Id,
      sessionYearId: sessionYearA,
      classSectionId: classSectionA,
      isCurrent: true,
      status: 'enrolled',
      startDate: '2025-09-01',
    });

    // 7. Setup Inactive Student (for lifecycle validation)
    await db.insert(user).values({
      id: studentSuspendedId,
      tenantId: tenantA,
      branchId: branchA,
      name: 'Karim Inactive Student',
      email: `karim-${studentSuspendedId.slice(0, 6)}@test.local`,
      role: 'student',
      userStatus: 'inactive',
      dateOfBirth: '2006-04-12',
    });

    // 8. Setup Guardian linked to Student 1
    await db.insert(user).values({
      id: guardianUserId,
      tenantId: tenantA,
      name: 'Parent Mehdi',
      email: `parent-mehdi-${guardianUserId.slice(0, 6)}@test.local`,
      role: 'parent',
      userStatus: 'active',
    });
    await db.insert(guardians).values({
      id: guardianProfileId,
      tenantId: tenantA,
      userId: guardianUserId,
      firstName: 'Parent',
      lastName: 'Mehdi',
      email: `parent-mehdi-${guardianUserId.slice(0, 6)}@test.local`,
    });
    await db.insert(guardianStudents).values({
      id: relationshipId,
      tenantId: tenantA,
      guardianId: guardianProfileId,
      studentId: student1Id,
      relationshipType: 'father',
      status: 'active',
      canAccessAcademic: true,
      canAccessAttendance: true,
      canAccessFinance: true,
    });
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await db.delete(accountSetupTokens).where(eq(accountSetupTokens.tenantId, tenantA));
    await db.delete(alumniDocuments).where(eq(alumniDocuments.tenantId, tenantA));
    await db.delete(alumniDirectoryConsent).where(eq(alumniDirectoryConsent.tenantId, tenantA));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantA));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantA));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantA));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantA));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantA));
    await db.delete(account).where(and(eq(account.userId, student1Id)));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantA));
    await db.delete(sections).where(eq(sections.tenantId, tenantA));
    await db.delete(classes).where(eq(classes.tenantId, tenantA));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantA));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantA));
    await db.delete(branches).where(and(eq(branches.tenantId, tenantA)));
    await db.delete(branches).where(and(eq(branches.tenantId, tenantB)));
    await db.delete(tenants).where(and(eq(tenants.id, tenantA)));
    await db.delete(tenants).where(and(eq(tenants.id, tenantB)));
  });

  it('verifies active student is visible in parent portal before graduation', async () => {
    const children = await resolveEffectiveChildren(tenantA, guardianUserId);

    expect(children).toHaveLength(1);
    expect(children[0]!.studentId).toBe(student1Id);
    expect(children[0]!.name).toBe('Mehdi Alumni Candidate');
  });

  it('AL1 & AL7: transitions student to alumni, closes current placement with graduated status, and records cohort', async () => {
    const result = await transitionStudentToAlumni(
      db,
      tenantA,
      student1Id,
      adminUserId,
      sessionYearA,
    );

    expect(result.studentId).toBe(student1Id);
    expect(result.idempotent).toBe(false);

    // Verify user role & metadata
    const [u] = await db.select().from(user).where(eq(user.id, student1Id)).limit(1);

    expect(u).toBeDefined();
    expect(u!.role).toBe('alumni');
    expect(u!.alumniTransitionedAt).not.toBeNull();
    expect(u!.alumniTransitionedBy).toBe(adminUserId);
    expect(u!.graduationCohortSessionYearId).toBe(sessionYearA);

    // Verify studentPlacements was properly closed with status='graduated'
    const [placement] = await db
      .select()
      .from(studentPlacements)
      .where(and(eq(studentPlacements.tenantId, tenantA), eq(studentPlacements.studentId, student1Id)))
      .limit(1);

    expect(placement).toBeDefined();
    expect(placement!.isCurrent).toBe(false);
    expect(placement!.status).toBe('graduated');
    expect(placement!.endDate).not.toBeNull();
  });

  it('AL2: handles already-transitioned alumnus idempotently without duplicate transition or failure', async () => {
    const result = await transitionStudentToAlumni(
      db,
      tenantA,
      student1Id,
      adminUserId,
      sessionYearA,
    );

    expect(result.studentId).toBe(student1Id);
    expect(result.idempotent).toBe(true);
    expect(result.loginAccessDeliveryStatus).toBe('already_alumni');

    // Confirm user is still alumni
    const [u] = await db.select().from(user).where(eq(user.id, student1Id)).limit(1);

    expect(u!.role).toBe('alumni');
  });

  it('AL3: non-student active user cannot be transitioned to alumni', async () => {
    await expect(
      transitionStudentToAlumni(db, tenantA, staffUserId, adminUserId),
    ).rejects.toThrow('Cet utilisateur a le rôle « teacher »');
  });

  it('AL4: wrong tenant rejected', async () => {
    await expect(
      transitionStudentToAlumni(db, tenantB, student1Id, adminUserId),
    ).rejects.toThrow('Élève introuvable dans cet établissement.');
  });

  it('AL5: wrong branch rejected where actor is branch-scoped', async () => {
    await expect(
      transitionStudentToAlumni(db, tenantA, student2Id, adminUserId, undefined, {
        actorBranchId: branchB, // Mismatched branch
      }),
    ).rejects.toThrow('Vous ne pouvez pas transitionner un élève d\'une autre annexe.');
  });

  it('AL6: student with non-active lifecycle state handled explicitly', async () => {
    await expect(
      transitionStudentToAlumni(db, tenantA, studentSuspendedId, adminUserId),
    ).rejects.toThrow('L\'élève doit être actif pour être diplômé (statut actuel : inactive).');
  });

  it('AL8: no active school placement remains after graduation', async () => {
    const activePlacements = await db
      .select({ count: count() })
      .from(studentPlacements)
      .where(
        and(
          eq(studentPlacements.tenantId, tenantA),
          eq(studentPlacements.studentId, student1Id),
          eq(studentPlacements.isCurrent, true),
        ),
      );

    expect(Number(activePlacements[0]?.count ?? 0)).toBe(0);
  });

  it('AL9: matricule and Massar identifier are strictly preserved upon graduation', async () => {
    const [graduated] = await db.select().from(user).where(eq(user.id, student1Id)).limit(1);

    expect(graduated).toBeDefined();
    expect(graduated!.matricule).toBe('MAT-2026-001');
    expect(graduated!.nationalId).toBe('M123456789');
  });

  it('AL10: academic history & attendance records are strictly preserved', async () => {
    const [att] = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantA), eq(attendance.studentId, student1Id)))
      .limit(1);

    expect(att).toBeDefined();
    expect(att!.id).toBe(attendance1Id);
    expect(att!.status).toBe('present');
  });

  it('AL11: finance history and outstanding balances are strictly preserved upon graduation', async () => {
    const [inv] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantA), eq(invoices.studentId, student1Id)))
      .limit(1);

    expect(inv).toBeDefined();
    expect(inv!.id).toBe(invoice1Id);
    expect(Number(inv!.amount)).toBe(2500);
    expect(inv!.status).toBe('pending');
  });

  it('AL12: guardian relationship is preserved historically but graduated student is excluded from active child switcher', async () => {
    // 1. Relationship still exists in database
    const [link] = await db
      .select()
      .from(guardianStudents)
      .where(and(eq(guardianStudents.tenantId, tenantA), eq(guardianStudents.id, relationshipId)))
      .limit(1);

    expect(link).toBeDefined();

    // 2. Child has role='alumni' -> Must NOT be returned by resolveEffectiveChildren
    const children = await resolveEffectiveChildren(tenantA, guardianUserId);

    expect(children).toHaveLength(0);
  });

  it('AL13: user access changes correctly and issues alumni portal setup token', async () => {
    const tokens = await db
      .select()
      .from(accountSetupTokens)
      .where(and(eq(accountSetupTokens.tenantId, tenantA), eq(accountSetupTokens.userId, student1Id)));

    expect(tokens.length).toBeGreaterThan(0);
  });

  it('AL15: concurrent repeated transitions cannot duplicate alumni profile or race', async () => {
    // Run two transitions in parallel on Student 3
    const [res1, res2] = await Promise.all([
      transitionStudentToAlumni(db, tenantA, student3Id, adminUserId),
      transitionStudentToAlumni(db, tenantA, student3Id, adminUserId),
    ]);

    expect([res1.idempotent, res2.idempotent]).toContain(false);
    expect([res1.idempotent, res2.idempotent]).toContain(true);

    // Verify exactly one user record exists in DB with role='alumni'
    const users = await db
      .select()
      .from(user)
      .where(and(eq(user.tenantId, tenantA), eq(user.id, student3Id)));

    expect(users).toHaveLength(1);
    expect(users[0]!.role).toBe('alumni');
  });

  it('reinstates an alumnus back to active student, restoring active parent portal access', async () => {
    const [updated] = await db
      .update(user)
      .set({
        role: 'student',
        alumniTransitionedAt: null,
        alumniTransitionedBy: null,
        graduationCohortSessionYearId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(user.id, student1Id), eq(user.tenantId, tenantA), eq(user.role, 'alumni')))
      .returning({ id: user.id });

    expect(updated).toBeDefined();
    expect(updated!.id).toBe(student1Id);

    const [u1] = await db.select().from(user).where(eq(user.id, student1Id)).limit(1);

    expect(u1!.role).toBe('student');
    expect(u1!.alumniTransitionedAt).toBeNull();
    expect(u1!.alumniTransitionedBy).toBeNull();
    expect(u1!.graduationCohortSessionYearId).toBeNull();

    // Reinstated student now appears back in parent portal!
    const children = await resolveEffectiveChildren(tenantA, guardianUserId);

    expect(children).toHaveLength(1);
    expect(children[0]!.studentId).toBe(student1Id);
  });

  it('guarantees tenant isolation on alumni documents: document in Tenant A cannot be queried with Tenant B filter', async () => {
    const docId = randomUUID();
    await db.insert(alumniDocuments).values({
      id: docId,
      tenantId: tenantA,
      alumnusId: student2Id,
      documentType: 'transcript',
      fileExt: 'pdf',
      verificationCode: `VERIF-${docId.slice(0, 8)}`,
      status: 'active',
    });

    // Query scoped to tenantA succeeds
    const [docTenantA] = await db
      .select()
      .from(alumniDocuments)
      .where(and(
        eq(alumniDocuments.id, docId),
        eq(alumniDocuments.tenantId, tenantA),
        eq(alumniDocuments.alumnusId, student2Id),
      ))
      .limit(1);

    expect(docTenantA).toBeDefined();

    // Cross-tenant query (tenantId: tenantB) returns nothing
    const [docTenantB] = await db
      .select()
      .from(alumniDocuments)
      .where(and(
        eq(alumniDocuments.id, docId),
        eq(alumniDocuments.tenantId, tenantB),
        eq(alumniDocuments.alumnusId, student2Id),
      ))
      .limit(1);

    expect(docTenantB).toBeUndefined();
  });
});
