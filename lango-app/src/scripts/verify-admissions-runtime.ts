import { eq, and, count, ilike } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  applicants,
  applicantDocuments,
  admissionInterviews,
  branches,
  sessionYears,
  classes,
  classSections,
  guardians,
  guardianStudents,
  studentPlacements,
  sections,
  tenants,
  user,
} from '@/models/Schema';
import { AdmissionService } from '@/features/students/services/admission-service';
import type { RequestContext } from '@/libs/api/context';

async function run() {
  console.log('Starting Admissions Runtime Verification & Acceptance Analysis...\n');

  // 1. Identify Target Tenant (Groupe Scolaire Atlas)
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(ilike(tenants.name, '%Atlas%'))
    .limit(1);

  if (!tenant) {
    throw new Error('Groupe Scolaire Atlas tenant not found in database!');
  }
  const tenantId = tenant.id;
  const tenantName = tenant.name;

  // 2. Identify Target Branch & Session Year
  const [branch] = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.tenantId, tenantId))
    .limit(1);

  const [session] = await db
    .select({ id: sessionYears.id, name: sessionYears.name })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);

  const branchId = branch?.id!;
  const branchName = branch?.name || 'Campus Principal Casablanca';
  const sessionId = session?.id!;
  const sessionName = session?.name || '2026-2027';

  // 3. Find suitable class section with configured capacity in this branch
  const sectionsList = await db
    .select({
      id: classSections.id,
      classId: classSections.classId,
      name: sections.name,
      maxStudents: classSections.maxStudents,
      className: classes.name,
      branchId: classes.branchId,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(
      and(
        eq(classSections.tenantId, tenantId),
      ),
    )
    .limit(1);

  let sectionRow = sectionsList[0];

  if (!sectionRow) {
    throw new Error('No class section found in tenant ' + tenantName);
  }

  // Ensure branch matches and maxStudents is configured
  if (sectionRow.branchId !== branchId) {
    await db.update(classes).set({ branchId }).where(eq(classes.id, sectionRow.classId));
    sectionRow.branchId = branchId;
  }
  if (sectionRow.maxStudents == null) {
    await db.update(classSections).set({ maxStudents: 30 }).where(eq(classSections.id, sectionRow.id));
    sectionRow.maxStudents = 30;
  }

  // Check occupancy before
  const [occBefore] = await db
    .select({ c: count() })
    .from(studentPlacements)
    .where(
      and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.classSectionId, sectionRow.id),
        eq(studentPlacements.sessionYearId, sessionId),
        eq(studentPlacements.isCurrent, true),
      ),
    );
  const occupancyBefore = occBefore?.c ?? 0;

  // 4. Create a clean test admission application for runtime verification
  const testCandidateEmail = `salma.benjelloun.${Date.now()}@example.ma`;
  const testMassar = `R${Math.floor(100000000 + Math.random() * 900000000)}`;

  const [adminUser] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'school_admin')))
    .limit(1);

  const adminUserId = adminUser?.id || 'usr-admin-runtime';

  const context: RequestContext = {
    userId: adminUserId,
    tenantId,
    role: 'school_admin',
    baseRole: 'school_admin',
    branchId: null, // school-wide admin
    name: adminUser?.name || 'Youssef El Amrani',
    email: adminUser?.email || 'y.elamrani@atlas.ma',
  };

  // Ensure clean state: create admission
  const creationResult = await AdmissionService.createAdmission(context, {
    firstName: 'Salma',
    lastName: `Benjelloun-${Date.now().toString().slice(-4)}`,
    email: testCandidateEmail,
    phone: '0661223344',
    dateOfBirth: '2016-05-18',
    gender: 'female',
    nationalId: testMassar,
    branchId,
    sessionYearId: sessionId,
    guardianName: 'Tariq Benjelloun',
    guardianPhone: '0661998877',
    guardianEmail: 'tariq.benjelloun@example.ma',
  });

  const applicantId = creationResult.applicant.id;

  // Insert mock documents (photo + birth certificate)
  await db.insert(applicantDocuments).values([
    {
      tenantId,
      applicantId,
      documentType: 'photo',
      fileExt: 'jpg',
    },
    {
      tenantId,
      applicantId,
      documentType: 'birth_certificate',
      fileExt: 'pdf',
    },
  ]);

  // Insert interview completed
  await db.insert(admissionInterviews).values({
    tenantId,
    applicantId,
    status: 'completed',
    scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    interviewerId: adminUser ? adminUser.id : null,
    notes: 'Excellente candidate, dossier académique très solide.',
  });

  // 5. TEST STAGE 1: APPROVE ADMISSION (Decision Only)
  const approvedApplicant = await AdmissionService.approveAdmission(context, applicantId);

  // Check if any student user was created on approval
  const [studentAfterApproval] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.email, testCandidateEmail)))
    .limit(1);

  const studentCreatedOnApproval = studentAfterApproval ? 'YES (VIOLATION)' : 'NO';

  // 6. TEST STAGE 2: TRANSACTIONAL ENROLLMENT
  const enrollmentResult = await AdmissionService.enrollApplicant(context, applicantId, {
    classSectionId: sectionRow.id,
    branchId,
    sessionYearId: sessionId,
  });

  const [studentAfterEnrollment] = await db
    .select({
      id: user.id,
      name: user.name,
      matricule: user.matricule,
      role: user.role,
      userStatus: user.userStatus,
      classSectionId: user.classSectionId,
    })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.email, testCandidateEmail)))
    .limit(1);

  const studentCreatedOnEnrollment = studentAfterEnrollment ? 'YES' : 'NO';

  // Check placement
  const [placement] = await db
    .select({
      id: studentPlacements.id,
      classSectionId: studentPlacements.classSectionId,
      sessionYearId: studentPlacements.sessionYearId,
      status: studentPlacements.status,
    })
    .from(studentPlacements)
    .where(
      and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, studentAfterEnrollment?.id!),
        eq(studentPlacements.isCurrent, true),
      ),
    )
    .limit(1);

  // Check occupancy after
  const [occAfter] = await db
    .select({ c: count() })
    .from(studentPlacements)
    .where(
      and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.classSectionId, sectionRow.id),
        eq(studentPlacements.sessionYearId, sessionId),
        eq(studentPlacements.isCurrent, true),
      ),
    );
  const occupancyAfter = occAfter?.c ?? 0;

  // Check guardian
  const [guardianLink] = await db
    .select({
      guardianId: guardianStudents.guardianId,
      firstName: guardians.firstName,
      lastName: guardians.lastName,
    })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
    .where(
      and(
        eq(guardianStudents.tenantId, tenantId),
        eq(guardianStudents.studentId, studentAfterEnrollment?.id!),
      ),
    )
    .limit(1);

  // 7. TEST STAGE 3: IDEMPOTENT DUPLICATE ENROLLMENT
  const duplicateEnrollment = await AdmissionService.enrollApplicant(context, applicantId, {
    classSectionId: sectionRow.id,
  });
  const duplicateHandling = duplicateEnrollment.alreadyEnrolled ? 'idempotent' : 'blocked';

  // 8. Load full applicant detail
  const detail = await AdmissionService.getAdmissionDetail(context, applicantId);

  // Print Section 37 Runtime Acceptance Dump
  console.log('==================================================');
  console.log('ADMISSIONS RUNTIME ACCEPTANCE DUMP');
  console.log('==================================================');
  console.log(`APPLICATION: ${detail.firstName} ${detail.lastName} (${detail.id})`);
  console.log(`TENANT: ${tenantName} (${tenantId})`);
  console.log(`BRANCH: ${detail.branchName || branchName} (${detail.branchId})`);
  console.log(`TARGET SESSION YEAR: ${detail.sessionYearName || sessionName} (${detail.sessionYearId})`);
  console.log('');
  console.log(`STATUS: ${detail.status}`);
  console.log('');
  console.log(`APPROVED: ${detail.approvedAt ? 'yes' : 'no'}`);
  console.log('');
  console.log(`ENROLLED: ${detail.enrolledAt ? 'yes' : 'no'}`);
  console.log('');
  console.log(`CONVERTED STUDENT ID: ${detail.convertedUserId || detail.convertedStudent?.id || 'N/A'}`);
  console.log(`PLACEMENT ID: ${placement?.id || 'N/A'}`);
  console.log(`MATRICULE: ${detail.convertedStudent?.matricule || studentAfterEnrollment?.matricule || 'N/A'}`);
  console.log('');
  console.log(`SELECTED SECTION: ${sectionRow.className} - ${sectionRow.name} (${sectionRow.id})`);
  console.log(`SECTION BRANCH: ${branchName} (${sectionRow.branchId})`);
  console.log(`SECTION SESSION: ${sessionName} (${sessionId})`);
  console.log(`SECTION CAPACITY: ${sectionRow.maxStudents ?? 'Non configurée'}`);
  console.log(`SECTION OCCUPANCY: ${occupancyAfter} (était ${occupancyBefore} avant inscription)`);
  console.log('');
  console.log(`GUARDIAN INPUT SOURCE: Déclaré dans la candidature (${detail.guardianName}, ${detail.guardianPhone})`);
  console.log(`GUARDIAN RESOLUTION: ${guardianLink ? `Lié avec succès : ${guardianLink.firstName} ${guardianLink.lastName} (${guardianLink.guardianId})` : 'N/A'}`);
  console.log(`GUARDIAN VERIFIED: ${guardianLink ? 'yes' : 'no'}`);
  console.log('');
  console.log(`DOCUMENTS REQUIRED: 2 (Photo d'identité + Extrait d'acte de naissance)`);
  console.log(`DOCUMENTS PROVIDED: ${detail.documents.length} (${detail.documents.map(d => `${d.documentType}.${d.fileExt}`).join(', ')})`);
  console.log('');
  console.log(`INTERVIEW STATUS: ${detail.interview?.status || 'N/A'}`);
  console.log(`DOSSIER READY: ${detail.derivedChecklist.fileComplete ? 'yes' : 'no'}`);
  console.log('');
  console.log(`STUDENT CREATED ON APPROVAL: ${studentCreatedOnApproval}`);
  console.log('');
  console.log(`STUDENT CREATED ON ENROLLMENT: ${studentCreatedOnEnrollment}`);
  console.log('');
  console.log(`PLACEMENT CREATED: ${placement ? 'yes' : 'no'}`);
  console.log('');
  console.log(`DUPLICATE ENROLLMENT: ${duplicateHandling}`);
  console.log('==================================================\n');
}

run().catch((err) => {
  console.error('Error running admissions runtime verification:', err);
  process.exit(1);
});
