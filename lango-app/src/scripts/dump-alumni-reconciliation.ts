import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { resolveEffectiveChildren } from '@/features/parent/services/relationship-resolver';
import { db } from '@/libs/DB';
import { transitionStudentToAlumni } from '@/libs/services/alumni-transition';
import {
  accountSetupTokens,
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

async function runAlumniReconciliation() {
  console.log('================================================================');
  console.log('SCHOOLOS ALUMNI LIFECYCLE RUNTIME RECONCILIATION AUDIT');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  const auditTenantId = randomUUID();
  const foreignTenantId = randomUUID();
  const branchId = randomUUID();
  const adminId = randomUUID();
  const studentId = randomUUID();
  const guardianUserId = randomUUID();
  const guardianProfileId = randomUUID();
  const relationshipId = randomUUID();
  const sessionYearPast = randomUUID();
  const sessionYearCurrent = randomUUID();
  const mediumId = randomUUID();
  const classId = randomUUID();
  const sectionId = randomUUID();
  const classSectionId = randomUUID();
  const pastPlacementId = randomUUID();
  const currentPlacementId = randomUUID();
  const invoiceId = randomUUID();
  const attendanceId = randomUUID();

  try {
    // 1. Setup deterministic scenario in audit tenant
    await db.insert(tenants).values([
      { id: auditTenantId, name: 'Audit SchoolOS Alumni', slug: `audit-${auditTenantId.slice(0, 6)}` },
      { id: foreignTenantId, name: 'Foreign Tenant', slug: `foreign-${foreignTenantId.slice(0, 6)}` },
    ]);
    await db.insert(branches).values({
      id: branchId,
      tenantId: auditTenantId,
      name: 'Main Campus',
      code: `MC-${branchId.slice(0, 4)}`,
    });
    await db.insert(mediums).values({
      id: mediumId,
      tenantId: auditTenantId,
      name: 'Bilingue',
    });
    await db.insert(sessionYears).values([
      {
        id: sessionYearPast,
        tenantId: auditTenantId,
        name: '2024-2025',
        startDate: '2024-09-01',
        endDate: '2025-06-30',
      },
      {
        id: sessionYearCurrent,
        tenantId: auditTenantId,
        name: '2025-2026',
        startDate: '2025-09-01',
        endDate: '2026-06-30',
      },
    ]);
    await db.insert(classes).values({
      id: classId,
      tenantId: auditTenantId,
      name: '2ème Bac Sciences Maths',
      mediumId,
    });
    await db.insert(sections).values({
      id: sectionId,
      tenantId: auditTenantId,
      name: 'Section A',
    });
    await db.insert(classSections).values({
      id: classSectionId,
      tenantId: auditTenantId,
      classId,
      sectionId,
      mediumId,
      maxStudents: 30,
    });

    // Admin actor
    await db.insert(user).values({
      id: adminId,
      tenantId: auditTenantId,
      branchId,
      name: 'Directeur Études',
      email: `admin-${adminId.slice(0, 6)}@audit.schoolos.ma`,
      role: 'school_admin',
      userStatus: 'active',
    });

    // Deterministic student candidate
    const originalMatricule = 'MAT-AUDIT-2026';
    const originalNationalId = 'MASSAR-778899';
    const originalName = 'Yassine El Idrissi';

    await db.insert(user).values({
      id: studentId,
      tenantId: auditTenantId,
      branchId,
      name: originalName,
      email: `student-${studentId.slice(0, 6)}@audit.schoolos.ma`,
      role: 'student',
      userStatus: 'active',
      dateOfBirth: '2007-01-20',
      matricule: originalMatricule,
      nationalId: originalNationalId,
    });

    // Historical placement (prior year)
    await db.insert(studentPlacements).values({
      id: pastPlacementId,
      tenantId: auditTenantId,
      studentId,
      sessionYearId: sessionYearPast,
      classSectionId,
      isCurrent: false,
      status: 'enrolled',
      startDate: '2024-09-01',
      endDate: '2025-06-30',
    });

    // Current active placement
    await db.insert(studentPlacements).values({
      id: currentPlacementId,
      tenantId: auditTenantId,
      studentId,
      sessionYearId: sessionYearCurrent,
      classSectionId,
      isCurrent: true,
      status: 'enrolled',
      startDate: '2025-09-01',
    });

    // Academic attendance history
    await db.insert(attendance).values({
      id: attendanceId,
      tenantId: auditTenantId,
      studentId,
      academicYearId: sessionYearCurrent,
      date: '2025-11-10',
      status: 'present',
    });

    // Finance record: unpaid tuition invoice
    const originalInvoiceAmount = 3200;
    await db.insert(invoices).values({
      id: invoiceId,
      tenantId: auditTenantId,
      studentId,
      invoiceNumber: 'INV-AUDIT-001',
      amount: originalInvoiceAmount,
      netAmount: originalInvoiceAmount,
      paidAmount: 0,
      dueDate: '2026-02-01',
      status: 'pending',
    });

    // Guardian relationship
    await db.insert(user).values({
      id: guardianUserId,
      tenantId: auditTenantId,
      name: 'Tuteur Yassine',
      email: `guardian-${guardianUserId.slice(0, 6)}@audit.schoolos.ma`,
      role: 'parent',
      userStatus: 'active',
    });
    await db.insert(guardians).values({
      id: guardianProfileId,
      tenantId: auditTenantId,
      userId: guardianUserId,
      firstName: 'Tuteur',
      lastName: 'Yassine',
      email: `guardian-${guardianUserId.slice(0, 6)}@audit.schoolos.ma`,
    });
    await db.insert(guardianStudents).values({
      id: relationshipId,
      tenantId: auditTenantId,
      guardianId: guardianProfileId,
      studentId,
      relationshipType: 'father',
      status: 'active',
      canAccessAcademic: true,
      canAccessAttendance: true,
      canAccessFinance: true,
    });

    // --- SNAPSHOT BEFORE ---
    console.log('[STAGE 1] SNAPSHOT BEFORE GRADUATION');
    const [uBefore] = await db.select().from(user).where(eq(user.id, studentId)).limit(1);
    const activePlacementsBefore = await db.select().from(studentPlacements).where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));
    const parentPortalChildrenBefore = await resolveEffectiveChildren(auditTenantId, guardianUserId);

    console.log(`- Student Role       : ${uBefore?.role} (expected: student)`);
    console.log(`- Active Placements  : ${activePlacementsBefore.length} (expected: 1)`);
    console.log(`- Parent Portal Child: ${parentPortalChildrenBefore.length} visible (expected: 1)`);
    console.log(`- Matricule          : ${uBefore?.matricule}`);
    console.log(`- NationalId (Massar): ${uBefore?.nationalId}`);

    // --- TRANSITION EXECUTION ---
    console.log('\n[STAGE 2] EXECUTING CANONICAL ALUMNI GRADUATION TRANSITION');
    const transitionResult = await transitionStudentToAlumni(
      db,
      auditTenantId,
      studentId,
      adminId,
      sessionYearCurrent,
    );
    console.log(`- Transition Result  : studentId=${transitionResult.studentId}, idempotent=${transitionResult.idempotent}, method=${transitionResult.loginAccessMethod}`);

    // --- SNAPSHOT AFTER & RECONCILIATION ---
    console.log('\n[STAGE 3] RECONCILIATION AUDIT');

    // 1. Identity Integrity
    const [uAfter] = await db.select().from(user).where(eq(user.id, studentId)).limit(1);
    const identityPass = uAfter?.id === studentId
      && uAfter?.matricule === originalMatricule
      && uAfter?.nationalId === originalNationalId
      && uAfter?.name === originalName;
    console.log(`[1] Identity Unchanged (UUID, Matricule, Massar, Name): ${identityPass ? 'PASS' : 'FAIL'}`);

    // 2. Role and Lifecycle State
    const rolePass = uAfter?.role === 'alumni'
      && uAfter?.alumniTransitionedAt != null
      && uAfter?.alumniTransitionedBy === adminId
      && uAfter?.graduationCohortSessionYearId === sessionYearCurrent;
    console.log(`[2] Role & Transition Metadata Correct                : ${rolePass ? 'PASS' : 'FAIL'}`);

    // 3. Placement History & Closure
    const [currPlacementAfter] = await db.select().from(studentPlacements).where(eq(studentPlacements.id, currentPlacementId)).limit(1);
    const [pastPlacementAfter] = await db.select().from(studentPlacements).where(eq(studentPlacements.id, pastPlacementId)).limit(1);
    const activePlacementsAfter = await db.select().from(studentPlacements).where(and(eq(studentPlacements.studentId, studentId), eq(studentPlacements.isCurrent, true)));

    const placementPass = currPlacementAfter?.isCurrent === false
      && currPlacementAfter?.status === 'graduated'
      && currPlacementAfter?.endDate != null
      && pastPlacementAfter?.isCurrent === false
      && pastPlacementAfter?.status === 'enrolled'
      && activePlacementsAfter.length === 0;
    console.log(`[3] Placement History Closed, 0 Active Remaining      : ${placementPass ? 'PASS' : 'FAIL'}`);

    // 4. Academic History Preservation
    const [attAfter] = await db.select().from(attendance).where(eq(attendance.id, attendanceId)).limit(1);
    const attendancePass = attAfter?.studentId === studentId && attAfter?.status === 'present';
    console.log(`[4] Attendance & Academic History Preserved           : ${attendancePass ? 'PASS' : 'FAIL'}`);

    // 5. Finance History Preservation
    const [invAfter] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    const financePass = invAfter?.studentId === studentId
      && Number(invAfter?.amount) === originalInvoiceAmount
      && invAfter?.status === 'pending';
    console.log(`[5] Finance Truth Preserved (No Balance Erasure)      : ${financePass ? 'PASS' : 'FAIL'}`);

    // 6. Guardian Relationship & Parent Portal Gating
    const [linkAfter] = await db.select().from(guardianStudents).where(eq(guardianStudents.id, relationshipId)).limit(1);
    const parentPortalChildrenAfter = await resolveEffectiveChildren(auditTenantId, guardianUserId);
    const guardianPass = linkAfter?.id === relationshipId && parentPortalChildrenAfter.length === 0;
    console.log(`[6] Guardian Link Preserved, Gated from Active Portal : ${guardianPass ? 'PASS' : 'FAIL'}`);

    // 7. Alumni Self-Service Access
    const setupTokens = await db.select().from(accountSetupTokens).where(and(eq(accountSetupTokens.tenantId, auditTenantId), eq(accountSetupTokens.userId, studentId)));
    const accessPass = setupTokens.length > 0;
    console.log(`[7] Alumni Portal Setup Token Generated               : ${accessPass ? 'PASS' : 'FAIL'}`);

    // 8. Idempotency & Concurrency Safety
    const secondCall = await transitionStudentToAlumni(
      db,
      auditTenantId,
      studentId,
      adminId,
      sessionYearCurrent,
    );
    const allUsersWithId = await db.select().from(user).where(eq(user.id, studentId));
    const idempotencyPass = secondCall.idempotent === true && allUsersWithId.length === 1;
    console.log(`[8] Idempotent Re-execution (No Duplicate Profile)   : ${idempotencyPass ? 'PASS' : 'FAIL'}`);

    // 9. Multi-Tenant Isolation
    const crossTenantQuery = await db.select().from(user).where(and(eq(user.id, studentId), eq(user.tenantId, foreignTenantId)));
    const isolationPass = crossTenantQuery.length === 0;
    console.log(`[9] Multi-Tenant Isolation Intact                     : ${isolationPass ? 'PASS' : 'FAIL'}`);

    const overallPass = identityPass
      && rolePass
      && placementPass
      && attendancePass
      && financePass
      && guardianPass
      && accessPass
      && idempotencyPass
      && isolationPass;

    console.log('\n================================================================');
    console.log(`OVERALL RUNTIME RECONCILIATION RESULT: ${overallPass ? 'ALL CHECKS PASSED ✅' : 'FAILED ❌'}`);
    console.log('================================================================\n');

    if (!overallPass) {
      process.exit(1);
    }
  } finally {
    // Teardown audit rows
    await db.delete(accountSetupTokens).where(eq(accountSetupTokens.tenantId, auditTenantId));
    await db.delete(alumniDocuments).where(eq(alumniDocuments.tenantId, auditTenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, auditTenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, auditTenantId));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, auditTenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, auditTenantId));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, auditTenantId));
    await db.delete(user).where(eq(user.tenantId, auditTenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, auditTenantId));
    await db.delete(sections).where(eq(sections.tenantId, auditTenantId));
    await db.delete(classes).where(eq(classes.tenantId, auditTenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, auditTenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, auditTenantId));
    await db.delete(branches).where(eq(branches.tenantId, auditTenantId));
    await db.delete(tenants).where(eq(tenants.id, auditTenantId));
    await db.delete(tenants).where(eq(tenants.id, foreignTenantId));
  }
}

runAlumniReconciliation().catch((err) => {
  console.error('Alumni reconciliation error:', err);
  process.exit(1);
});
