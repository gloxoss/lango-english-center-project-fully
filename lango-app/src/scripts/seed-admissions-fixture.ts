import { eq, and, ilike, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  applicants,
  applicantDocuments,
  admissionInterviews,
  admissionComments,
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

export async function seedAdmissionsFixture() {
  console.log('Seeding Isolated Admissions Acceptance Fixture...');

  // 1. Locate Tenant (Groupe Scolaire Atlas)
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(ilike(tenants.name, '%Atlas%'))
    .limit(1);

  if (!tenant) {
    throw new Error('Tenant Groupe Scolaire Atlas not found');
  }
  const tenantId = tenant.id;

  // 2. Locate Branch & Session
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
  const sessionId = session?.id!;

  // 3. Locate Admin User
  const [adminUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'school_admin')))
    .limit(1);
  const adminId = adminUser?.id || null;

  // 4. Locate Class Section with capacity
  const [sectionRow] = await db
    .select({
      id: classSections.id,
      className: classes.name,
      sectionName: sections.name,
      maxStudents: classSections.maxStudents,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(eq(classSections.tenantId, tenantId))
    .limit(1);

  // 5. Clean up existing fixture records safely
  const fixtureApplicantIds = [
    'c0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002',
    'c0000000-0000-4000-8000-000000000003',
  ];
  const fixtureStudentId = 's0000000-0000-4000-8000-000000000003';
  const fixtureGuardianId = 'a0000000-0000-4000-8000-000000000003';

  await db.delete(admissionComments).where(inArray(admissionComments.applicantId, fixtureApplicantIds));
  await db.delete(applicantDocuments).where(inArray(applicantDocuments.applicantId, fixtureApplicantIds));
  await db.delete(admissionInterviews).where(inArray(admissionInterviews.applicantId, fixtureApplicantIds));
  await db.delete(studentPlacements).where(eq(studentPlacements.studentId, fixtureStudentId));
  await db.delete(guardianStudents).where(eq(guardianStudents.studentId, fixtureStudentId));
  await db.delete(guardians).where(eq(guardians.id, fixtureGuardianId));
  await db.delete(user).where(eq(user.id, fixtureStudentId));
  await db.delete(applicants).where(inArray(applicants.id, fixtureApplicantIds));

  console.log('Previous fixture records pruned cleanly.');

  // 6. Insert Candidate A (In-Review / En revue)
  await db.insert(applicants).values({
    id: 'c0000000-0000-4000-8000-000000000001',
    tenantId,
    branchId,
    sessionYearId: sessionId,
    firstName: 'Kenza',
    lastName: 'Benmoussa',
    email: 'kenza.fixture@acceptance-test.schoolos.ma',
    phone: '0661102030',
    dateOfBirth: '2016-04-12',
    gender: 'female',
    nationalId: 'R192837465',
    city: 'Casablanca',
    guardianName: 'Mme Latifa Benmoussa',
    guardianPhone: '0661992211',
    guardianEmail: 'latifa.benmoussa@fixture.schoolos.ma',
    status: 'in_review',
    checklistInterviewDone: true,
    checklistDocumentsReceived: true,
    checklistFileComplete: false,
    applicationDate: '2026-09-18T09:00:00.000Z',
  });

  await db.insert(applicantDocuments).values([
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000001',
      documentType: 'photo',
      fileExt: 'jpg',
    },
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000001',
      documentType: 'birth_certificate',
      fileExt: 'pdf',
    },
  ]);

  await db.insert(admissionInterviews).values({
    tenantId,
    applicantId: 'c0000000-0000-4000-8000-000000000001',
    status: 'completed',
    scheduledAt: '2026-09-20T10:00:00.000Z',
    interviewerId: adminId,
    notes: 'Excellente candidate. Entretien pédagogique très positif.',
  });

  await db.insert(admissionComments).values({
    tenantId,
    applicantId: 'c0000000-0000-4000-8000-000000000001',
    authorId: adminId,
    body: 'Dossier académique remarquable (18.5/20). Entretien d\'évaluation concluant.',
    createdAt: '2026-09-20T11:00:00.000Z',
  });

  // 7. Insert Candidate B (Approved but NOT enrolled)
  await db.insert(applicants).values({
    id: 'c0000000-0000-4000-8000-000000000002',
    tenantId,
    branchId,
    sessionYearId: sessionId,
    firstName: 'Mehdi',
    lastName: 'Chraibi',
    email: 'mehdi.fixture@acceptance-test.schoolos.ma',
    phone: '0662203040',
    dateOfBirth: '2015-09-25',
    gender: 'male',
    nationalId: 'R987654321',
    city: 'Casablanca',
    guardianName: 'M. Ahmed Chraibi',
    guardianPhone: '0661122334',
    guardianEmail: 'ahmed.chraibi@fixture.schoolos.ma',
    status: 'approved',
    approvedAt: '2026-09-21T14:30:00.000Z',
    approvedById: adminId,
    enrolledAt: null,
    enrolledById: null,
    convertedUserId: null,
    checklistInterviewDone: true,
    checklistDocumentsReceived: true,
    checklistFileComplete: true,
    applicationDate: '2026-09-17T11:00:00.000Z',
  });

  await db.insert(applicantDocuments).values([
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000002',
      documentType: 'photo',
      fileExt: 'jpg',
    },
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000002',
      documentType: 'birth_certificate',
      fileExt: 'pdf',
    },
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000002',
      documentType: 'school_certificate',
      fileExt: 'pdf',
    },
  ]);

  await db.insert(admissionInterviews).values({
    tenantId,
    applicantId: 'c0000000-0000-4000-8000-000000000002',
    status: 'completed',
    scheduledAt: '2026-09-19T14:00:00.000Z',
    interviewerId: adminId,
    notes: 'Validation finale accordée. Profil très adapté au programme bilingue.',
  });

  await db.insert(admissionComments).values({
    tenantId,
    applicantId: 'c0000000-0000-4000-8000-000000000002',
    authorId: adminId,
    body: 'Candidature officiellement approuvée par la commission d\'admission. Prêt pour affectation de classe et inscription finale.',
    createdAt: '2026-09-21T14:35:00.000Z',
  });

  // 8. Insert Candidate C (Enrolled student)
  await db.insert(user).values({
    id: fixtureStudentId,
    tenantId,
    branchId,
    name: 'Amina Tahiri',
    email: 'amina.fixture@acceptance-test.schoolos.ma',
    phone: '0663304050',
    dateOfBirth: '2016-01-14',
    nationalId: 'R554433221',
    role: 'student',
    userStatus: 'active',
    matricule: 'STD-2026-0042',
    classSectionId: sectionRow?.id || null,
  });

  if (sectionRow?.id) {
    await db.insert(studentPlacements).values({
      tenantId,
      studentId: fixtureStudentId,
      classSectionId: sectionRow.id,
      sessionYearId: sessionId,
      isCurrent: true,
      startDate: '2026-09-01',
      status: 'enrolled',
    });
  }

  await db.insert(guardians).values({
    id: fixtureGuardianId,
    tenantId,
    firstName: 'Fatima',
    lastName: 'Tahiri',
    phone: '0661445566',
    email: 'fatima.tahiri@fixture.schoolos.ma',
    defaultRelation: 'mother',
  });

  await db.insert(guardianStudents).values({
    tenantId,
    guardianId: fixtureGuardianId,
    studentId: fixtureStudentId,
    relationshipType: 'mother',
    isPrimaryContact: true,
  });

  await db.insert(applicants).values({
    id: 'c0000000-0000-4000-8000-000000000003',
    tenantId,
    branchId,
    sessionYearId: sessionId,
    firstName: 'Amina',
    lastName: 'Tahiri',
    email: 'amina.fixture@acceptance-test.schoolos.ma',
    phone: '0663304050',
    dateOfBirth: '2016-01-14',
    gender: 'female',
    nationalId: 'R554433221',
    city: 'Casablanca',
    guardianName: 'Mme Fatima Tahiri',
    guardianPhone: '0661445566',
    guardianEmail: 'fatima.tahiri@fixture.schoolos.ma',
    status: 'enrolled',
    approvedAt: '2026-09-20T10:00:00.000Z',
    approvedById: adminId,
    enrolledAt: '2026-09-22T16:00:00.000Z',
    enrolledById: adminId,
    convertedUserId: fixtureStudentId,
    checklistInterviewDone: true,
    checklistDocumentsReceived: true,
    checklistFileComplete: true,
    applicationDate: '2026-09-15T08:30:00.000Z',
  });

  await db.insert(applicantDocuments).values([
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000003',
      documentType: 'photo',
      fileExt: 'jpg',
    },
    {
      tenantId,
      applicantId: 'c0000000-0000-4000-8000-000000000003',
      documentType: 'birth_certificate',
      fileExt: 'pdf',
    },
  ]);

  await db.insert(admissionComments).values({
    tenantId,
    applicantId: 'c0000000-0000-4000-8000-000000000003',
    authorId: adminId,
    body: 'Inscription finalisée avec succès. Matricule officiel STD-2026-0042 attribué. Affectée en classe.',
    createdAt: '2026-09-22T16:05:00.000Z',
  });

  console.log('Successfully seeded all 3 isolated acceptance fixture candidates:');
  console.log('  1. Kenza Benmoussa (in_review) -> c0000000-0000-4000-8000-000000000001');
  console.log('  2. Mehdi Chraibi (approved, not enrolled) -> c0000000-0000-4000-8000-000000000002');
  console.log('  3. Amina Tahiri (enrolled, STD-2026-0042) -> c0000000-0000-4000-8000-000000000003');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed-admissions-fixture.ts')) {
  seedAdmissionsFixture()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fixture seeding error:', err);
      process.exit(1);
    });
}
