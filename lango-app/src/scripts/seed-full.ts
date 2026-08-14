import { hashPassword } from 'better-auth/crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  academicClassOfferings,
  account,
  addonEntitlements,
  announcements,
  assessmentCriteria,
  assessmentPlanCriteria,
  assessmentPlans,
  assessmentResults,
  assessments,
  assessmentDefinitions,
  assignmentSubmissions,
  assignments,
  attendance,
  attendanceRegisters,
  branches,
  classes,
  classSections,
  classSubjects,
  classTeachers,
  employeeLeaveBalances,
  employeeProfiles,
  eventSchedules,
  eventTypes,
  events,
  examHalls,
  examSchedules,
  examTerms,
  feeCategories,
  feeComponents,
  feeStructureAssignments,
  feeStructures,
  gradingScaleIntervals,
  gradingScales,
  guardianStudents,
  guardians,
  hostelAllocations,
  hostelBeds,
  hostelRoomCategories,
  hostelRooms,
  hostels,
  inquiries,
  invoices,
  leaveCategories,
  leaveRequests,
  libraryBibliographicRecords,
  libraryCopies,
  libraryEditions,
  libraryLoans,
  libraryMembers,
  mediums,
  namingSeries,
  payments,
  salaryComponents,
  salaryTemplateComponents,
  salaryTemplates,
  sections,
  session,
  sessionYears,
  studentPlacements,
  subjects,
  subjectTeachers,
  tenants,
  transportRouteStops,
  transportRoutes,
  transportRouteVersions,
  transportStops,
  transportStudentAllocations,
  transportTrips,
  transportVehicles,
  user,
  academicRooms,
  academicTerms,
  academicYears,
  admissionCampaigns,
  admissionComments,
  admissionInterviews,
  alumniDirectoryConsent,
  alumniEventRsvps,
  alumniEvents,
  alumniMentorListings,
  alumniRequests,
  applicantDocuments,
  applicants,
  attendanceExcuses,
  attendanceFlagNotes,
  attendanceFlags,
  attendanceSummary,
  bankAccounts,
  buildings,
  chapters,
  chartOfAccounts,
  classScheduleSlots,
  courseAttachments,
  courseEnrollments,
  courses,
  creditNotes,
  electiveGroups,
  enrollments,
  expenses,
  feeDiscounts,
  feeSchedules,
  fiscalPeriods,
  inquiryFollowUps,
  invoiceItems,
  journalEntries,
  journalEntryLines,
  meetingSlots,
  onlineExamAttempts,
  onlineExamQuestions,
  onlineExams,
  programEnrollments,
  programs,
  promotionBatches,
  promotionDecisions,
  questionBankItems,
  quizAttempts,
  quizQuestions,
  quizzes,
  refunds,
  rolePermissions,
  rooms,
  schoolSettings,
  semesters,
  shifts,
  smsMessages,
  smsTemplates,
  streams,
  studentDiscipline,
  studentDocuments,
  studentElectiveChoices,
  studentGroups,
  studentLeaves,
  timetableSlots,
  timetableVersions,
  userPermissionOverrides,
  employeeSalaryAssignments,
  payrollPeriods,
  payrollRunLines,
  payslips,
} from '@/models/Schema';
import { departments, designations, employeeDocuments, employeeEmploymentEvents, employeeInvitations, salaryAdvances, salaryAdvanceTransactions, employeeAwards } from '@/features/hr/models/hr-schema';
import { employeePayrollProfiles, payrollAdjustments, payrollResultLines, salaryPaymentBatches, salaryPayments, employeeLeavePolicies, employeeLeavePolicyAssignments, employeeLeaveBalanceTransactions, salaryAdvancePolicies, salaryAdvanceRepaymentSchedules, awardDefinitions } from '@/features/workforce/models/workforce-schema';
import { certificateDefinitions, certificateDefinitionVersions, certificateTemplates, certificateTemplateVersions, certificateRequests, issuedCertificates, certificateJobs, certificateJobItems, certificateEvents, certificateSignatories, certificateEventRosters } from '@/features/certificates/models/certificates-schema';
import { documentTemplates, documentTemplateVersions, issuedDocuments, documentGenerationJobs, documentGenerationItems } from '@/features/cards/models/cards-schema';
import { communicationConnections, communicationConsents, communicationSuppressions, communicationSegments, communicationTemplates, communicationTemplateVersions, communicationCampaigns, communicationCampaignRecipients, communicationDeliveries, communicationDeliveryEvents, communicationAutomations, communicationAutomationRuns, communicationAutomationRecipients } from '@/features/broadcast/models/broadcast-schema';
import { marksheetTemplates, examSeats } from '@/features/assessment/models/assessment-schema';
import { customFieldDefinitions, customFieldValues } from '@/features/settings/models/settings-schema';
import { guardGates, guardShifts, guardAssignments, guardVisitorInvitations, guardVisits, guardPickupAuthorizations, guardReleaseEvents, guardGateScanEvents, guardIncidents, guardIncidentActions, guardEmergencyProcedures, guardEmergencyContacts, guardEmergencyActivations } from '@/features/guard/models/guard-schema';
import { scannerDevices, scannerSessions, attendanceScanEvents, workforcePunchEvents } from '@/features/attendance/models/attendance-qr-schema';
import { receptionAppointments, receptionAppointmentStatusHistory, receptionIdentityVerifications, receptionHandoffs, receptionHandoffStatusHistory } from '@/features/reception/models/reception-schema';
import { tenantDomains } from '@/features/platform/models/domains-schema';
import { parentRequests } from '@/features/parent/models/parent-schema';
import { finePolicies, fineAssessments, studentCredits, paymentMethodConfigurations } from '@/features/finance/models/student-accounting-schema';
import { eventVenues, eventInvitations, eventRegistrations, eventCheckins, eventOccurrences } from '@/features/events/models/events-schema';
import { libraryContributors, libraryRecordContributors, libraryPublishers, libraryCategories, librarySubjects, libraryRecordSubjects, libraryLoanPolicies, libraryClosureDays, libraryLoanEvents, libraryHolds, libraryHoldEvents, libraryTransfers, libraryTransferEvents, libraryCharges, libraryChargeAdjustments, libraryNotifications } from '@/features/library/models/library-schema';
import { inventoryCategories, inventoryUnits, inventoryStores, inventorySuppliers, inventoryProducts, inventoryPurchases, inventoryPurchaseLines, inventorySales, inventorySaleLines, inventoryIssues, inventoryIssueLines, inventoryAdjustments, inventoryAdjustmentLines, inventoryTransfers, inventoryTransferLines, inventoryStockMovements, inventoryStockBalances } from '@/features/inventory/models/inventory-schema';
import { hostelPolicies, hostelZones, hostelApplications, hostelRollCalls, hostelRollCallEntries, hostelLeavePasses, hostelLeavePassApprovals, hostelLeavePassReturns } from '@/features/hostel/models/hostel-schema';
import { transportVehicleDocuments, transportCrewAssignments, transportTripRosterSnapshots, transportRiderEvents, transportIncidents, transportIncidentActions, transportFareLinks, transportPolicies } from '@/features/transport/models/transport-schema';

const TENANT_SLUG = 'atlas';
const SEED_PASSWORD = process.env.SCHOOL_ADMIN_SEED_PASSWORD || 'Admin123!';

// ---------------------------------------------------------------------------
// Deterministic data generation
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260810);
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;

const FIRST_M = ['Yassine', 'Omar', 'Adam', 'Karim', 'Mehdi', 'Amine', 'Rayan', 'Anas', 'Hamza', 'Youssef', 'Ilyas', 'Sami', 'Reda', 'Ayoub', 'Badr', 'Nabil', 'Walid', 'Zakaria', 'Ismail', 'Soufiane', 'Tarik', 'Fouad', 'Adil', 'Ibrahim', 'Mahdi', 'Salim', 'Achraf', 'Hamza'];
const FIRST_F = ['Salma', 'Yasmine', 'Fatima', 'Amina', 'Sara', 'Imane', 'Kenza', 'Meryem', 'Nada', 'Hiba', 'Lina', 'Malak', 'Rania', 'Chaimae', 'Douae', 'Khadija', 'Zineb', 'Marwa', 'Sofia', 'Laila', 'Houda', 'Mouna', 'Asma', 'Nisrine', 'Ghita', 'Aya', 'Jihane', 'Sabrine', 'Nour'];
const LAST = ['El Amrani', 'Bennani', 'Tazi', 'Chraibi', 'Fassi', 'Benjelloun', 'Bennis', 'Benslimane', 'Idrissi', 'Ziani', 'Berrada', 'Belkadi', 'Mansouri', 'Alaoui', 'Cherkaoui', 'Ouazzani', 'Sefrioui', 'Tahiri', 'Kabbaj', 'Bouazza', 'Lamrani', 'Sekkat', 'Zahraoui', 'Mouline', 'Naciri', 'El Ghazi', 'Setti', 'Lahlou', 'Rami', 'Hamidi', 'Ait Taleb', 'Bouhaddou', 'Fikri', 'Guedira', 'Jbilou', 'Kettani'];

function fullName(gender?: 'male' | 'female') {
  if (!gender) gender = rand() < 0.5 ? 'male' : 'female';
  const first = gender === 'male' ? pick(FIRST_M) : pick(FIRST_F);
  return { first, last: pick(LAST), gender, name: `${first} ${pick(LAST)}` };
}
const pad2 = (n: number) => String(n).padStart(2, '0');
const pad4 = (n: number) => String(n).padStart(4, '0');

const SUBJECTS = [
  { name: 'Mathématiques', code: 'MATH', type: 'theory' as const },
  { name: 'Physique-Chimie', code: 'PHY', type: 'theory' as const },
  { name: 'SVT', code: 'SVT', type: 'theory' as const },
  { name: 'Français', code: 'FR', type: 'theory' as const },
  { name: 'Anglais', code: 'ANG', type: 'theory' as const },
  { name: 'Histoire-Géographie', code: 'HG', type: 'theory' as const },
  { name: 'Philosophie', code: 'PHIL', type: 'theory' as const },
  { name: 'Informatique', code: 'INFO', type: 'practical' as const },
  { name: 'EPS', code: 'EPS', type: 'practical' as const },
  { name: 'Arabe', code: 'AR', type: 'theory' as const },
  { name: 'Espagnol', code: 'ESP', type: 'theory' as const },
  { name: 'Éducation Islamique', code: 'EI', type: 'theory' as const },
];

// Which subjects each class level teaches.
const CLASS_SUBJECT_MAP: Record<string, string[]> = {
  '3ème': ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géographie', 'Arabe', 'EPS', 'Espagnol', 'Informatique'],
  '2nde': ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géographie', 'Arabe', 'EPS', 'Espagnol', 'Informatique'],
  '1ère': ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géographie', 'Arabe', 'EPS', 'Espagnol', 'Informatique', 'Éducation Islamique'],
  'Terminale': ['Mathématiques', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géographie', 'Philosophie', 'Arabe', 'EPS', 'Espagnol', 'Informatique', 'Éducation Islamique'],
};

function lastWeekdays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < count) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}
const isoDays = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
const isoTs = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString();

async function run() {
  await db.transaction(async (tx) => {
    // -----------------------------------------------------------------------
    // RESET the Atlas tenant (backup taken before running this script).
    // -----------------------------------------------------------------------
    const [existingTenant] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, TENANT_SLUG)).limit(1);
    if (existingTenant) {
      const tid = existingTenant.id;
      // The Atlas tenant carries immutable accounting rows (journal_entries, chart_of_accounts,
      // voucher events...) from the ledger-verification suite; DB guard triggers block their delete.
      // As DB owner (superuser) we switch session_replication_role for this transaction to bypass
      // every trigger/FK, wipe every tenant-scoped table, then the tenant row itself.
      await tx.execute(sql`SET LOCAL session_replication_role = replica`);
      const atlasUsers = await tx.select({ id: user.id }).from(user).where(eq(user.tenantId, tid));
      if (atlasUsers.length) {
        const ids = atlasUsers.map((u) => u.id);
        await tx.delete(account).where(inArray(account.userId, ids));
        await tx.delete(session).where(inArray(session.userId, ids));
      }
      // Every table that has a tenant_id column gets its Atlas rows removed (tid is a DB-sourced uuid).
      await tx.execute(
        sql.raw(`
          DO $do$
          DECLARE r record;
          BEGIN
            FOR r IN
              SELECT table_name FROM information_schema.columns
              WHERE table_schema = 'public' AND column_name = 'tenant_id'
              GROUP BY table_name
            LOOP
              EXECUTE format('DELETE FROM public.%I WHERE tenant_id = %L', r.table_name, '${tid}');
            END LOOP;
          END $do$`)
      );
      await tx.delete(tenants).where(eq(tenants.slug, TENANT_SLUG));
      await tx.execute(sql`SET LOCAL session_replication_role = origin`); // re-arm triggers/FKs for the reseed
      console.log(`  · reset: wiped Atlas tenant (${tid}) incl. immutable ledger`);
    }

    // -----------------------------------------------------------------------
    // Tenant + branch + config
    // -----------------------------------------------------------------------
    const [tenantRow] = await tx
      .insert(tenants)
      .values({ name: 'Groupe Scolaire Atlas', slug: TENANT_SLUG })
      .returning();
    const tenantId = tenantRow!.id;

    // Admin / platform users referenced throughout the seed (reset wiped them with the tenant).
    await tx
      .insert(user)
      .values([
        { id: 'USR-001', tenantId, name: 'Yassine El Amrani', email: 'y.elamrani@atlas.ma', phone: '+212 6 12-345678', role: 'school_admin', userStatus: 'active' },
        { id: 'USR-ACC-001', tenantId, name: 'Karim Bennani (Comptable)', email: 'accountant@atlas.ma', phone: '+212 6 61-998877', role: 'accountant', userStatus: 'active' },
        { id: 'USR-SUPER-001', tenantId: null, name: 'Super Admin Plateforme', email: 'superadmin@schoolos.ma', phone: '+212 6 00-000001', role: 'super_admin', userStatus: 'active' },
      ])
      .onConflictDoNothing();

    // Enable the add-on modules for this tenant so their pages render real
    // content instead of redirecting to /settings/entitlements (requireAddon).
    const ENABLED_ADDONS = [
      'transport', 'library', 'hostel', 'human-resources', 'payroll-workforce',
      'advanced-reporting', 'card-management', 'certificate-management',
      'event-management', 'inventory', 'lead-crm', 'live-classrooms',
    ];
    await tx
      .insert(addonEntitlements)
      .values(ENABLED_ADDONS.map((addonId) => ({ tenantId, addonId, isEnabled: true, grantedById: 'USR-001', note: 'Atlas full-seed enablement' })))
      .onConflictDoNothing();

    const [branchRow] = await tx
      .insert(branches)
      .values({ tenantId, name: 'Siège - Casablanca', code: 'ATL', city: 'Casablanca', address: '12, Avenue Mohammed V', phone: '+212 5 22 00 00 00', email: 'contact@atlas.ma', isDefault: true, isActive: true })
      .returning();
    const branchId = branchRow!.id;

    const [medium] = await tx.insert(mediums).values({ tenantId, name: 'Français' }).returning();
    const mediumId = medium!.id;

    const sectionIds: Record<string, string> = {};
    for (const s of ['A', 'B', 'C']) {
      const [row] = await tx.insert(sections).values({ tenantId, name: s }).returning();
      sectionIds[s] = row!.id;
    }

    const [defaultSession] = await tx
      .insert(sessionYears)
      .values({ tenantId, name: '2025-2026', startDate: '2025-09-01', endDate: '2026-06-30', isDefault: true })
      .returning();
    const sessionYearId = defaultSession!.id;
    await tx.insert(sessionYears).values({ tenantId, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', isDefault: false });

    // Classes (3ème = college, others = lycee) + class-sections (A/B/C each).
    const CLASSES = ['3ème', '2nde', '1ère', 'Terminale'];
    const classInfo: Record<string, { id: string; sections: string[]; offerings: Record<string, string> }> = {};
    for (const className of CLASSES) {
      const [cls] = await tx
        .insert(classes)
        .values({ tenantId, name: className, mediumId, cycle: className === '3ème' ? 'college' : 'lycee' })
        .returning();
      classInfo[className] = { id: cls!.id, sections: [], offerings: {} };
      for (const s of ['A', 'B', 'C']) {
        const [cs] = await tx
          .insert(classSections)
          .values({ tenantId, classId: cls!.id, sectionId: sectionIds[s], mediumId, max_students: 30 })
          .returning();
        classInfo[className].sections.push(cs!.id);
        const [off] = await tx
          .insert(academicClassOfferings)
          .values({ tenantId, sessionYearId, classId: cls!.id, sectionId: sectionIds[s], capacity: 30, status: 'active' })
          .returning();
        classInfo[className].offerings[s] = off!.id;
      }
    }

    // Naming series so generated numbers continue cleanly.
    for (const [prefix, currentVal] of [['ATL-2526', 200] as const, ['INV-2026', 200] as const]) {
      await tx
        .insert(namingSeries)
        .values({ prefix, tenantId, currentVal })
        .onConflictDoUpdate({ target: [namingSeries.tenantId, namingSeries.prefix], set: { currentVal } });
    }

    // Subjects + class_subjects.
    const subjectIds: Record<string, string> = {};
    for (const s of SUBJECTS) {
      const [row] = await tx.insert(subjects).values({ tenantId, mediumId, name: s.name, code: s.code, type: s.type }).returning();
      subjectIds[s.name] = row!.id;
    }
    const classSubjectIds: Record<string, string> = {};
    for (const className of CLASSES) {
      for (const subjName of CLASS_SUBJECT_MAP[className]) {
        const [cs] = await tx
          .insert(classSubjects)
          .values({
            tenantId,
            classId: classInfo[className].id,
            subjectId: subjectIds[subjName],
            type: 'compulsory',
            weeklyMinutes: subjName === 'EPS' ? 120 : 180,
            coefficient: int(1, 4),
            offeringId: classInfo[className].offerings['A'],
          })
          .returning();
        classSubjectIds[`${className}:${subjName}`] = cs!.id;
      }
    }

    // -----------------------------------------------------------------------
    // Teachers (20)
    // -----------------------------------------------------------------------
    const teacherIds: string[] = [];
    const teacherRows = [];
    for (let i = 1; i <= 20; i++) {
      const n = fullName();
      const specialization = SUBJECTS[(i - 1) % SUBJECTS.length].name;
      teacherRows.push({
        id: `USR-TCH-${pad2(i)}`,
        tenantId,
        email: `prof.${pad2(i)}@atlas.ma`,
        name: n.name,
        firstName: n.first,
        lastName: n.last,
        role: 'teacher' as const,
        gender: n.gender,
        phone: `+212 6 ${int(10, 99)}-${int(100000, 999999)}`,
        userStatus: 'active' as const,
        qualification: `${pick(['Licence', 'Master', 'Doctorat'])} ${specialization}`,
        salary: `${int(4000, 12000)}.00`,
        employeeId: `EMP-${pad2(i)}`,
        specialization,
        subjects: [specialization],
        assignedClasses: [pick(['3ème', '2nde', '1ère', 'Terminale'])],
        workloadHours: int(12, 20),
        hireDate: `${int(2014, 2024)}-${pad2(int(1, 12))}-${pad2(int(1, 28))}`,
      });
      teacherIds.push(`USR-TCH-${pad2(i)}`);
    }
    for (let i = 0; i < teacherRows.length; i += 50) await tx.insert(user).values(teacherRows.slice(i, i + 50)).onConflictDoNothing();
    console.log(`  · seeded 20 teachers`);

    // class_teachers + subject_teachers: rotation so every class-section has a
    // primary teacher and every subject has a responsible teacher.
    let tIdx = 0;
    for (const className of CLASSES) {
      for (const csId of classInfo[className].sections) {
        const primary = teacherIds[tIdx % 20];
        tIdx++;
        await tx.insert(classTeachers).values({ tenantId, classSectionId: csId, teacherId: primary }).onConflictDoNothing();
        for (const subjName of CLASS_SUBJECT_MAP[className]) {
          const subjectTeacher = teacherIds[(SUBJECTS.findIndex((s) => s.name === subjName) + 4) % 20];
          await tx
            .insert(subjectTeachers)
            .values({ tenantId, classSectionId: csId, subjectId: subjectIds[subjName], classSubjectId: classSubjectIds[`${className}:${subjName}`], teacherId: subjectTeacher })
            .onConflictDoNothing();
        }
      }
    }

    // -----------------------------------------------------------------------
    // Students (200) + placements + guardians
    // -----------------------------------------------------------------------
    const classSectionList = CLASSES.flatMap((c) => classInfo[c].sections); // 12 entries, index order
    const studentIds: string[] = [];
    const studentRows = [];
    const studentClassOf: Record<string, string> = {};
    for (let i = 1; i <= 200; i++) {
      const n = fullName();
      const csId = classSectionList[(i - 1) % 12];
      const id = `STU-${pad4(i)}`;
      const classNameOf = CLASSES[Math.floor(((i - 1) % 12) / 3)];
      studentClassOf[id] = classNameOf;
      studentRows.push({
        id,
        tenantId,
        email: `etudiant.${pad4(i)}@atlas.ma`,
        name: n.name,
        firstName: n.first,
        lastName: n.last,
        role: 'student' as const,
        gender: n.gender,
        phone: `+212 6 ${int(10, 99)}-${int(100000, 999999)}`,
        dateOfBirth: `${int(2008, 2014)}-${pad2(int(1, 12))}-${pad2(int(1, 28))}`,
        city: 'Casablanca',
        address: `${int(1, 300)}, ${pick(['Rue Ibn Sina', 'Avenue Hassan II', 'Bd Zerktouni', 'Rue Oued Fès'])}`,
        nationality: 'Marocaine',
        bloodGroup: pick(['A+', 'A-', 'B+', 'B-', 'AB+', 'O+', 'O-']),
        matricule: `ATL-2526-${pad4(i)}`,
        classSectionId: csId,
        guardianName: `${pick(['M.', 'Mme'])} ${pick(LAST)}`,
        guardianPhone: `+212 6 ${int(10, 99)}-${int(100000, 999999)}`,
        userStatus: 'active' as const,
        paymentStatus: rand() < 0.9 ? 'À jour' : 'En retard',
      });
      studentIds.push(id);
    }
    for (let i = 0; i < studentRows.length; i += 50) await tx.insert(user).values(studentRows.slice(i, i + 50)).onConflictDoNothing();
    console.log(`  · seeded 200 students`);

    // Placements for all 200.
    const placementRows = studentIds.map((sid) => ({
      tenantId,
      studentId: sid,
      sessionYearId,
      classSectionId: classSectionList[(parseInt(sid.slice(4), 10) - 1) % 12],
      status: 'enrolled' as const,
      startDate: '2025-09-01',
      endDate: null, // current placements are open-ended (student_placements_current_date_check)
      isCurrent: true,
    }));
    for (let i = 0; i < placementRows.length; i += 100) await tx.insert(studentPlacements).values(placementRows.slice(i, i + 100));

    // Guardians (~130): one per ~1.6 students, linked via guardian_students.
    const guardianRows: Array<{ tenantId: string; firstName: string; lastName: string; email: string; phone: string; occupation: string; address: string; defaultRelation: string }> = [];
    for (let g = 0; g < 130; g++) {
      const fn = fullName();
      guardianRows.push({
        tenantId,
        firstName: fn.first,
        lastName: fn.last,
        email: `parent.${pad4(g + 1)}@atlas.ma`,
        phone: `+212 6 ${int(10, 99)}-${int(100000, 999999)}`,
        occupation: pick(['Cadre', 'Commerçant', 'Enseignant', 'Ingénieur', 'Médecin', 'Fonctionnaire', 'Entrepreneur']),
        address: `${int(1, 300)}, ${pick(['Rue Ibn Sina', 'Avenue Hassan II', 'Bd Zerktouni'])}`,
        defaultRelation: 'parent',
      });
    }
    const guardianIds: string[] = [];
    for (let i = 0; i < guardianRows.length; i += 50) {
      const rows = await tx.insert(guardians).values(guardianRows.slice(i, i + 50)).returning({ id: guardians.id });
      guardianIds.push(...rows.map((r) => r.id));
    }
    // Two guardians per student where possible -> ~125 guardian rows used.
    const gsRows = studentIds.flatMap((sid, i) => {
      const g1 = guardianIds[i % 130];
      const rows = [
        { tenantId, guardianId: g1, studentId: sid, relationshipType: 'parent', isPrimaryContact: true, isEmergencyContact: true, status: 'active' },
      ];
      if (i % 2 === 0) rows.push({ tenantId, guardianId: guardianIds[(i + 40) % 130], studentId: sid, relationshipType: 'tuteur', isPrimaryContact: false, isEmergencyContact: false, status: 'active' });
      return rows;
    });
    for (let i = 0; i < gsRows.length; i += 200) await tx.insert(guardianStudents).values(gsRows.slice(i, i + 200));
    console.log(`  · seeded 130 guardians + links`);

    // -----------------------------------------------------------------------
    // Attendance (last 8 weekdays, ~90% present) + registers
    // -----------------------------------------------------------------------
    const days = lastWeekdays(8);
    const teacherIdsForMark = teacherIds;
    const attRows: Array<{ tenantId: string; studentId: string; date: string; period: number; status: string; lateMinutes: number | null; markedById: string }> = [];
    let attCount = 0;
    for (const date of days) {
      for (const sid of studentIds) {
        const r = rand();
        let status = 'present';
        let lateMinutes: number | null = null;
        if (r > 0.9) {
          const r2 = rand();
          status = r2 < 0.4 ? 'absent' : r2 < 0.7 ? 'late' : 'excused';
          if (status === 'late') lateMinutes = int(5, 40);
        }
        attRows.push({ tenantId, studentId: sid, date, period: 1, status, lateMinutes, markedById: teacherIdsForMark[(attCount++) % 20] });
      }
    }
    for (let i = 0; i < attRows.length; i += 400) await tx.insert(attendance).values(attRows.slice(i, i + 400));

    // Registers (one per class per day).
    const regRows = [];
    let regN = 1;
    for (const date of days) {
      for (const className of CLASSES) {
        regRows.push({ tenantId, classId: classInfo[className].id, date, period: 1, reference: `REG-2026-${pad4(regN++)}`, status: 'LOCKED' });
      }
    }
    for (let i = 0; i < regRows.length; i += 100) await tx.insert(attendanceRegisters).values(regRows.slice(i, i + 100));
    console.log(`  · seeded ${attRows.length} attendance rows + ${regRows.length} registers`);

    // -----------------------------------------------------------------------
    // Assessments + exams
    // -----------------------------------------------------------------------
    const [critA] = await tx.insert(assessmentCriteria).values({ tenantId, name: 'Connaissances', description: 'Maîtrise des notions du cours' }).returning();
    const [critB] = await tx.insert(assessmentCriteria).values({ tenantId, name: 'Application', description: 'Capacité à appliquer les notions' }).returning();
    const [critC] = await tx.insert(assessmentCriteria).values({ tenantId, name: 'Raisonnement', description: 'Rigueur et clarté du raisonnement' }).returning();
    const [scale] = await tx.insert(gradingScales).values({ tenantId, name: 'Barème National', description: 'Notation sur 20' }).returning();
    const scaleId = scale!.id;
    const intervals = [
      { gradingScaleId: scaleId, gradeCode: 'A', minScore: 16, maxScore: 20, description: 'Excellent' },
      { gradingScaleId: scaleId, gradeCode: 'B', minScore: 14, maxScore: 15.99, description: 'Très bien' },
      { gradingScaleId: scaleId, gradeCode: 'C', minScore: 12, maxScore: 13.99, description: 'Bien' },
      { gradingScaleId: scaleId, gradeCode: 'D', minScore: 10, maxScore: 11.99, description: 'Passable' },
      { gradingScaleId: scaleId, gradeCode: 'F', minScore: 0, maxScore: 9.99, description: 'Insuffisant' },
    ];
    await tx.insert(gradingScaleIntervals).values(intervals);

    const gradeFor = (pct: number) => (pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F');
    const plans = [
      { className: '2nde', subject: 'Mathématiques' },
      { className: '1ère', subject: 'Mathématiques' },
      { className: 'Terminale', subject: 'Mathématiques' },
      { className: '3ème', subject: 'Français' },
      { className: '1ère', subject: 'Physique-Chimie' },
      { className: '2nde', subject: 'Anglais' },
    ];
    const classStudents: Record<string, string[]> = {};
    for (const sid of studentIds) {
      const c = studentClassOf[sid];
      (classStudents[c] ??= []).push(sid);
    }
    let planN = 1;
    for (const plan of plans) {
      const csKey = `${plan.className}:${plan.subject}`;
      const classSubjectId = classSubjectIds[csKey];
      if (!classSubjectId) continue;
      const [pl] = await tx
        .insert(assessmentPlans)
        .values({ tenantId, name: `Contrôle Continu ${planN} – ${plan.subject} (${plan.className})`, classSubjectId, gradingScaleId: scaleId })
        .returning();
      await tx.insert(assessmentPlanCriteria).values([
        { assessmentPlanId: pl!.id, criteriaId: critA!.id, maxScore: 8, weightPercentage: 40 },
        { assessmentPlanId: pl!.id, criteriaId: critB!.id, maxScore: 7, weightPercentage: 35 },
        { assessmentPlanId: pl!.id, criteriaId: critC!.id, maxScore: 5, weightPercentage: 25 },
      ]);
      const [asmt] = await tx
        .insert(assessments)
        .values({ tenantId, assessmentPlanId: pl!.id, title: `${plan.subject} – CC${planN}`, assessmentDate: isoTs(-int(10, 25)) })
        .returning();
      const results = (classStudents[plan.className] ?? []).map((sid) => {
        const pct = int(30, 98);
        return { tenantId, assessmentId: asmt!.id, studentId: sid, finalPercentage: pct, gradeCode: gradeFor(pct) };
      });
      for (let i = 0; i < results.length; i += 100) await tx.insert(assessmentResults).values(results.slice(i, i + 100));
      planN++;
    }
    console.log(`  · seeded assessment plans + ${6 * 50} results`);

    // Exams: definitions, terms, halls, schedules.
    const examDefRows = plans.slice(0, 4).map((p) => ({
      tenantId,
      classSubjectId: classSubjectIds[`${p.className}:${p.subject}`],
      sessionYearId,
      type: 'paper_exam' as const,
      title: `Examen – ${p.subject} (${p.className})`,
      maximumScore: '20.00',
      coefficient: '2.00',
      passMark: '10.00',
      status: 'published' as const,
      createdBy: 'USR-001',
    }));
    const examDefIds: string[] = [];
    for (const def of examDefRows) {
      const [r] = await tx.insert(assessmentDefinitions).values(def).returning();
      examDefIds.push(r!.id);
    }
    const [term1] = await tx.insert(examTerms).values({ tenantId, sessionYearId, name: 'Semestre 1', code: 'S1', startDate: '2025-11-03', endDate: '2026-01-30', status: 'active', isPublished: true }).returning();
    const [term2] = await tx.insert(examTerms).values({ tenantId, sessionYearId, name: 'Semestre 2', code: 'S2', startDate: '2026-03-02', endDate: '2026-06-26', status: 'setup', isPublished: true }).returning();
    const hallIds: string[] = [];
    for (const h of [['Salle 1', 'H1'], ['Salle 2', 'H2'], ['Salle 3', 'H3']]) {
      const [r] = await tx.insert(examHalls).values({ tenantId, branchId, name: h[0], code: h[1], capacity: 30, isAccessible: true, isActive: true }).returning();
      hallIds.push(r!.id);
    }
    const schedRows = [
      { tenantId, examTermId: term1!.id, assessmentDefinitionId: examDefIds[0], examHallId: hallIds[0], startTime: isoTs(3), endTime: isoTs(3), status: 'published' },
      { tenantId, examTermId: term1!.id, assessmentDefinitionId: examDefIds[1], examHallId: hallIds[1], startTime: isoTs(5), endTime: isoTs(5), status: 'published' },
      { tenantId, examTermId: term2!.id, assessmentDefinitionId: examDefIds[2], examHallId: hallIds[2], startTime: isoTs(30), endTime: isoTs(30), status: 'draft' },
    ];
    await tx.insert(examSchedules).values(schedRows);
    console.log(`  · seeded exam terms/halls/schedules`);

    // -----------------------------------------------------------------------
    // Calendar events
    // -----------------------------------------------------------------------
    const eventTypeIds: string[] = [];
    for (const [name, color] of [
      ['Vacance scolaire', '#F59E0B'],
      ['Réunion parents', '#0066FF'],
      ['Examen', '#EF4444'],
      ['Journée culturelle', '#10B981'],
      ['Événement', '#8B5CF6'],
    ] as const) {
      const [r] = await tx.insert(eventTypes).values({ tenantId, name, style: { color } }).returning();
      eventTypeIds.push(r!.id);
    }
    const eventDefs = [
      { title: 'Réunion parents – rentrée', type: 'event', typeId: eventTypeIds[1], day: 4, allDay: false, desc: 'Réunion d’information pour les familles de tous les niveaux.' },
      { title: 'Examen blanc Semestre 1', type: 'event', typeId: eventTypeIds[2], day: 8, allDay: false, desc: 'Épreuves blanches du premier semestre.' },
      { title: 'Vacances de la Toussaint', type: 'holiday', typeId: eventTypeIds[0], day: 12, allDay: true, desc: 'Congé scolaire.' },
      { title: 'Journée culturelle', type: 'event', typeId: eventTypeIds[3], day: 18, allDay: false, desc: 'Animations et spectacles des élèves.' },
      { title: 'Conseil de classe 3ème', type: 'event', typeId: eventTypeIds[1], day: 24, allDay: false, desc: 'Conseil de classe des troisièmes.' },
      { title: 'Vacances de Noël', type: 'holiday', typeId: eventTypeIds[0], day: 27, allDay: true, desc: 'Congé de fin d’année.' },
      { title: 'Examen final Semestre 1', type: 'event', typeId: eventTypeIds[2], day: 33, allDay: false, desc: 'Épreuves terminales du semestre 1.' },
      { title: 'Réunion parents – résultats S1', type: 'event', typeId: eventTypeIds[1], day: 40, allDay: false, desc: 'Remise des bulletins du premier semestre.' },
      { title: 'Journée portes ouvertes', type: 'event', typeId: eventTypeIds[3], day: 45, allDay: false, desc: 'Présentation de l’établissement aux familles.' },
      { title: 'Clôture administrative', type: 'closure', typeId: eventTypeIds[0], day: 50, allDay: true, desc: 'Fermeture administrative.' },
      { title: 'Olympiades de mathématiques', type: 'event', typeId: eventTypeIds[4], day: 55, allDay: false, desc: 'Concours interne de mathématiques.' },
      { title: 'Remise des diplômes', type: 'event', typeId: eventTypeIds[3], day: 60, allDay: false, desc: 'Cérémonie de fin d’année pour les Terminales.' },
    ];
    const eventIds: string[] = [];
    for (const ev of eventDefs) {
      const [r] = await tx
        .insert(events)
        .values({ tenantId, branchId, ownerId: 'USR-001', typeId: ev.typeId, eventType: ev.type, title: ev.title, description: ev.desc, visibility: 'internal', lifecycle: 'published', publishedAt: isoTs(-7) })
        .returning();
      eventIds.push(r!.id);
    }
    const scheduleRows = eventDefs.map((ev, i) => ({
      tenantId,
      eventId: eventIds[i],
      startTime: ev.allDay ? `${isoDays(ev.day)}T00:00:00.000Z` : `${isoDays(ev.day)}T09:00:00.000Z`,
      endTime: ev.allDay ? `${isoDays(ev.day)}T23:59:59.000Z` : `${isoDays(ev.day)}T17:00:00.000Z`,
      isAllDay: ev.allDay,
      recurrenceRule: 'none' as const,
    }));
    await tx.insert(eventSchedules).values(scheduleRows);
    console.log(`  · seeded ${eventIds.length} calendar events`);

    // -----------------------------------------------------------------------
    // Assignments + announcements
    // -----------------------------------------------------------------------
    const assignmentSubjects = ['Mathématiques', 'Physique-Chimie', 'Français', 'Anglais', 'Histoire-Géographie', 'SVT'];
    const assignmentRows = assignmentSubjects.flatMap((subj, idx) => {
      const className = CLASSES[idx % 4];
      const classSubjectId = classSubjectIds[`${className}:${subj}`];
      if (!classSubjectId) return [];
      return [{
        tenantId,
        classSubjectId,
        title: `Devoir maison – ${subj} (${className})`,
        description: `Série d'exercices sur le chapitre ${idx + 1}. À rendre en binôme.`,
        dueDate: isoTs(int(7, 21)),
        maxScore: '20.00',
        createdById: teacherIds[idx % 20],
      }];
    });
    const assignmentIds: string[] = [];
    for (const a of assignmentRows) {
      const [r] = await tx.insert(assignments).values(a).returning();
      assignmentIds.push(r!.id);
    }
    // Submissions: a subset of students per assignment.
    const subRows = assignmentIds.slice(0, 5).flatMap((aid, idx) => {
      const classStudentsSub = classStudents[CLASSES[idx % 4]] ?? [];
      return classStudentsSub.slice(0, 15).map((sid) => ({
        tenantId,
        assignmentId: aid,
        studentId: sid,
        submittedAt: isoTs(-int(1, 4)),
        score: rand() < 0.8 ? `${int(8, 20)}.00` : null,
        status: rand() < 0.8 ? ('graded' as const) : ('submitted' as const),
      }));
    });
    for (let i = 0; i < subRows.length; i += 100) await tx.insert(assignmentSubmissions).values(subRows.slice(i, i + 100));

    const announceRows = [
      { title: 'Bienvenue à la rentrée 2025-2026', body: 'L’équipe pédagogique souhaite une excellente année à tous les élèves.', targetRole: null as string | null, day: -30 },
      { title: 'Rappel : paiement des frais de scolarité', body: 'La première tranche des frais est exigible avant le 30 septembre.', targetRole: 'parent' as const, day: -20 },
      { title: 'Calendrier des examens du semestre 1', body: 'Les épreuves se dérouleront du 12 au 25 janvier.', targetRole: 'teacher' as const, day: -12 },
      { title: 'Sortie pédagogique au Musée', body: 'Les classes de 3ème visiteront le Musée de la Fondation.', targetRole: 'student' as const, day: -6 },
      { title: 'Inscription aux activités périscolaires', body: 'Clubs de théâtre, robotique et football.', targetRole: null as string | null, day: -2 },
      { title: 'Réunion des délégués de classe', body: 'Élection des délégués prévue vendredi.', targetRole: 'student' as const, day: 2 },
      { title: 'Vaccination des élèves de 2nde', body: 'Campagne de vaccination organisée par le Ministère.', targetRole: 'parent' as const, day: 5 },
      { title: 'Maintenance du portail parent', body: 'Le portail sera indisponible samedi de 20h à 22h.', targetRole: 'parent' as const, day: 9 },
    ];
    await tx.insert(announcements).values(announceRows.map((a) => ({ tenantId, title: a.title, body: a.body, targetRole: a.targetRole, createdById: 'USR-001', publishedAt: isoTs(a.day) })));
    console.log(`  · seeded assignments + ${announceRows.length} announcements`);

    // -----------------------------------------------------------------------
    // Finance
    // -----------------------------------------------------------------------
    const [catA] = await tx.insert(feeCategories).values({ tenantId, name: 'Frais de scolarité', description: 'Scolarité annuelle' }).returning();
    const [catB] = await tx.insert(feeCategories).values({ tenantId, name: 'Transport', description: 'Transport scolaire' }).returning();
    const [catC] = await tx.insert(feeCategories).values({ tenantId, name: 'Cantine', description: 'Restauration scolaire' }).returning();
    const [catD] = await tx.insert(feeCategories).values({ tenantId, name: 'Assurance', description: 'Assurance scolaire' }).returning();
    const feeCategoryIds = [catA!.id, catB!.id, catC!.id, catD!.id];

    const [lyceeFee] = await tx.insert(feeStructures).values({ tenantId, name: 'Lycée Annuel', amount: 24000, description: 'Frais annuels lycée', isActive: true }).returning();
    const [collegeFee] = await tx.insert(feeStructures).values({ tenantId, name: 'Collège Annuel', amount: 20000, description: 'Frais annuels collège', isActive: true }).returning();
    const feeStructuresById = { Lycee: lyceeFee!.id, College: collegeFee!.id };
    const feeComponentDefs = [
      { structure: 'Lycee', items: [['Frais de scolarité', 16000], ['Transport', 3000], ['Cantine', 4000], ['Assurance', 1000]] as [string, number][] },
      { structure: 'College', items: [['Frais de scolarité', 13500], ['Transport', 2500], ['Cantine', 3500], ['Assurance', 500]] as [string, number][] },
    ];
    for (const def of feeComponentDefs) {
      await tx.insert(feeComponents).values(def.items.map(([name, amount], i) => ({ tenantId, feeStructureId: feeStructuresById[def.structure], feeCategoryId: feeCategoryIds[i], name, amount, isMandatory: true })));
    }
    for (const className of CLASSES) {
      await tx.insert(feeStructureAssignments).values({ tenantId, feeStructureId: className === '3ème' ? feeStructuresById.College : feeStructuresById.Lycee, classId: classInfo[className].id });
    }

    const invoicesRows: Array<{ tenantId: string; studentId: string; feeStructureId: string; invoiceNumber: string; amount: number; discountAmount: number; netAmount: number; paidAmount: number; status: string; dueDate: string; issueDate: string }> = [];
    const paymentRows: Array<{ tenantId: string; invoiceId?: string; studentId: string; amount: number; paymentMethod: string; referenceId: string; receivedById: string }> = [];
    const insertedInvoices: Array<{ id: string; studentId: string; amount: number; paidAmount: number }> = [];
    for (let i = 0; i < 200; i++) {
      const sid = `STU-${pad4(i + 1)}`;
      const className = studentClassOf[sid];
      const isCollege = className === '3ème';
      const feeStructureId = isCollege ? feeStructuresById.College : feeStructuresById.Lycee;
      const amount = isCollege ? 20000 : 24000;
      const discount = rand() < 0.12 ? (rand() < 0.5 ? 1000 : 2000) : 0;
      const net = amount - discount;
      let status = 'paid', paid = net;
      if (i >= 140 && i < 160) { status = 'partial'; paid = Math.round(net * 0.5); }
      else if (i >= 160 && i < 180) { status = 'overdue'; paid = 0; }
      else if (i >= 180) { status = 'pending'; paid = 0; }
      invoicesRows.push({
        tenantId,
        studentId: sid,
        feeStructureId,
        invoiceNumber: `INV-2026-${pad4(i + 1)}`,
        amount,
        discountAmount: discount,
        netAmount: net,
        paidAmount: paid,
        status,
        dueDate: i % 3 === 0 ? isoDays(20) : isoDays(-15),
        issueDate: isoDays(-int(5, 40)),
      });
      if (status === 'paid' || status === 'partial') {
        paymentRows.push({ tenantId, studentId: sid, amount: paid, paymentMethod: pick(['cash', 'card', 'transfer', 'check']), referenceId: `PAY-${pad4(i + 1)}`, receivedById: 'USR-ACC-001' });
      }
    }
    for (let i = 0; i < invoicesRows.length; i += 100) {
      const chunk = invoicesRows.slice(i, i + 100);
      const rows = await tx.insert(invoices).values(chunk).returning({ id: invoices.id, studentId: invoices.studentId });
      rows.forEach((r, k) => insertedInvoices.push({ id: r.id, studentId: r.studentId!, amount: chunk[k]!.amount, paidAmount: chunk[k]!.paidAmount }));
    }
    // Payment rows: fill invoiceId by matching studentId (deterministic).
    const paymentIdByStudent = new Map<string, string>();
    for (const pay of paymentRows) {
      const inv = insertedInvoices.find((x) => x.studentId === pay.studentId);
      const [pr] = await tx.insert(payments).values({ ...pay, invoiceId: inv!.id, paymentDate: isoDays(-int(1, 30)) }).returning({ id: payments.id, studentId: payments.studentId });
      if (pr) paymentIdByStudent.set(pr.studentId!, pr.id);
    }
    console.log(`  · seeded 200 invoices + ${paymentRows.length} payments`);

    // -----------------------------------------------------------------------
    // HR / payroll (teachers)
    // -----------------------------------------------------------------------
    const [depTeach] = await tx.insert(departments).values({ tenantId, name: 'Enseignement', code: 'ENS', description: 'Corps enseignant', status: 'active' }).returning();
    const [depAdmin] = await tx.insert(departments).values({ tenantId, name: 'Administration', code: 'ADM', description: 'Administration', status: 'active' }).returning();
    const [depDir] = await tx.insert(departments).values({ tenantId, name: 'Direction', code: 'DIR', description: 'Direction', status: 'active' }).returning();
    const [desProf] = await tx.insert(designations).values({ tenantId, departmentId: depTeach!.id, title: 'Professeur', code: 'PROF', status: 'active' }).returning();
    await tx.insert(designations).values({ tenantId, departmentId: depAdmin!.id, title: 'Comptable', code: 'COMP', status: 'active' });
    await tx.insert(designations).values({ tenantId, departmentId: depDir!.id, title: 'Principal', code: 'PRIN', status: 'active' });
    const profRows = teacherIds.map((tid, i) => ({
      tenantId,
      userId: tid,
      employeeId: `EMP-${pad2(i + 1)}`,
      firstName: `Professeur ${i + 1}`,
      lastName: 'Atlas',
      departmentId: depTeach!.id,
      designationId: desProf!.id,
      employmentType: 'full_time',
      employmentStatus: 'active' as const,
      hireDate: `${int(2014, 2024)}-${pad2(int(1, 12))}-${pad2(int(1, 28))}`,
      workloadHours: int(12, 20),
      cnssNumber: `CNSS-${int(10000000, 99999999)}`,
      contractType: 'cdi' as const,
      salary: `${int(4000, 12000)}.00`,
    }));
    await tx.insert(employeeProfiles).values(profRows);

    const [compBase] = await tx.insert(salaryComponents).values({ tenantId, name: 'Salaire de base', type: 'earning', rateType: 'fixed', isStatutory: false }).returning();
    const [compTransp] = await tx.insert(salaryComponents).values({ tenantId, name: 'Indemnité transport', type: 'earning', rateType: 'fixed', fixedValue: '500.0000', isStatutory: false }).returning();
    await tx.insert(salaryComponents).values({ tenantId, name: 'CNSS', type: 'deduction', rateType: 'percent', isStatutory: true });
    const [tpl] = await tx.insert(salaryTemplates).values({ tenantId, name: 'Enseignant - défaut' }).returning();
    await tx.insert(salaryTemplateComponents).values([
      { templateId: tpl!.id, componentId: compBase!.id, sortOrder: 1 },
      { templateId: tpl!.id, componentId: compTransp!.id, sortOrder: 2 },
    ]);

    const [leaveCat1] = await tx.insert(leaveCategories).values({ tenantId, name: 'Congé annuel', daysPerYear: 30, isPaid: true }).returning();
    const [leaveCat2] = await tx.insert(leaveCategories).values({ tenantId, name: 'Congé maladie', daysPerYear: 15, isPaid: true }).returning();
    await tx.insert(leaveCategories).values({ tenantId, name: 'Congé sans solde', daysPerYear: 0, isPaid: false });
    const balances = teacherIds.flatMap((tid) => [
      { tenantId, userId: tid, categoryId: leaveCat1!.id, year: 2026, accruedDays: 30, usedDays: int(0, 8), reservedDays: 0 },
      { tenantId, userId: tid, categoryId: leaveCat2!.id, year: 2026, accruedDays: 15, usedDays: int(0, 4), reservedDays: 0 },
    ]);
    for (let i = 0; i < balances.length; i += 100) await tx.insert(employeeLeaveBalances).values(balances.slice(i, i + 100));
    const leaveReqRows = teacherIds.slice(0, 6).map((tid, i) => {
      const start = int(15, 30);
      return {
        tenantId,
        userId: tid,
        categoryId: leaveCat1!.id,
        startDate: isoDays(start),
        endDate: isoDays(start + int(2, 5)),
        daysRequested: 3,
        status: pick(['approved', 'pending', 'pending']),
        reason: 'Congé personnel',
      };
    });
    await tx.insert(leaveRequests).values(leaveReqRows);
    console.log(`  · seeded HR: 20 employee profiles, salary, leave`);

    // -----------------------------------------------------------------------
    // Add-ons: hostel, transport, library, inquiries
    // -----------------------------------------------------------------------
    // Hostel (2 hostels, rooms, beds, ~30 allocations).
    const hostelDefs = [
      { code: 'HST-B', name: 'Foyer Garçons', gender: 'male_only' },
      { code: 'HST-G', name: 'Foyer Filles', gender: 'female_only' },
    ] as const;
    const hostelIds: string[] = [];
    const [roomCat] = await tx.insert(hostelRoomCategories).values({ tenantId, name: 'Chambre 3 lits', code: 'CH3', defaultCapacity: 3, eligibleGenderPolicy: 'mixed', baseCharge: '3000.00', depositAmount: '1500.00', status: 'active' }).returning();
    for (const h of hostelDefs) {
      const [ho] = await tx.insert(hostels).values({ tenantId, branchId, code: h.code, name: h.name, genderPolicy: h.gender, capacity: 12, status: 'active' }).returning();
      hostelIds.push(ho!.id);
      for (let r = 1; r <= 4; r++) {
        const [room] = await tx.insert(hostelRooms).values({ tenantId, hostelId: ho!.id, categoryId: roomCat!.id, code: `${h.code}-R${r}`, name: `Chambre ${r}`, status: 'active' }).returning();
        for (let b = 1; b <= 3; b++) {
          const [bed] = await tx.insert(hostelBeds).values({ tenantId, roomId: room!.id, code: `${h.code}-R${r}-B${b}`, status: 'active' }).returning();
          // allocate bed to a student when the count is within the 30 allocations.
          const allocIndex = (r - 1) * 3 + (b - 1);
          if (allocIndex < 15) {
            const studentId = studentIds[allocIndex + (h.gender === 'male_only' ? 0 : 15)];
            if (studentId) {
              await tx.insert(hostelAllocations).values({ tenantId, studentId, bedId: bed!.id, effectiveStartDate: '2025-09-01', effectiveEndDate: '2026-06-30', state: 'checked_in', chargeSnapshot: { baseCharge: 3000 } });
            }
          }
        }
      }
    }
    console.log(`  · seeded hostel (2 foyers, 30 allocations)`);

    // Transport (2 vehicles, 6 stops, 3 routes + versions/stops, 40 allocations, 2 trips).
    const vehicleIds: string[] = [];
    for (const v of [['V1', 'VH-ATL-101', 30], ['V2', 'VH-ATL-102', 30]] as const) {
      const [row] = await tx.insert(transportVehicles).values({ tenantId, vehicleCode: v[0], registrationNumber: v[1], capacity: v[2], vehicleType: 'bus', makeModel: 'Mercedes Sprinter', status: 'active' }).returning();
      vehicleIds.push(row!.id);
    }
    const stopNames = ['Casa Centre', 'Ain Sebaa', 'Sidi Moumen', 'Maarif', 'Bourgogne', 'Hay Hassani'];
    const stopIds: string[] = [];
    for (const s of stopNames) {
      const [row] = await tx.insert(transportStops).values({ tenantId, stopCode: `STP-${s.split(' ')[0].toUpperCase()}`, stopName: s, address: s, status: 'active' }).returning();
      stopIds.push(row!.id);
    }
    const routeIds: string[] = [];
    const versionIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [route] = await tx.insert(transportRoutes).values({ tenantId, routeCode: `RTE-${i + 1}`, routeName: `Ligne ${i + 1}`, serviceDirection: 'bidirectional', assignedVehicleId: vehicleIds[i % 2], status: 'active' }).returning();
      routeIds.push(route!.id);
      const [version] = await tx.insert(transportRouteVersions).values({ tenantId, routeId: route!.id, versionNumber: 1, effectiveStartDate: '2025-09-01', status: 'published' }).returning();
      versionIds.push(version!.id);
      for (let s = 0; s < 2; s++) {
        const stopIdx = (i * 2 + s) % 6;
        await tx.insert(transportRouteStops).values({ tenantId, versionId: version!.id, stopId: stopIds[stopIdx], stopSequence: s + 1, plannedArrivalTime: `${7 + s * 2}:30`, pickupAllowed: true, dropoffAllowed: true });
      }
    }
    for (let i = 0; i < 40; i++) {
      const sid = studentIds[i];
      await tx.insert(transportStudentAllocations).values({
        tenantId,
        studentId: sid,
        routeId: routeIds[i % 3],
        pickupStopId: stopIds[(i * 2) % 6],
        dropoffStopId: stopIds[(i * 2 + 1) % 6],
        direction: 'both',
        effectiveStartDate: '2025-09-01',
        effectiveEndDate: '2026-06-30',
        status: 'active',
      });
    }
    for (let i = 0; i < 2; i++) {
      await tx.insert(transportTrips).values({ tenantId, routeId: routeIds[i], routeVersionId: versionIds[i], serviceDate: isoDays(-1), direction: 'pickup', plannedStartTime: '07:15', plannedEndTime: '08:00', vehicleId: vehicleIds[i], status: 'completed' });
    }
    console.log(`  · seeded transport (3 routes, 40 allocations)`);

    // Library (~20 records, editions, copies, members, loans).
    const bookTitles = [
      'Le Petit Prince', 'Les Misérables', 'Candide', 'L’Étranger', 'La Boîte à merveilles', 'Antigone',
      'Mathématiques Terminale', 'Physique 1ère', 'Grammar for Schools', 'Histoire du Maroc', 'La Nuit sacrée',
      'Bel-Ami', 'L’Enfant noir', 'Les Fleurs du mal', 'Robinson Crusoé', 'Le Comte de Monte-Cristo',
      'Algèbre et Géométrie', 'Exercices de chimie', 'English Essays', 'Géographie du monde arabe',
    ];
    const recordIds: string[] = [];
    for (const t of bookTitles) {
      const [rec] = await tx.insert(libraryBibliographicRecords).values({ tenantId, title: t, language: t.includes('English') || t.includes('Grammar') ? 'en' : 'fr', publicationYear: int(1950, 2023), summary: `Ouvrage de référence : ${t}` }).returning();
      recordIds.push(rec!.id);
    }
    const editionIds: string[] = [];
    for (let i = 0; i < recordIds.length; i++) {
      const [ed] = await tx.insert(libraryEditions).values({ tenantId, recordId: recordIds[i], isbn13: String(int(1000000000000, 9999999999999)), publicationYear: int(1990, 2023), pages: int(100, 600), format: 'paperback' }).returning();
      editionIds.push(ed!.id);
    }
    const copyRows: Array<{ tenantId: string; editionId: string; branchId: string; accessionNumber: string; barcode: string; shelfLocation: string; condition: string; state: string; acquiredAt: string }> = [];
    let copyN = 1;
    for (let i = 0; i < editionIds.length; i++) {
      for (let c = 0; c < (i % 3 === 0 ? 2 : 1); c++) {
        copyRows.push({ tenantId, editionId: editionIds[i], branchId, accessionNumber: `ACC-${pad4(copyN)}`, barcode: `BC-${pad4(copyN)}`, shelfLocation: `ETAGERE-${(i % 5) + 1}`, condition: 'good', state: 'available', acquiredAt: `2023-${pad2(int(1, 12))}-${pad2(int(1, 28))}` });
        copyN++;
      }
    }
    const copyIds: string[] = [];
    for (let i = 0; i < copyRows.length; i += 50) {
      const rows = await tx.insert(libraryCopies).values(copyRows.slice(i, i + 50)).returning({ id: libraryCopies.id });
      copyIds.push(...rows.map((r) => r.id));
    }
    const memberRows = studentIds.slice(0, 20).map((sid, i) => ({ tenantId, userId: sid, memberNumber: `MEM-${pad4(i + 1)}`, branchId, state: 'active' as const }));
    const memberIds: string[] = [];
    for (let i = 0; i < memberRows.length; i += 50) {
      const rows = await tx.insert(libraryMembers).values(memberRows.slice(i, i + 50)).returning({ id: libraryMembers.id });
      memberIds.push(...rows.map((r) => r.id));
    }
    const loanRows = copyIds.slice(0, 10).map((copyId, i) => ({
      tenantId,
      copyId,
      memberId: memberIds[i % memberIds.length],
      issuedById: 'USR-001',
      issuedAt: isoDays(-int(3, 25)),
      dueDate: isoDays(int(5, 20)),
      returnedAt: i % 3 === 0 ? isoDays(-2) : null,
      returnState: i % 3 === 0 ? 'good' : null,
      policySnapshot: {},
      note: null as string | null,
    }));
    await tx.insert(libraryLoans).values(loanRows);
    console.log(`  · seeded library (${bookTitles.length} records, ${memberIds.length} members)`);

    // Inquiries (CRM).
    const inquiryRows = [
      { contactName: 'Hicham Benjelloun', phone: '+212 6 71-111111', email: 'h.benjelloun@email.com', source: 'web' as const, interestLevel: 'high' as const, status: 'converted' as const, notes: 'Inscription Terminale S.' },
      { contactName: 'Saloua Fassi', phone: '+212 6 72-222222', email: 's.fassi@email.com', source: 'referral' as const, interestLevel: 'medium' as const, status: 'qualified' as const, notes: 'Veut des infos sur les bourses.' },
      { contactName: 'Abdelkader Rami', phone: '+212 6 73-333333', email: 'a.rami@email.com', source: 'walk_in' as const, interestLevel: 'high' as const, status: 'new' as const, notes: 'Visite l’établissement.' },
      { contactName: 'Nawal Sekkat', phone: '+212 6 74-444444', email: 'n.sekkat@email.com', source: 'phone' as const, interestLevel: 'low' as const, status: 'contacted' as const, notes: 'Question sur les frais.' },
      { contactName: 'Youssef Berrada', phone: '+212 6 75-555555', email: 'y.berrada@email.com', source: 'facebook_ads' as const, interestLevel: 'medium' as const, status: 'new' as const, notes: 'Inscription 1ère.' },
      { contactName: 'Meryem Kettani', phone: '+212 6 76-666666', email: 'm.kettani@email.com', source: 'google_ads' as const, interestLevel: 'high' as const, status: 'qualified' as const, notes: 'Internat demandé.' },
    ];
    await tx.insert(inquiries).values(inquiryRows.map((q) => ({ ...q, tenantId, assignedToId: 'USR-001' })));
    console.log(`  · seeded 6 inquiries`);

    // -----------------------------------------------------------------------
    // Academic config: buildings/rooms, academic years/terms, semesters,
    // streams, shifts (matin/après-midi), electives, timetable version.
    // -----------------------------------------------------------------------
    const [buildA] = await tx.insert(buildings).values({ tenantId, name: 'Bâtiment A', code: 'BAT-A', address: '12, Avenue Mohammed V' }).returning();
    const [buildB] = await tx.insert(buildings).values({ tenantId, name: 'Bâtiment B', code: 'BAT-B', address: '14, Avenue Mohammed V' }).returning();
    const roomIds: string[] = [];
    for (const b of [buildA!, buildB!]) {
      for (let r = 1; r <= 4; r++) {
        const [rm] = await tx.insert(rooms).values({ tenantId, buildingId: b.id, name: `Salle ${b.code}-${r}`, capacity: int(20, 35), roomType: r === 4 ? 'laboratoire' : 'cours', isActive: true }).returning();
        roomIds.push(rm!.id);
      }
    }
    await tx.insert(academicRooms).values([
      { tenantId, name: 'Salle polyvalente 1', capacity: 30, roomType: 'cours', isActive: true },
      { tenantId, name: 'Laboratoire de sciences', capacity: 24, roomType: 'laboratoire', isActive: true },
      { tenantId, name: 'Salle informatique', capacity: 28, roomType: 'informatique', isActive: true },
      { tenantId, name: 'Salle des professeurs', capacity: 40, roomType: 'réunion', isActive: true },
    ]);
    const [ay25] = await tx.insert(academicYears).values({ tenantId, name: '2025-2026', startDate: '2025-09-01T00:00:00.000Z', endDate: '2026-06-30T23:59:59.000Z', isActive: true }).returning();
    const [ayTerm1] = await tx.insert(academicTerms).values({ tenantId, academicYearId: ay25!.id, name: 'Semestre 1', startDate: '2025-11-03T00:00:00.000Z', endDate: '2026-01-30T23:59:59.000Z', isCurrent: true }).returning();
    const [ayTerm2] = await tx.insert(academicTerms).values({ tenantId, academicYearId: ay25!.id, name: 'Semestre 2', startDate: '2026-03-02T00:00:00.000Z', endDate: '2026-06-26T23:59:59.000Z', isCurrent: false }).returning();
    await tx.insert(semesters).values([
      { tenantId, name: 'Semestre 1', startMonth: 9, endMonth: 1 },
      { tenantId, name: 'Semestre 2', startMonth: 2, endMonth: 6 },
    ]);
    await tx.insert(streams).values([
      { tenantId, name: 'Sciences' },
      { tenantId, name: 'Lettres' },
      { tenantId, name: 'Économie' },
      { tenantId, name: 'Technologie' },
    ]);
    const shiftIds: string[] = [];
    for (const [name, st, en] of [['Matin', '08:00', '13:00'], ['Après-midi', '14:00', '18:30']] as const) {
      const [sh] = await tx.insert(shifts).values({ tenantId, name, startTime: st, endTime: en, isActive: true }).returning();
      shiftIds.push(sh!.id);
    }
    const electiveGroupIds: string[] = [];
    for (const className of CLASSES) {
      const [eg] = await tx.insert(electiveGroups).values({ tenantId, classId: classInfo[className].id, name: `Option ${className}`, maxChoices: 1 }).returning();
      electiveGroupIds.push(eg!.id);
    }
    const electiveRows = studentIds.slice(0, 40).map((sid) => {
      const ci = CLASSES.indexOf(studentClassOf[sid]);
      return { tenantId, studentId: sid, electiveGroupId: electiveGroupIds[ci], subjectId: subjectIds[pick(['Espagnol', 'Informatique', 'Éducation Islamique', 'Arabe'])] };
    });
    for (let i = 0; i < electiveRows.length; i += 50) await tx.insert(studentElectiveChoices).values(electiveRows.slice(i, i + 50));
    const [tv] = await tx.insert(timetableVersions).values({ tenantId, sessionYearId, status: 'published', versionNumber: 1, effectiveFrom: '2025-09-01', createdBy: 'USR-001', publishedBy: 'USR-001', publishedAt: isoTs(-60) }).returning();
    const timetableVersionId = tv!.id;
    console.log(`  · seeded academic config (buildings, terms, shifts, electives, timetable v1)`);

    // -----------------------------------------------------------------------
    // Content / LMS: programs, courses, chapters, enrollments, student groups,
    // question banks, quizzes, online exams.
    // -----------------------------------------------------------------------
    const programDefs = [
      { name: 'Lycée Général', description: 'Programme du cycle secondaire qualifiant' },
      { name: 'Collège', description: 'Programme du cycle secondaire collégial' },
      { name: 'Section Internationale', description: 'Enseignement renforcé en langues' },
    ];
    const programIds: string[] = [];
    for (const p of programDefs) {
      const [pr] = await tx.insert(programs).values({ tenantId, name: p.name, description: p.description, status: 'active' }).returning();
      programIds.push(pr!.id);
    }
    const courseIds: string[] = [];
    const courseByClass: Record<string, string> = {};
    const courseNameOf: string[] = [];
    for (const className of CLASSES) {
      const subjects = CLASS_SUBJECT_MAP[className];
      const subj = subjects[0]!; // flagship subject per class
      const [cr] = await tx.insert(courses).values({ tenantId, programId: programIds[className === '3ème' ? 1 : 0], name: `${subj} – ${className}`, courseCode: `${subj.slice(0, 3).toUpperCase()}-${className}`, description: `Cours de ${subj} pour la classe de ${className}`, isPublished: true, isFree: false, durationHours: int(20, 40), price: 0 }).returning();
      courseIds.push(cr!.id);
      courseByClass[className] = cr!.id;
    }
    const chapterRows: Array<{ tenantId: string; courseId: string; title: string; content: string; position: number; isPublished: boolean; isFree: boolean }> = [];
    const chapterOfCourse: Record<string, string[]> = {};
    let chN = 1;
    for (const cid of courseIds) {
      chapterOfCourse[cid] = [];
      for (let c = 1; c <= 5; c++) {
        chapterRows.push({ tenantId, courseId: cid, title: `Chapitre ${c}`, content: `Contenu pédagogique du chapitre ${c}.`, position: c, isPublished: true, isFree: c === 1 });
        chN++;
      }
    }
    const chapterIds: string[] = [];
    for (let i = 0; i < chapterRows.length; i += 50) {
      const rows = await tx.insert(chapters).values(chapterRows.slice(i, i + 50)).returning({ id: chapters.id });
      chapterIds.push(...rows.map((r) => r.id));
    }
    const courseAttachmentRows = courseIds.flatMap((cid, ci) => [
      { tenantId, courseId: cid, name: `Programme ${ci + 1}.pdf`, url: `https://cdn.atlas.ma/programmes/${ci + 1}.pdf` },
      { tenantId, courseId: cid, name: `Bibliographie ${ci + 1}.pdf`, url: `https://cdn.atlas.ma/biblio/${ci + 1}.pdf` },
    ]);
    for (let i = 0; i < courseAttachmentRows.length; i += 50) await tx.insert(courseAttachments).values(courseAttachmentRows.slice(i, i + 50));
    const progEnrollRows = studentIds.slice(0, 120).map((sid) => ({ tenantId, studentId: sid, programId: programIds[studentClassOf[sid] === '3ème' ? 1 : 0], academicTermId: ayTerm1!.id, enrollmentDate: '2025-09-05T08:00:00.000Z', status: 'enrolled' }));
    for (let i = 0; i < progEnrollRows.length; i += 100) await tx.insert(programEnrollments).values(progEnrollRows.slice(i, i + 100));
    const enrollmentRows = studentIds.slice(0, 120).map((sid) => ({ tenantId, studentId: sid, courseId: courseByClass[studentClassOf[sid]]!, status: 'enrolled', enrolledAt: '2025-09-05T08:00:00.000Z' }));
    for (let i = 0; i < enrollmentRows.length; i += 100) await tx.insert(enrollments).values(enrollmentRows.slice(i, i + 100));
    // course_enrollments references program_enrollments -> insert after capturing program enrollment ids.
    const progEnrolled = await tx.select({ id: programEnrollments.id }).from(programEnrollments).where(eq(programEnrollments.tenantId, tenantId)).limit(120);
    const courseEnrollRows = progEnrolled.map((pe, i) => ({ tenantId, programEnrollmentId: pe.id, courseId: courseByClass[CLASSES[Math.floor(i / 30)]]!, status: 'enrolled' }));
    for (let i = 0; i < courseEnrollRows.length; i += 100) await tx.insert(courseEnrollments).values(courseEnrollRows.slice(i, i + 100));
    // Student groups (per class) used by timetable_slots.
    const studentGroupIds: string[] = [];
    for (const className of CLASSES) {
      const [sg] = await tx.insert(studentGroups).values({ tenantId, courseId: courseByClass[className]!, academicYearId: ay25!.id, name: `Groupe ${className}`, maxCapacity: '30' }).returning();
      studentGroupIds.push(sg!.id);
    }
    // Question bank items (legacy question_bank_items table, used by the live online-exam flow).
    const qbItems = Array.from({ length: 24 }, (_, i) => ({
      tenantId,
      subjectId: subjectIds[SUBJECTS[i % SUBJECTS.length].name],
      cycle: 'lycee',
      difficulty: pick(['facile', 'moyen', 'moyen', 'difficile']),
      sectionLabel: 'QCM',
      questionText: `Question ${i + 1} : <énoncé>`,
      marks: int(1, 5),
      createdById: teacherIds[i % 20],
    }));
    for (let i = 0; i < qbItems.length; i += 50) await tx.insert(questionBankItems).values(qbItems.slice(i, i + 50));
    // Quizzes per course chapter.
    const quizRows = chapterIds.slice(0, 12).map((ch, i) => ({ tenantId, chapterId: ch, title: `Quiz chapitre ${i + 1}`, description: 'Auto-évaluation', timeLimitMinutes: 15, passingScore: 60, maxAttempts: 3 }));
    const quizIds: string[] = [];
    for (const qz of quizRows) {
      const [r] = await tx.insert(quizzes).values(qz).returning();
      quizIds.push(r!.id);
    }
    const quizQuestionRows = quizIds.flatMap((qid, qi) => Array.from({ length: 4 }, (_, qi2) => ({
      tenantId,
      quizId: qid,
      text: `Question ${qi2 + 1} du quiz ${qi + 1}`,
      type: 'qcm',
      points: 5,
      options: '["A","B","C","D"]',
      correctAnswer: 'A',
      orderIndex: qi2 + 1,
    })));
    for (let i = 0; i < quizQuestionRows.length; i += 50) await tx.insert(quizQuestions).values(quizQuestionRows.slice(i, i + 50));
    const quizAttemptRows = quizIds.slice(0, 8).flatMap((qid, qi) => {
      const sids = (classStudents[CLASSES[qi % 4]] ?? []).slice(0, 8);
      return sids.map((sid) => ({ tenantId, quizId: qid, studentId: sid, startTime: isoTs(-int(1, 10)), endTime: isoTs(-int(1, 10)), answers: '["A","B"]', score: int(4, 10), isPass: rand() < 0.7, status: 'completed' }));
    });
    for (let i = 0; i < quizAttemptRows.length; i += 50) await tx.insert(quizAttempts).values(quizAttemptRows.slice(i, i + 50));
    // Online exams (linked to class_subject) + questions + attempts.
    const onlineExamRows = plans.slice(0, 4).map((p) => ({ tenantId, classSubjectId: classSubjectIds[`${p.className}:${p.subject}`], title: `Examen en ligne – ${p.subject} (${p.className})`, durationMinutes: 60, totalMarks: '20.00', startsAt: isoTs(10), endsAt: isoTs(11), createdById: teacherIds[0] }));
    const onlineExamIds: string[] = [];
    for (const oe of onlineExamRows) {
      const [r] = await tx.insert(onlineExams).values(oe).returning();
      onlineExamIds.push(r!.id);
    }
    const onlineQRows = onlineExamIds.flatMap((eid, ei) => Array.from({ length: 10 }, (_, qi) => ({ tenantId, onlineExamId: eid, questionText: `Question ${qi + 1} – Examen ${ei + 1}`, marks: 2, orderIndex: qi + 1, sectionLabel: 'Partie 1', difficulty: 'moyen' as const, cycle: 'lycee' as const, subjectId: subjectIds[SUBJECTS[ei % SUBJECTS.length].name] })));
    for (let i = 0; i < onlineQRows.length; i += 50) await tx.insert(onlineExamQuestions).values(onlineQRows.slice(i, i + 50));
    const onlineAttemptRows = onlineExamIds.slice(0, 2).flatMap((eid, ei) => (classStudents[CLASSES[ei % 4]] ?? []).slice(0, 20).map((sid) => ({ tenantId, onlineExamId: eid, studentId: sid, startedAt: isoTs(-1), submittedAt: isoTs(-1), score: int(6, 18), status: 'graded' as const })));
    for (let i = 0; i < onlineAttemptRows.length; i += 50) await tx.insert(onlineExamAttempts).values(onlineAttemptRows.slice(i, i + 50));
    console.log(`  · seeded content/LMS (${courseIds.length} courses, ${quizIds.length} quizzes, ${onlineExamIds.length} online exams)`);

    // -----------------------------------------------------------------------
    // Timetable (emploi du temps) slots + exam seats + meeting slots.
    // -----------------------------------------------------------------------
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const ttSlotRows: Array<{ tenantId: string; studentGroupId: string; dayOfWeek: string; startTime: string; endTime: string; teacherId: string; roomId: string }> = [];
    for (const className of CLASSES) {
      const sgId = studentGroupIds[CLASSES.indexOf(className)];
      const subjects = CLASS_SUBJECT_MAP[className];
      for (const [di, day] of DAYS.slice(0, 5).entries()) {
        const subjName = subjects[(di + CLASSES.indexOf(className)) % subjects.length]!;
        const csId = classSubjectIds[`${className}:${subjName}`];
        if (!csId) continue;
        const [slotTeacher] = await tx.select({ teacherId: subjectTeachers.teacherId }).from(subjectTeachers).where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.classSubjectId, csId))).limit(1);
        const teacherId = slotTeacher?.teacherId ?? teacherIds[(di + CLASSES.indexOf(className)) % 20];
        ttSlotRows.push({ tenantId, studentGroupId: sgId, dayOfWeek: day, startTime: '08:00', endTime: '09:00', teacherId, roomId: roomIds[(di + CLASSES.indexOf(className)) % roomIds.length] });
        ttSlotRows.push({ tenantId, studentGroupId: sgId, dayOfWeek: day, startTime: '10:00', endTime: '11:00', teacherId: teacherIds[(di + CLASSES.indexOf(className) + 3) % 20], roomId: roomIds[(di + CLASSES.indexOf(className) + 1) % roomIds.length] });
      }
    }
    for (let i = 0; i < ttSlotRows.length; i += 100) await tx.insert(timetableSlots).values(ttSlotRows.slice(i, i + 100));
    // class_schedule_slots: per class-section, 6 slots on different subjects/days.
    const csSlotRows: Array<{ tenantId: string; classSectionId: string; classSubjectId: string; teacherId: string; dayOfWeek: string; startTime: string; endTime: string; roomLabel: string | null; offeringId: string | null; versionId: string }> = [];
    for (const className of CLASSES) {
      const sections = classInfo[className].sections;
      const subjects = CLASS_SUBJECT_MAP[className];
      for (const [si, csIdX] of sections.entries()) {
        for (let d = 0; d < 5; d++) {
          const subjName = subjects[(d + si) % subjects.length]!;
          const csKey = `${className}:${subjName}`;
          const csSubjectId = classSubjectIds[csKey];
          if (!csSubjectId) continue;
          const [tch] = await tx.select({ teacherId: subjectTeachers.teacherId }).from(subjectTeachers).where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.classSubjectId, csSubjectId))).limit(1);
          csSlotRows.push({ tenantId, classSectionId: csIdX, classSubjectId: csSubjectId, teacherId: tch?.teacherId ?? teacherIds[(d + si) % 20], dayOfWeek: DAYS[d], startTime: `${8 + d}:00`, endTime: `${8 + d}:55`, roomLabel: `Salle ${(d + si) % 8 + 1}`, offeringId: classInfo[className].offerings[['A', 'B', 'C'][si]!] ?? null, versionId: timetableVersionId });
        }
      }
    }
    for (let i = 0; i < csSlotRows.length; i += 100) await tx.insert(classScheduleSlots).values(csSlotRows.slice(i, i + 100));
    // Exam seats: assign a subset of students to halls across both terms.
    const seatRows = studentIds.slice(0, 90).map((sid, i) => ({
      tenantId: tenantId.toString(),
      examTermId: (i % 2 === 0 ? term1 : term2)!.id,
      examHallId: hallIds[i % 3],
      studentId: sid,
      seatNumber: (i % 30) + 1,
      deskLabel: `D${(i % 30) + 1}`,
      candidateNumber: `CND-${pad4(i + 1)}`,
    }));
    for (let i = 0; i < seatRows.length; i += 50) await tx.insert(examSeats).values(seatRows.slice(i, i + 50));
    // Meeting slots for parent-teacher meetings.
    const meetingRows = teacherIds.slice(0, 6).flatMap((tid, ti) => Array.from({ length: 4 }, (_, si) => ({
      tenantId,
      teacherId: tid,
      startTime: isoTs(int(5, 20) + ti * 0.01 + si * 0.02),
      endTime: isoTs(int(5, 20) + ti * 0.01 + si * 0.02),
      status: 'open' as const,
    })));
    for (let i = 0; i < meetingRows.length; i += 50) await tx.insert(meetingSlots).values(meetingRows.slice(i, i + 50));
    console.log(`  · seeded timetable (${ttSlotRows.length} slots) + ${csSlotRows.length} class schedule slots + exam seats + meetings`);

    // -----------------------------------------------------------------------
    // Finance extras: chart of accounts, fiscal periods, bank accounts,
    // payment methods, invoice items, fee schedules/discounts, fines, refunds,
    // credit notes, expenses, student credits, journal entries.
    // -----------------------------------------------------------------------
    const [coaCash] = await tx.insert(chartOfAccounts).values({ tenantId, code: '512', name: 'Banque', accountType: 'asset', isActive: true }).returning();
    const [coaReceivable] = await tx.insert(chartOfAccounts).values({ tenantId, code: '411', name: 'Clients – frais de scolarité', accountType: 'asset', isActive: true }).returning();
    const [coaRevenue] = await tx.insert(chartOfAccounts).values({ tenantId, code: '701', name: 'Ventes – scolarité', accountType: 'revenue', isActive: true }).returning();
    const [coaSalary] = await tx.insert(chartOfAccounts).values({ tenantId, code: '617', name: 'Salaires', accountType: 'expense', isActive: true }).returning();
    await tx.insert(fiscalPeriods).values([
      { tenantId, name: 'Exercice 2025-2026', startDate: '2025-09-01', endDate: '2026-06-30', status: 'open' },
      { tenantId, name: 'Vacances 2026', startDate: '2026-07-01', endDate: '2026-08-31', status: 'open' },
      { tenantId, name: 'Exercice 2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', status: 'open' },
    ]);
    await tx.insert(bankAccounts).values([
      { tenantId, bankName: 'Attijariwafa Bank', accountNumber: '0013 5000 2026 0000 1234', currency: 'MAD', currentBalance: 1250000 },
      { tenantId, bankName: 'Banque Populaire', accountNumber: '0019 6600 2026 0000 5678', currency: 'MAD', currentBalance: 480000 },
    ]);
    const payMethods: Array<{ tenantId: string; methodCode: string; labelFr: string; labelAr: string | null; requiresReference: boolean; requiresBank: boolean; requiresDate: boolean; requiresProof: boolean; refundable: boolean; isActive: boolean; branchScopeId: string | null; accountingAccountId: string | null; effectiveFrom: string }> = [];
    for (const [code, fr, ar, ref, bank, reqDate, proof] of [
      ['cash', 'Espèces', 'نقدا', false, false, false, false],
      ['card', 'Carte bancaire', 'بطاقة بنكية', false, false, true, true],
      ['transfer', 'Virement', 'تحويل بنكي', true, true, true, true],
      ['check', 'Chèque', 'شيك', true, true, true, true],
    ] as const) {
      payMethods.push({ tenantId, methodCode: code, labelFr: fr, labelAr: ar, requiresReference: ref, requiresBank: bank, requiresDate: reqDate, requiresProof: proof, refundable: true, isActive: true, branchScopeId: null, accountingAccountId: coaCash!.id, effectiveFrom: '2025-09-01' });
    }
    await tx.insert(paymentMethodConfigurations).values(payMethods);
    // Invoice items: rebuild each invoice's line items from its fee structure components.
    const invItemRows: Array<{ tenantId: string; invoiceId: string; feeCategoryId: string | null; description: string; amount: number }> = [];
    const feeCompByStruct: Record<string, Array<{ feeCategoryId: string; name: string; amount: number }>> = {};
    for (const c of (await tx.select().from(feeComponents).where(eq(feeComponents.tenantId, tenantId)))) {
      (feeCompByStruct[c.feeStructureId] ??= []).push({ feeCategoryId: c.feeCategoryId, name: c.name, amount: Number(c.amount) });
    }
    for (const inv of insertedInvoices) {
      const stu = inv.studentId;
      const feeStructId = studentClassOf[stu] === '3ème' ? feeStructuresById.College : feeStructuresById.Lycee;
      const comps = feeCompByStruct[feeStructId] ?? [];
      for (const comp of comps) {
        invItemRows.push({ tenantId, invoiceId: inv.id, feeCategoryId: comp.feeCategoryId, description: comp.name, amount: comp.amount });
      }
    }
    for (let i = 0; i < invItemRows.length; i += 100) await tx.insert(invoiceItems).values(invItemRows.slice(i, i + 100));
    // Fee schedules (per structure) + discounts.
    await tx.insert(feeSchedules).values([
      { tenantId, name: 'Échéancier Lycée 2025-2026', academicTermId: ayTerm1!.id, feeStructureId: feeStructuresById.Lycee, postingDate: '2025-09-01T08:00:00.000Z', dueDate: '2025-09-30', status: 'active' },
      { tenantId, name: 'Échéancier Collège 2025-2026', academicTermId: ayTerm1!.id, feeStructureId: feeStructuresById.College, postingDate: '2025-09-01T08:00:00.000Z', dueDate: '2025-09-30', status: 'active' },
    ]);
    const discRows = studentIds.slice(0, 14).map((sid, i) => {
      const dType = pick(['fixed', 'percentage']);
      return {
        tenantId,
        studentId: sid,
        feeStructureId: studentClassOf[sid] === '3ème' ? feeStructuresById.College : feeStructuresById.Lycee,
        discountName: pick(['Famille', 'Excellence', 'Bourse sociale']),
        discountType: dType,
        amount: dType === 'percentage' ? '10.00' : '1000.00',
        approvalStatus: 'approved',
        approvedById: 'USR-001',
        note: 'Remise accordée pour l’année 2025-2026',
      };
    });
    for (let i = 0; i < discRows.length; i += 50) await tx.insert(feeDiscounts).values(discRows.slice(i, i + 50));
    // Fine policies + assessments.
    const [fineLate] = await tx.insert(finePolicies).values({ tenantId, name: 'Retard de paiement', description: 'Pénalité de retard sur factures', graceDays: 15, formula: 'per_day', flatAmount: 0, perDayAmount: 20, maxAmount: 500, effectiveFrom: '2025-09-01', status: 'active' }).returning();
    const [fineBroch] = await tx.insert(finePolicies).values({ tenantId, name: 'Documents perdus', description: 'Frais de réédition', graceDays: 0, formula: 'flat', flatAmount: 150, perDayAmount: 0, effectiveFrom: '2025-09-01', status: 'active' }).returning();
    const fineRows = insertedInvoices.slice(160, 185).map((inv, i) => ({
      tenantId,
      studentId: inv.studentId,
      finePolicyId: fineLate!.id,
      invoiceId: inv.id,
      amount: int(40, 200),
      reason: 'Retard de paiement de la scolarité',
      status: 'open',
      waivedAmount: 0,
      assessedAt: isoDays(-int(3, 20)),
    }));
    await tx.insert(fineAssessments).values(fineRows);
    // Refunds + credit notes.
    const refundRows = insertedInvoices.slice(120, 128).map((inv, i) => ({ tenantId, studentId: inv.studentId, paymentId: paymentIdByStudent.get(inv.studentId)!, refundNumber: `RFD-${pad4(i + 1)}`, amount: Number(inv.paidAmount) * 0.25, refundMethod: 'transfer', reason: 'Surplus versé', approvedById: 'USR-001', status: 'approved', decidedById: 'USR-001', decidedAt: isoDays(-5) }));
    await tx.insert(refunds).values(refundRows);
    const cnRows = insertedInvoices.slice(110, 116).map((inv, i) => ({ tenantId, studentId: inv.studentId, invoiceId: inv.id, creditNoteNumber: `CN-${pad4(i + 1)}`, amount: 500, reason: 'Avoir sur frais de transport', issuedById: 'USR-ACC-001', status: 'approved', approvedById: 'USR-ACC-001', approvedAt: isoDays(-4) }));
    await tx.insert(creditNotes).values(cnRows);
    const expenseRows: Array<{ tenantId: string; category: string; amount: string; expenseDate: string; description: string; receiptUrl: string | null; recordedById: string | null }> = [];
    for (let i = 0; i < 12; i++) {
      expenseRows.push({ tenantId, category: pick(['salary', 'rent', 'utilities', 'supplies', 'marketing', 'other']), amount: String(int(2000, 80000)), expenseDate: isoDays(-int(5, 60)), description: `Dépense ${i + 1} ${pick(['fournitures', 'électricité', 'maintenance', 'communication'])}`, receiptUrl: null, recordedById: 'USR-ACC-001' });
    }
    await tx.insert(expenses).values(expenseRows);
    const creditRows = insertedInvoices.slice(90, 100).map((inv, i) => ({ tenantId, studentId: inv.studentId, amount: int(100, 600), balance: int(50, 600), source: 'credit_note', note: 'Crédit reporté', createdById: 'USR-ACC-001' }));
    await tx.insert(studentCredits).values(creditRows);
    // Journal entries (posted) with balanced lines.
    const [je] = await tx.insert(journalEntries).values({ tenantId, entryNumber: 'JE-2026-0001', entryDate: isoDays(-20), description: 'Encaissement frais de scolarité', sourceModule: 'finance', sourceId: null, postedById: 'USR-ACC-001', status: 'posted' }).returning();
    await tx.insert(journalEntryLines).values([
      { tenantId, journalEntryId: je!.id, accountId: coaCash!.id, debitAmount: '120000.00', creditAmount: '0.00', memo: 'Encaissements banque' },
      { tenantId, journalEntryId: je!.id, accountId: coaReceivable!.id, debitAmount: '0.00', creditAmount: '120000.00', memo: 'Solder créances' },
    ]);
    const [je2] = await tx.insert(journalEntries).values({ tenantId, entryNumber: 'JE-2026-0002', entryDate: isoDays(-5), description: 'Paie du personnel', sourceModule: 'payroll', sourceId: null, postedById: 'USR-ACC-001', status: 'posted' }).returning();
    await tx.insert(journalEntryLines).values([
      { tenantId, journalEntryId: je2!.id, accountId: coaSalary!.id, debitAmount: '96000.00', creditAmount: '0.00', memo: 'Masse salariale' },
      { tenantId, journalEntryId: je2!.id, accountId: coaCash!.id, debitAmount: '0.00', creditAmount: '96000.00', memo: 'Virement salaires' },
    ]);
    console.log(`  · seeded finance extras (accounts, invoice items, fines, journal)`);

    // -----------------------------------------------------------------------
    // Inventory: categories, units, stores, suppliers, products, purchases,
    // sales, issues, adjustments, transfers, stock balances + movements.
    // -----------------------------------------------------------------------
    const invCatRows = ['Fournitures', 'Matériel pédagogique', 'Équipement informatique', 'Mobilier', 'Uniformes'].map((name) => ({ tenantId, name, description: `Catégorie ${name}`, status: 'active' as const }));
    const invCatIds: string[] = [];
    for (const c of invCatRows) {
      const [r] = await tx.insert(inventoryCategories).values(c).returning();
      invCatIds.push(r!.id);
    }
    const invUnitRows = [['Unité', 'U'], ['Pièce', 'PC'], ['Lot', 'LOT'], ['Kg', 'KG']].map(([name, abbreviation]) => ({ tenantId, name, abbreviation, status: 'active' as const }));
    const invUnitIds: string[] = [];
    for (const u of invUnitRows) {
      const [r] = await tx.insert(inventoryUnits).values(u).returning();
      invUnitIds.push(r!.id);
    }
    const [invStore1] = await tx.insert(inventoryStores).values({ tenantId, name: 'Magasin principal', code: 'STORE-1', branchId, mobile: '+212 5 22 00 00 00', address: '12, Avenue Mohammed V', description: 'Stock central', status: 'active' }).returning();
    const [invStore2] = await tx.insert(inventoryStores).values({ tenantId, name: 'Réserve bâtiment B', code: 'STORE-2', branchId, address: '14, Avenue Mohammed V', description: 'Stock secondaire', status: 'active' }).returning();
    const supRows = ['PaperPlus', 'Office Dépôt Maroc', 'Techno Supply', 'Mobilier & Co'].map((name, i) => ({ tenantId, name, companyName: name, address: `Zone industrielle, Casablanca`, contactName: `Contact ${i + 1}`, phone: `+212 5 22 ${int(10, 99)}-${int(1000, 9999)}`, email: `contact${i + 1}@${name.toLowerCase().replace(/\W/g, '')}.ma`, status: 'active' as const }));
    const supIds: string[] = [];
    for (const s of supRows) {
      const [r] = await tx.insert(inventorySuppliers).values(s).returning();
      supIds.push(r!.id);
    }
    const PROD_NAMES = ['Cahier 96 pages', 'Stylo bleu', 'Calculatrice scientifique', 'Clé USB 32Go', 'Ramette A4', 'Tableau blanc', 'Marqueur permanent', 'Chaise scolaire', 'Table élève', 'Cartable', 'Manuel scolaire', 'Trousse', 'Ardoise', 'Compas', 'Bouteille d’eau', 'Crayon graphite'];
    const productRows: Array<{ tenantId: string; name: string; code: string; categoryId: string | null; purchaseUnitId: string | null; saleUnitId: string | null; unitRatio: string; purchasePrice: string | null; salePrice: string | null; remarks: string | null; isActive: boolean }> = PROD_NAMES.map((name, i) => ({ tenantId, name, code: `PRD-${pad4(i + 1)}`, categoryId: invCatIds[i % invCatIds.length], purchaseUnitId: invUnitIds[i % 4], saleUnitId: invUnitIds[i % 4], unitRatio: '1.00', purchasePrice: String(int(5, 400)), salePrice: String(int(10, 600)), remarks: null, isActive: true }));
    const productIds: string[] = [];
    for (let i = 0; i < productRows.length; i += 50) {
      const rows = await tx.insert(inventoryProducts).values(productRows.slice(i, i + 50)).returning({ id: inventoryProducts.id });
      productIds.push(...rows.map((r) => r.id));
    }
    // Purchases + lines.
    const purchIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const [p] = await tx.insert(inventoryPurchases).values({ tenantId, purchaseNumber: `PUR-2026-${pad4(i + 1)}`, supplierId: supIds[i % supIds.length], storeId: invStore1!.id, status: 'received', orderDate: isoDays(-int(20, 60)), receivedAt: isoTs(-int(15, 55)), netAmount: int(800, 5000), paidAmount: int(500, 5000), paymentMethod: pick(['cash', 'transfer', 'check'] as const), paymentReference: `PAY-PUR-${i + 1}`, recordedById: 'USR-ACC-001', notes: 'Achat fournitures' }).returning();
      purchIds.push(p!.id);
    }
    const purchLineRows: Array<{ tenantId: string; purchaseId: string; productId: string; qtyInPurchaseUnit: string; unitCost: string; lineTotal: string }> = [];
    for (let i = 0; i < purchIds.length; i++) {
      for (const prodId of productIds.slice(i, i + 3)) {
        const qty = int(5, 50);
        const cost = int(5, 200);
        purchLineRows.push({ tenantId, purchaseId: purchIds[i]!, productId: prodId, qtyInPurchaseUnit: String(qty), unitCost: String(cost), lineTotal: String(qty * cost) });
      }
    }
    for (let i = 0; i < purchLineRows.length; i += 50) await tx.insert(inventoryPurchaseLines).values(purchLineRows.slice(i, i + 50));
    // Sales + lines.
    const saleIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [s] = await tx.insert(inventorySales).values({ tenantId, saleNumber: `SAL-2026-${pad4(i + 1)}`, storeId: invStore1!.id, saleToRole: 'student', studentId: studentIds[i * 10], customerName: null, saleDate: isoDays(-int(2, 30)), netAmount: int(50, 400), paidAmount: int(50, 400), paymentMethod: pick(['cash', 'card'] as const), status: 'completed', recordedById: 'USR-ACC-001' }).returning();
      saleIds.push(s!.id);
    }
    const saleLineRows: Array<{ tenantId: string; saleId: string; productId: string; qty: string; unitPrice: string; lineTotal: string }> = [];
    for (let i = 0; i < saleIds.length; i++) {
      const prodId = productIds[i % productIds.length];
      const qty = int(1, 4);
      const price = int(10, 200);
      saleLineRows.push({ tenantId, saleId: saleIds[i]!, productId: prodId, qty: String(qty), unitPrice: String(price), lineTotal: String(qty * price) });
    }
    await tx.insert(inventorySaleLines).values(saleLineRows);
    // Issues + lines (e.g. equipment loaned to students).
    const issueIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const [iss] = await tx.insert(inventoryIssues).values({ tenantId, issueNumber: `ISS-2026-${pad4(i + 1)}`, storeId: invStore1!.id, issueToRole: 'student', studentId: studentIds[i * 15], issueToName: null, issueDate: isoDays(-int(10, 45)), dueDate: isoDays(int(5, 30)), returnDate: i % 2 === 0 ? isoDays(-2) : null, status: pick(['issued', 'returned'] as const), recordedById: 'USR-001' }).returning();
      issueIds.push(iss!.id);
    }
    const issueLineRows = issueIds.map((iid, i) => ({ tenantId, issueId: iid, productId: productIds[i % productIds.length], qty: String(int(1, 3)) }));
    await tx.insert(inventoryIssueLines).values(issueLineRows);
    // Adjustments + lines.
    const adjIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [a] = await tx.insert(inventoryAdjustments).values({ tenantId, adjustmentNumber: `ADJ-2026-${pad4(i + 1)}`, storeId: invStore1!.id, type: pick(['count_correction', 'damage', 'write_off'] as const), reason: 'Inventaire périodique', note: 'Écart constaté', status: 'completed', createdById: 'USR-001' }).returning();
      adjIds.push(a!.id);
    }
    const adjLineRows = adjIds.map((aid, i) => ({ tenantId, adjustmentId: aid, productId: productIds[(i + 2) % productIds.length], direction: pick(['in', 'out']), qty: String(int(1, 10)) }));
    await tx.insert(inventoryAdjustmentLines).values(adjLineRows);
    // Transfers + lines.
    const [trf] = await tx.insert(inventoryTransfers).values({ tenantId, transferNumber: 'TRF-2026-0001', fromStoreId: invStore1!.id, toStoreId: invStore2!.id, reason: 'Réapprovisionnement', status: 'completed', createdById: 'USR-001', completedAt: isoTs(-3), completedById: 'USR-001' }).returning();
    await tx.insert(inventoryTransferLines).values([{ tenantId, transferId: trf!.id, productId: productIds[0]!, qty: '10' }, { tenantId, transferId: trf!.id, productId: productIds[1]!, qty: '20' }]);
    // Stock balances + movements (snapshot for the store).
    const balRows = productIds.map((pid, i) => ({ tenantId, storeId: invStore1!.id, productId: pid, quantity: int(0, 120), updatedAt: isoTs(-1) }));
    for (let i = 0; i < balRows.length; i += 50) await tx.insert(inventoryStockBalances).values(balRows.slice(i, i + 50));
    const movRows = productIds.slice(0, 10).map((pid, i) => ({ tenantId, storeId: invStore1!.id, productId: pid, movementType: 'receipt' as const, qty: String(int(10, 80)), refType: 'inventory_purchases', refId: purchIds[0]!, idempotencyKey: `MOV-${i + 1}`, actorId: 'USR-ACC-001', reason: 'Réception de stock', recordedAt: isoTs(-15), createdAt: isoTs(-15) }));
    await tx.insert(inventoryStockMovements).values(movRows);
    console.log(`  · seeded inventory (${productIds.length} products, purchases, sales, stock)`);

    // -----------------------------------------------------------------------
    // Add-on extras: hostel (zones, applications, leave passes, roll calls,
    // policies), transport (policies, crew, incidents, rider events, fares,
    // vehicle docs, roster snapshots), library (catalog enrichments, holds,
    // loan events, transfers, charges, notifications, closures).
    // -----------------------------------------------------------------------
    const hostelAllocs = await tx.select({ id: hostelAllocations.id, studentId: hostelAllocations.studentId }).from(hostelAllocations).where(eq(hostelAllocations.tenantId, tenantId));
    // Zones + policies.
    await tx.insert(hostelPolicies).values({ tenantId, policies: { checkIn: '16:00', checkOut: '10:00', visitors: 'weekend only', quietHours: '22:00 - 06:00' }, version: 1, updatedById: 'USR-001', updatedAt: isoTs(-30) });
    const zoneIds: string[] = [];
    for (const hId of hostelIds) {
      const [z] = await tx.insert(hostelZones).values({ tenantId, hostelId: hId, zoneType: 'etage', code: 'Z1', name: 'Étage 1', curfewTime: '21:00:00', rollCallTime: '20:00:00', visitorHours: { weekdays: '17:00-19:00' }, emergencyAssemblyPoint: 'Cours', status: 'active' }).returning();
      zoneIds.push(z!.id);
    }
    // Applications (a few for next session).
    const appRows = studentIds.slice(40, 60).map((sid, i) => ({ tenantId, studentId: sid, sessionYearId, requestedStartDate: '2026-09-01', requestedEndDate: '2027-06-30', preferredCategoryIds: null, preferredRoomId: null, priorityReason: null, guardianConsentStatus: 'approved', decision: i % 2 === 0 ? 'accepted' : 'waitlisted', decisionReason: 'Selon disponibilité', decidedById: 'USR-001', decidedAt: i % 2 === 0 ? isoDays(-10) : null }));
    for (let i = 0; i < appRows.length; i += 50) await tx.insert(hostelApplications).values(appRows.slice(i, i + 50));
    // Leave passes + approvals + returns.
    const leavePassRows = hostelAllocs.slice(0, 6).map((a, i) => ({ tenantId, allocationId: a.id, studentId: a.studentId, destination: 'Casablanca centre', reason: 'Sortie familiale', startDateTime: isoDays(-3), expectedReturnAt: isoDays(-2), actualReturnAt: isoDays(-2), guardianApprovalRequired: true, status: i % 2 === 0 ? 'approved' : 'pending', createdById: a.studentId }));
    const leavePassIds: string[] = [];
    for (const lp of leavePassRows) {
      const [r] = await tx.insert(hostelLeavePasses).values(lp).returning();
      leavePassIds.push(r!.id);
    }
    const leaveApprRows = leavePassIds.slice(0, 4).map((lpid, i) => ({ tenantId, leavePassId: lpid, approverId: 'USR-001', approverRole: 'administrator', decision: 'approved', reason: 'Autorisé', createdAt: isoDays(-2) }));
    await tx.insert(hostelLeavePassApprovals).values(leaveApprRows);
    const leaveRetRows = leavePassIds.slice(0, 3).map((lpid, i) => ({ tenantId, leavePassId: lpid, allocationId: hostelAllocs[i]!.id, returnedAt: isoDays(-2), recordedBy: 'USR-001', note: 'Retour confirmé', created_at: isoTs(-2) }));
    // drop created_at variant: use returnedAt only
    await tx.insert(hostelLeavePassReturns).values(leaveRetRows.map((x) => ({ tenantId: x.tenantId, leavePassId: x.leavePassId, allocationId: x.allocationId, returnedAt: x.returnedAt, recordedById: x.recordedBy, note: x.note })));
    // Roll calls + entries.
    const rollCallRows = hostelIds.flatMap((hId, hi) => [0, 1].map((off) => ({ tenantId, hostelId: hId, callDate: isoDays(-off), status: 'closed', openedById: 'USR-001', closedById: 'USR-001', closedAt: isoTs(-off) })));
    const rollCallIds: string[] = [];
    for (const rc of rollCallRows) {
      const [r] = await tx.insert(hostelRollCalls).values(rc).returning();
      rollCallIds.push(r!.id);
    }
    const rollEntryRows = rollCallIds.flatMap((rcid, rci) => hostelAllocs.slice(0, 8).map((a, i) => ({ tenantId, rollCallId: rcid, allocationId: a.id, status: pick(['present', 'present', 'present', 'missing']) as 'present' | 'missing' | 'approved_leave' | 'late' | 'sick' | 'excused', notedById: 'USR-001', note: null as string | null, notedAt: isoTs(-rci), lastUpdatedAt: isoTs(-rci) })));
    for (let i = 0; i < rollEntryRows.length; i += 50) await tx.insert(hostelRollCallEntries).values(rollEntryRows.slice(i, i + 50));
    console.log(`  · seeded hostel extras (zones, ${appRows.length} applications, leave passes, roll calls)`);

    // Transport extras.
    await tx.insert(transportPolicies).values({ tenantId: tenantId.toString(), maxCapacityMarginPercent: 10, requireSafeHandoffYoungerStudents: true, handoffAgeThresholdYears: 8 });
    const allocRows = await tx.select().from(transportStudentAllocations).where(eq(transportStudentAllocations.tenantId, tenantId));
    const tripRows = await tx.select().from(transportTrips).where(eq(transportTrips.tenantId, tenantId));
    const fareRows = allocRows.slice(0, 20).map((a, i) => ({ tenantId: tenantId.toString(), allocationId: a.id, feeStructureId: null, invoiceId: null, chargeAmount: 2500, currency: 'MAD', status: 'billed' as const }));
    await tx.insert(transportFareLinks).values(fareRows);
    const vehDocRows = vehicleIds.flatMap((vid, vi) => [
      { tenantId: tenantId.toString(), vehicleId: vid, documentType: 'vignette', title: `Vignette ${vi + 1}`, attachmentId: null, expiryDate: '2026-12-31' },
      { tenantId: tenantId.toString(), vehicleId: vid, documentType: 'insurance', title: `Assurance ${vi + 1}`, attachmentId: null, expiryDate: '2026-09-30' },
    ]);
    await tx.insert(transportVehicleDocuments).values(vehDocRows);
    const crewRows = routeIds.map((rid, ri) => ({ tenantId: tenantId.toString(), routeId: rid, vehicleId: vehicleIds[ri % 2], driverEmployeeId: `EMP-${pad2((ri % 20) + 1)}`, attendantEmployeeId: ri % 2 === 0 ? `EMP-${pad2(((ri + 6) % 20) + 1)}` : null, effectiveStartDate: '2025-09-01', effectiveEndDate: '2026-06-30', recurringDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] }));
    await tx.insert(transportCrewAssignments).values(crewRows);
    const rosterRows = allocRows.slice(0, 12).flatMap((a, i) => ({ tenantId: tenantId.toString(), tripId: tripRows[i % tripRows.length]!.id, studentId: a.studentId, pickupStopId: a.pickupStopId!, dropoffStopId: a.dropoffStopId!, direction: a.direction, allocatedStatus: 'allocated' }));
    await tx.insert(transportTripRosterSnapshots).values(rosterRows);
    const riderEventRows = allocRows.slice(0, 16).flatMap((a, i) => [
      { tenantId: tenantId.toString(), tripId: tripRows[i % tripRows.length]!.id, studentId: a.studentId, stopId: a.pickupStopId!, eventType: 'boarded' as const, verificationMethod: 'manual' as const, eventTimestamp: isoTs(-1), actorUserId: 'USR-001', deviceId: null, exceptionReason: null, idempotencyKey: `RIDE-B-${i + 1}` },
    ]);
    await tx.insert(transportRiderEvents).values(riderEventRows);
    const incIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [inc] = await tx.insert(transportIncidents).values({ tenantId: tenantId.toString(), tripId: tripRows[i % tripRows.length]?.id ?? null, vehicleId: vehicleIds[i % 2], driverId: null, incidentType: pick(['vehicle_breakdown', 'late_route', 'missed_pickup', 'other'] as const), severity: pick(['low', 'medium'] as const), status: 'resolved', reportedByUserId: 'USR-001', assignedResponderUserId: 'USR-001', title: `Incident transport ${i + 1}`, description: 'Retard signalé sur la ligne.', resolutionSummary: 'Résolu.', safeguardingRedactedNotes: null }).returning();
      incIds.push(inc!.id);
    }
    await tx.insert(transportIncidentActions).values(incIds.map((iid, i) => ({ tenantId: tenantId.toString(), incidentId: iid, actorUserId: 'USR-001', actionTaken: 'Plan d’action appliqué' })));
    console.log(`  · seeded transport extras (${fareRows.length} fares, crew, incidents, rider events)`);

    // Library extras.
    const libCatIds: string[] = [];
    for (const name of ['Littérature', 'Sciences', 'Histoire', 'Langues', 'Mathématiques']) {
      const [c] = await tx.insert(libraryCategories).values({ tenantId, parentId: null, name, sortOrder: 0 }).returning();
      libCatIds.push(c!.id);
    }
    const pubIds: string[] = [];
    for (const name of ['Larousse', 'Nathan', 'Hachette', 'Librairie des Écoles']) {
      const [p] = await tx.insert(libraryPublishers).values({ tenantId, name, city: 'Paris', country: 'France' }).returning();
      pubIds.push(p!.id);
    }
    const subjIdsLib: string[] = [];
    for (const name of ['Mathématiques', 'Physique', 'Littérature', 'Histoire', 'Anglais']) {
      const [s] = await tx.insert(librarySubjects).values({ tenantId, name }).returning();
      subjIdsLib.push(s!.id);
    }
    const contrIds: string[] = [];
    for (const name of ['Antoine de Saint-Exupéry', 'Victor Hugo', 'Voltaire', 'Albert Camus', 'Driss Chraïbi']) {
      const [c] = await tx.insert(libraryContributors).values({ tenantId, name, primaryRole: 'author' }).returning();
      contrIds.push(c!.id);
    }
    const recSubjRows = recordIds.slice(0, 12).map((rid, i) => ({ tenantId, recordId: rid, subjectId: subjIdsLib[i % subjIdsLib.length] }));
    const recContrRows = recordIds.slice(0, 10).map((rid, i) => ({ tenantId, recordId: rid, contributorId: contrIds[i % contrIds.length], role: 'author', sortOrder: 1 }));
    await tx.insert(libraryRecordSubjects).values(recSubjRows);
    await tx.insert(libraryRecordContributors).values(recContrRows);
    const loanPolicies = [
      { tenantId, name: 'Élèves', patronCategory: 'student', branchId, maxLoans: 3, loanDurationDays: 14, renewalLimit: 2, renewalDurationDays: 7, finePerDay: 2, gracePeriodDays: 2, maxHolds: 2 },
      { tenantId, name: 'Professeurs', patronCategory: 'staff', branchId, maxLoans: 5, loanDurationDays: 21, renewalLimit: 3, renewalDurationDays: 14, finePerDay: 0, gracePeriodDays: 5, maxHolds: 3 },
    ];
    await tx.insert(libraryLoanPolicies).values(loanPolicies);
    const holdIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const [h] = await tx.insert(libraryHolds).values({ tenantId, copyId: copyIds[i % copyIds.length], memberId: memberIds[i % memberIds.length], placedById: studentIds[i % studentIds.length], placedAt: isoDays(-6), state: i % 2 === 0 ? 'waiting' : 'fulfilled', expiresAt: isoDays(8), fulfilledLoanId: null, cancelledAt: null, cancelReason: null }).returning();
      holdIds.push(h!.id);
    }
    await tx.insert(libraryHoldEvents).values(holdIds.map((hid, i) => ({ tenantId, holdId: hid, eventType: 'placed', actorId: studentIds[i % studentIds.length], at: isoDays(-6), note: null })));
    const loans = await tx.select({ id: libraryLoans.id }).from(libraryLoans).where(eq(libraryLoans.tenantId, tenantId));
    await tx.insert(libraryLoanEvents).values(loans.map((l, i) => ({ tenantId, loanId: l.id, eventType: i % 3 === 0 ? 'returned' : 'issued', actorId: 'USR-001', at: isoDays(-int(1, 20)), note: null })));
    const [branch2] = await tx.insert(branches).values({ tenantId, name: 'Annexe Maarif', code: 'BR-2', city: 'Casablanca', phone: '+212 5 22 44 55 66', isActive: true, address: '45, Rue Abdelmoumen' }).returning();
    const [transfer] = await tx.insert(libraryTransfers).values({ tenantId, copyId: copyIds[0]!, fromBranchId: branchId, toBranchId: branch2!.id, state: 'received', requestedById: 'USR-001', dispatchedAt: isoDays(-5), dispatchedById: 'USR-001', receivedAt: isoDays(-3), receivedById: 'USR-001', note: 'Transfert de réserve' }).returning();
    await tx.insert(libraryTransferEvents).values({ tenantId, transferId: transfer!.id, eventType: 'dispatched', actorId: 'USR-001', at: isoDays(-5), note: 'Départ du magasin' });
    const chargeIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const [ch] = await tx.insert(libraryCharges).values({ tenantId, memberId: memberIds[i % memberIds.length], loanId: loans[i % loans.length]?.id ?? null, amount: int(5, 40), reason: 'Retard de retour', state: 'open', waivedById: null, waivedAt: null, waiverReason: null, dedupeKey: null, createdAt: isoTs(-2), updatedAt: isoTs(-2) }).returning();
      chargeIds.push(ch!.id);
    }
    await tx.insert(libraryChargeAdjustments).values({ tenantId, chargeId: chargeIds[0]!, adjustmentType: 'reduce', amount: 5, actorId: 'USR-001', reason: 'Retour partiel', at: isoTs(-1) });
    await tx.insert(libraryNotifications).values(memberIds.slice(0, 4).map((mid, i) => ({ tenantId, memberId: mid, type: 'due_soon', channel: 'email', state: 'sent', payload: null, created_at: isoTs(-3), deliveredAt: isoTs(-3) })).map((x) => ({ tenantId: x.tenantId, memberId: x.memberId, type: x.type, channel: x.channel, state: x.state, payload: x.payload, createdAt: x.created_at, deliveredAt: x.deliveredAt })));
    await tx.insert(libraryClosureDays).values([
      { tenantId, branchId, closedOn: isoDays(25), reason: 'Jour férié' },
      { tenantId, branchId, closedOn: isoDays(50), reason: 'Fermeture administrative' },
    ]);
    console.log(`  · seeded library extras (${holdIds.length} holds, transfers, charges, closures)`);

    // -----------------------------------------------------------------------
    // HR / payroll extras: employee documents & events, payroll profiles,
    // salary assignments, advances + schedules, payroll run + payslips,
    // awards, leave policies + balance transactions.
    // -----------------------------------------------------------------------
    const empProfiles = await tx.select({ id: employeeProfiles.id, userId: employeeProfiles.userId, salary: employeeProfiles.salary }).from(employeeProfiles).where(eq(employeeProfiles.tenantId, tenantId));
    const empDocs = empProfiles.flatMap((e, i) => [
      { tenantId, employeeId: e.id, documentType: 'diplome', storageKey: `docs/emp-${i + 1}-diplome.pdf`, originalName: `Diplôme ${i + 1}.pdf`, mimeType: 'application/pdf', fileSize: int(80000, 400000), issuedAt: `${int(2008, 2020)}-01-01`, expiryDate: null, visibility: 'private', uploadedById: 'USR-001', archivedAt: null },
      { tenantId, employeeId: e.id, documentType: 'cnss', storageKey: `docs/emp-${i + 1}-cnss.pdf`, originalName: `CNSS ${i + 1}.pdf`, mimeType: 'application/pdf', fileSize: int(30000, 120000), issuedAt: `${int(2014, 2024)}-01-01`, expiryDate: null, visibility: 'private', uploadedById: 'USR-001', archivedAt: null },
    ]);
    for (let i = 0; i < empDocs.length; i += 50) await tx.insert(employeeDocuments).values(empDocs.slice(i, i + 50));
    const empEvents = empProfiles.flatMap((e) => [
      { tenantId, employeeId: e.id, eventType: 'hired', actorId: 'USR-001', reason: 'Embauche', metadata: { source: 'seed' }, effectiveAt: '2025-09-01T00:00:00.000Z' },
      { tenantId, employeeId: e.id, eventType: 'promotion', actorId: 'USR-001', reason: null, metadata: null, effectiveAt: '2026-01-05T00:00:00.000Z' },
    ]);
    for (let i = 0; i < empEvents.length; i += 50) await tx.insert(employeeEmploymentEvents).values(empEvents.slice(i, i + 50));
    const invRows = empProfiles.slice(0, 4).map((e) => ({ tenantId, employeeId: e.id, tokenHash: `tok-${Math.random().toString(36).slice(2, 12)}`, expiresAt: isoTs(30), invitedEmail: `${e.userId.toLowerCase()}@atlas.ma`, status: 'pending', consumedAt: null, createdBy: 'USR-001' }));
    // created_by_id -> map to createdById
    await tx.insert(employeeInvitations).values(invRows.map((x) => ({ tenantId: x.tenantId, employeeId: x.employeeId, tokenHash: x.tokenHash, expiresAt: x.expiresAt, invitedEmail: x.invitedEmail, status: x.status, consumedAt: x.consumedAt, createdById: x.createdBy })));
    const payrollProfileRows = empProfiles.map((e, i) => ({ tenantId, employeeId: e.id, userId: e.userId, cnssNumber: `CNSS-${int(10000000, 99999999)}`, amoNumber: `AMO-${int(1000000, 9999999)}`, taxId: `IF-${int(100000, 999999)}`, bankRibEncrypted: null, bankName: pick(['Attijariwafa Bank', 'Banque Populaire', 'BMCE']), bankAccountName: 'Salarié', dependantsCount: int(0, 4), payFrequency: 'monthly', paymentMethod: 'bank_transfer', salaryCurrency: 'MAD', status: 'active' }));
    for (let i = 0; i < payrollProfileRows.length; i += 50) await tx.insert(employeePayrollProfiles).values(payrollProfileRows.slice(i, i + 50));
    const salaryAssignRows = empProfiles.map((e) => ({ tenantId, userId: e.userId, templateId: tpl!.id, baseSalary: Number(e.salary), effectiveDate: '2025-09-01', createdAt: '2025-09-01T00:00:00.000Z' }));
    for (let i = 0; i < salaryAssignRows.length; i += 50) await tx.insert(employeeSalaryAssignments).values(salaryAssignRows.slice(i, i + 50));
    // Salary advances + policies.
    const [advPolicy] = await tx.insert(salaryAdvancePolicies).values({ tenantId, name: 'Avance sur salaire', maxAmount: 10000, maxOutstanding: 20000, minEmploymentMonths: 6, repaymentStartMonths: 1, maxInstallments: 6, minNetProtection: 3000, status: 'active' }).returning();
    const advanceIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const e = empProfiles[i % empProfiles.length]!;
      const amt = int(2000, 5000);
      const repaidAmt = i % 2 === 0 ? amt : 0;
      const [a] = await tx.insert(salaryAdvances).values({ tenantId, employeeId: e.id, userId: e.userId, requestedAmount: amt, approvedAmount: amt, repaidAmount: repaidAmt, monthlyInstallment: Math.round(amt / 4), reason: 'Avance personnelle', status: i % 2 === 0 ? 'fully_repaid' : 'approved', requestedAt: isoDays(-30), approvedAt: isoDays(-28), approverId: 'USR-001', rejectionReason: null }).returning();
      advanceIds.push(a!.id);
      await tx.insert(salaryAdvanceTransactions).values({ tenantId, advanceId: a!.id, type: 'disbursement', amount: amt, referenceId: `ADV-TX-${i + 1}`, transactionDate: isoDays(-28), notes: 'Versement', createdAt: isoTs(-28) });
      for (let m = 1; m <= 4; m++) {
        await tx.insert(salaryAdvanceRepaymentSchedules).values({ tenantId, advanceId: a!.id, installmentNo: m, duePeriodYear: 2026, duePeriodMonth: 9 + m, amount: Math.round(amt / 4), status: m === 1 && i % 2 === 0 ? 'allocated' : 'pending', payrollRunLineId: null, allocatedAt: null, notes: null });
      }
    }
    console.log(`  · seeded HR extras (${empProfiles.length} employee records, advances)`);
    // Payroll run: one period (June 2026) + run lines + batch + payments + payslips.
    const [ppId] = await tx.insert(payrollPeriods).values({ tenantId, year: 2026, month: 6, status: 'posted', version: 1, createdAt: '2026-06-25T00:00:00.000Z' }).returning();
    const periodId = ppId!.id;
    const runLines: Array<{ tenantId: string; periodId: string; userId: string; grossSalary: string; cnssEmployee: string; amoEmployee: string; irTax: string; netSalary: string; cnssEmployer: string; amoEmployer: string; totalEmployerCost: string; calculationSnapshot: null; calculationVersion: number; prorationFactor: string; netPayable: string | null; paymentMethod: string | null; paidAt: string | null; isFrozen: boolean; isReversed: boolean }> = empProfiles.map((e) => {
      const gross = Number(e.salary);
      const cnssE = +(gross * 0.0484).toFixed(2);
      const amoE = +(gross * 0.0226).toFixed(2);
      const ir = +(gross * 0.12).toFixed(2);
      const net = +(gross - cnssE - amoE - ir).toFixed(2);
      const cnssEr = +(gross * 0.1315).toFixed(2);
      const amoEr = +(gross * 0.0226).toFixed(2);
      return { tenantId, periodId, userId: e.userId, grossSalary: gross.toFixed(2), cnssEmployee: cnssE.toFixed(2), amoEmployee: amoE.toFixed(2), irTax: ir.toFixed(2), netSalary: net.toFixed(2), cnssEmployer: cnssEr.toFixed(2), amoEmployer: amoEr.toFixed(2), totalEmployerCost: (gross + cnssEr + amoEr).toFixed(2), calculationSnapshot: null, calculationVersion: 1, prorationFactor: '1.00', netPayable: net.toFixed(2), paymentMethod: 'bank_transfer', paidAt: '2026-06-30T00:00:00.000Z', isFrozen: true, isReversed: false };
    });
    const runLineIds: string[] = [];
    for (let i = 0; i < runLines.length; i += 50) {
      const ins = await tx.insert(payrollRunLines).values(runLines.slice(i, i + 50)).returning({ id: payrollRunLines.id });
      runLineIds.push(...ins.map((r) => r.id));
    }
    const [batch] = await tx.insert(salaryPaymentBatches).values({ tenantId, runId: periodId, method: 'bank_transfer', status: 'approved', totalAmount: runLines.reduce((s, r) => s + Number(r.netSalary), 0), preparedById: 'USR-ACC-001', approvedById: 'USR-001', approvedAt: '2026-06-28T00:00:00.000Z', reconciliationStatus: 'reconciled', reconciledById: 'USR-ACC-001', reconciledAt: '2026-07-02T00:00:00.000Z' }).returning();
    const payLines = empProfiles.map((e, i) => ({ tenantId, batchId: batch!.id, runLineId: runLineIds[i]!, userId: e.userId, amount: Number(runLines[i]!.netSalary), status: 'paid', bankReference: `VR-2026-${pad4(i + 1)}`, receiptReference: null, maskedBankDetails: '**** 1234', paidById: 'USR-ACC-001', paidAt: '2026-06-30T00:00:00.000Z' }));
    await tx.insert(salaryPayments).values(payLines);
    const payslipRows = empProfiles.map((e, i) => ({ tenantId, periodId, runLineId: runLineIds[i]!, userId: e.userId, issuedAt: '2026-06-30T00:00:00.000Z', pdfStorageKey: null, payslipNumber: `BULL-${periodId.slice(0, 8)}-${pad4(i + 1)}`, status: 'issued' }));
    await tx.insert(payslips).values(payslipRows);
    const adjRows = empProfiles.slice(0, 5).map((e, i) => ({ tenantId, employeeId: e.id, userId: e.userId, periodId, adjustmentType: 'bonus', componentId: null, amount: int(300, 1000), units: null, rate: null, reason: 'Prime de performance', evidenceKey: null, taxTreatment: 'taxable', recurring: false, recurrenceStart: null, recurrenceEnd: null, remainingOccurrences: null, effectivePeriodYear: 2026, effectivePeriodMonth: 6, status: 'approved', requesterId: 'USR-001', approverId: 'USR-001', approvedAt: '2026-06-20T00:00:00.000Z' }));
    await tx.insert(payrollAdjustments).values(adjRows);
    const resultLines = empProfiles.flatMap((e) => [
      { tenantId, runId: periodId, userId: e.userId, lineCode: 'BASE', componentId: compBase!.id, componentVersionId: null, label: 'Salaire de base', lineType: 'earning', amount: String(Number(e.salary)), base: null, rate: null, quantity: null, formulaVersion: 'v1', sortOrder: 1 },
      { tenantId, runId: periodId, userId: e.userId, lineCode: 'CNSS-EMP', componentId: compBase!.id, componentVersionId: null, label: 'CNSS part salariale', lineType: 'deduction', amount: (Number(e.salary) * 0.0484).toFixed(2), base: String(Number(e.salary)), rate: '0.0484', quantity: '1.00', formulaVersion: 'v1', sortOrder: 2 },
    ]);
    for (let i = 0; i < resultLines.length; i += 50) await tx.insert(payrollResultLines).values(resultLines.slice(i, i + 50));
    // Awards + award definitions.
    await tx.insert(awardDefinitions).values([
      { tenantId, name: 'Enseignant de l’année', category: 'performance', description: 'Récompense les meilleurs enseignants', eligibility: 'Enseignants actifs', approvalRequired: true, monetaryDefault: 3000, monetaryComponentId: null, visibility: 'internal', status: 'active' },
      { tenantId, name: 'Ancienneté 10 ans', category: 'longevity', description: 'Fidélité au poste', eligibility: '10 ans d’ancienneté', approvalRequired: false, monetaryDefault: 5000, monetaryComponentId: null, visibility: 'internal', status: 'active' },
    ]);
    const empAwardRows = empProfiles.slice(0, 4).map((e, i) => ({ tenantId, employeeId: e.id, userId: e.userId, title: 'Enseignant de l’année', category: 'performance', monetaryReward: 3000, giftDescription: 'Médaille + certificat', awardDate: '2026-06-20', summary: 'Excellence pédagogique', presentedBy: 'Direction', status: 'approved' }));
    await tx.insert(employeeAwards).values(empAwardRows);
    // Leave policies + assignments + balance transactions.
    const [leavePol] = await tx.insert(employeeLeavePolicies).values({ tenantId, name: 'Politique congés 2026', categoryId: leaveCat1!.id, accrualType: 'annual', annualDays: 30, monthlyAccrualDays: null, carryoverLimit: 5, maxBalance: 35, allowNegative: false, probationRestrictionDays: 90, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active' }).returning();
    const polAssignRows = empProfiles.map((e) => ({ tenantId, employeeId: e.id, policyId: leavePol!.id, effectiveFrom: '2026-01-01', effectiveTo: null, status: 'active' }));
    for (let i = 0; i < polAssignRows.length; i += 50) await tx.insert(employeeLeavePolicyAssignments).values(polAssignRows.slice(i, i + 50));
    const balTxRows = empProfiles.slice(0, 6).map((e, i) => ({ tenantId, employeeId: e.id, userId: e.userId, categoryId: leaveCat1!.id, policyId: leavePol!.id, year: 2026, txType: 'accrual', units: 30, refType: 'opening_balance', refId: null, occurredAt: '2026-01-01T00:00:00.000Z', createdById: 'USR-001', notes: 'Solde d’ouverture', createdAt: '2026-01-01T00:00:00.000Z' }));
    await tx.insert(employeeLeaveBalanceTransactions).values(balTxRows);
    console.log(`  · seeded payroll run (${runLines.length} lines) + ${payslipRows.length} payslips + awards + leave policies`);

    // -----------------------------------------------------------------------
    // Events extras: venues, invitations, registrations, check-ins.
    // -----------------------------------------------------------------------
    const evSchedRows = await tx.select({ id: eventSchedules.id, eventId: eventSchedules.eventId, startTime: eventSchedules.startTime, endTime: eventSchedules.endTime }).from(eventSchedules).where(eq(eventSchedules.tenantId, tenantId));
    const occIds: string[] = [];
    for (const s of evSchedRows) {
      const [oc] = await tx.insert(eventOccurrences).values({ tenantId: tenantId.toString(), eventId: s.eventId, scheduleId: s.id, originalDate: s.startTime.slice(0, 10), startTime: s.startTime, endTime: s.endTime, isCancelled: false, version: 1, createdAt: isoTs(-7), updatedAt: isoTs(-7) }).returning();
      occIds.push(oc!.id);
    }
    const occRows = evSchedRows.map((s, i) => ({ id: occIds[i]!, eventId: s.eventId }));
    const venueRows = occRows.slice(0, 8).map((o, i) => ({ tenantId: tenantId.toString(), eventId: o.eventId, occurrenceId: o.id, venueType: i % 3 === 1 ? 'online' : 'physical', name: i % 3 === 1 ? 'Réunion en ligne' : `Salle polyvalente ${i + 1}`, address: i % 3 === 1 ? null : '12, Avenue Mohammed V, Casablanca', capacity: i % 3 === 1 ? null : 120, onlineLink: i % 3 === 1 ? 'https://meet.atlas.ma/evt' : null, accessibilityNotes: null, createdAt: isoTs(-7), updatedAt: isoTs(-7) }));
    await tx.insert(eventVenues).values(venueRows);
    const evInvRows = occRows.slice(0, 8).flatMap((o, i) => [0, 1, 2, 3, 4, 5].map((k) => ({
      tenantId: tenantId.toString(), eventId: o.eventId, occurrenceId: o.id,
      personId: (i + k) % 2 === 0 ? studentIds[(i * 6 + k) % 200] : teacherIds[(i + k) % 20],
      status: pick(['pending', 'sent', 'opened', 'responded'] as const),
      sentAt: isoTs(-6), respondedAt: k % 3 === 0 ? isoTs(-5) : null,
      createdAt: isoTs(-7), updatedAt: isoTs(-6),
    })));
    await tx.insert(eventInvitations).values(evInvRows);
    const evRegRows = occRows.slice(0, 6).flatMap((o, i) => [0, 1, 2, 3].map((k) => ({
      tenantId: tenantId.toString(), occurrenceId: o.id, personId: studentIds[(i * 4 + k) % 200],
      status: pick(['going', 'maybe', 'declined', 'waitlisted'] as const), seats: 1, answers: null,
      consentGiven: true, idempotencyKey: `reg-${o.id.slice(0, 8)}-${k}`, createdAt: isoTs(-5), updatedAt: isoTs(-5),
    })));
    await tx.insert(eventRegistrations).values(evRegRows);
    const checkinRows = occRows.slice(0, 5).flatMap((o, i) => [0, 1, 2].map((k) => ({
      tenantId: tenantId.toString(), occurrenceId: o.id, registrationId: null, personId: studentIds[(i * 3 + k) % 200],
      method: pick(['qr', 'manual_search', 'self_service'] as const), operatorId: 'USR-001', timestamp: isoTs(1),
    })));
    await tx.insert(eventCheckins).values(checkinRows);
    console.log(`  · seeded event extras (${venueRows.length} venues, ${evInvRows.length} invites, ${evRegRows.length} registrations, ${checkinRows.length} check-ins)`);

    // -----------------------------------------------------------------------
    // Attendance extras: excuses, flags, summaries, QR scanners + punch events.
    // -----------------------------------------------------------------------
    const excuseRows = studentIds.slice(0, 14).map((sid, i) => ({
      tenantId, studentId: sid, date: lastWeekdays(4)[i % 4], reason: pick(['Maladie', 'Rendez-vous médical', 'Raison familiale']),
      documentUrl: null, documentFileExt: null, status: pick(['pending', 'approved', 'rejected'] as const),
      reviewedById: pick(['USR-001', 'USR-ACC-001', null]), reviewedAt: i % 2 === 0 ? isoTs(-3) : null,
      rejectionReason: null, createdAt: isoTs(-8), updatedAt: isoTs(-8),
    }));
    await tx.insert(attendanceExcuses).values(excuseRows);
    const flagRows = studentIds.slice(0, 12).map((sid, i) => ({
      tenantId, studentId: sid,
      type: pick(['UNJUSTIFIED_ABSENCE', 'REPEATED_LATE', 'CONSECUTIVE_ABSENCE'] as const),
      status: i % 3 === 0 ? 'RESOLVED' : 'OPEN',
      severity: pick(['CRITIQUE', 'ELEVE', 'MOYEN'] as const),
      assignedToId: teacherIds[i % 20], detectedAt: isoTs(-10),
      resolvedAt: i % 3 === 0 ? isoTs(-2) : null,
    }));
    const flagIds: string[] = [];
    for (const f of flagRows) { const [r] = await tx.insert(attendanceFlags).values(f).returning(); flagIds.push(r!.id); }
    const flagNoteRows = flagIds.slice(0, 6).map((fid, i) => ({ tenantId, flagId: fid, authorId: teacherIds[i % 20], body: `Relance ${i + 1} auprès de la famille`, createdAt: isoTs(-9) }));
    await tx.insert(attendanceFlagNotes).values(flagNoteRows);
    const summaryRows = studentIds.map((sid, i) => {
      const total = 80; const present = int(70, 78); const late = int(0, 5); const excused = int(0, 3);
      return { tenantId, studentId: sid, academicYearId: ay25!.id, totalPresent: present, totalAbsent: total - present - late - excused, totalLate: late, totalExcused: excused, totalSessions: total, attendanceRate: ((present + late * 0.5 + excused) / total * 100).toFixed(2), lastUpdated: isoTs(0) };
    });
    for (let i = 0; i < summaryRows.length; i += 100) await tx.insert(attendanceSummary).values(summaryRows.slice(i, i + 100));
    const devRows = ['Portique A', 'Portique B', 'Scanner entrée', 'Badgeuse salle profs'].map((label, i) => ({ tenantId, deviceLabel: label, branchId, pairedAt: isoTs(-90), lastSeenAt: isoTs(-1), isDisabled: false, secretKey: `sec-${i + 1}` }));
    const devIds: string[] = [];
    for (const d of devRows) { const [r] = await tx.insert(scannerDevices).values(d).returning(); devIds.push(r!.id); }
    const scanSessionRows = [0, 1, 2].map((i) => ({ tenantId, deviceId: devIds[i % 4], operatorId: teacherIds[i % 20], classSectionId: classInfo['2nde']!.sections[i % 3], startedAt: isoTs(-2), endedAt: isoTs(-1), status: 'closed' }));
    const sessionIds: string[] = [];
    for (const s of scanSessionRows) { const [r] = await tx.insert(scannerSessions).values(s).returning(); sessionIds.push(r!.id); }
    const scanRows = studentIds.slice(0, 40).map((sid, i) => ({ tenantId, sessionId: sessionIds[i % 3], credentialId: null, studentId: sid, resultStatus: i % 10 === 0 ? 'rejected' : 'accepted', rejectionReason: i % 10 === 0 ? 'WRONG_CLASS' : null, idempotencyKey: `scan-${sid}-${i}`, scannedAt: isoTs(-2), classSectionId: classInfo['2nde']!.sections[i % 3], registerId: null, stagedStatus: i % 10 === 0 ? 'absent' : 'present', attendanceRecordId: null }));
    for (let i = 0; i < scanRows.length; i += 50) await tx.insert(attendanceScanEvents).values(scanRows.slice(i, i + 50));
    const punchRows = teacherIds.slice(0, 10).flatMap((tid, i) => [{ tenantId, employeeId: tid, credentialId: null, punchType: 'in', scannedAt: isoTs(-1), deviceId: devIds[3], notes: null }, { tenantId, employeeId: tid, credentialId: null, punchType: 'out', scannedAt: isoTs(-1), deviceId: devIds[3], notes: null }]);
    await tx.insert(workforcePunchEvents).values(punchRows);
    console.log(`  · seeded attendance extras (${excuseRows.length} excuses, ${flagRows.length} flags, ${summaryRows.length} summaries, ${scanRows.length} scans, ${punchRows.length} punches)`);

    // -----------------------------------------------------------------------
    // Communication / CRM: connections, segments, templates, campaigns,
    // deliveries, automations, SMS.
    // -----------------------------------------------------------------------
    const connRows = [
      { tenantId, branchId, channel: 'sms' as const, name: 'Passerelle SMS OVH', provider: 'OVH', configJson: { apiKey: 'seed' }, status: 'connected' as const, lastTestedAt: isoTs(-5), createdBy: 'USR-001', createdAt: isoTs(-60), updatedAt: isoTs(-5) },
      { tenantId, branchId, channel: 'email' as const, name: 'Mailjet', provider: 'Mailjet', configJson: { apiKey: 'seed' }, status: 'connected' as const, lastTestedAt: isoTs(-5), createdBy: 'USR-001', createdAt: isoTs(-60), updatedAt: isoTs(-5) },
      { tenantId, branchId, channel: 'whatsapp' as const, name: 'Meta WhatsApp', provider: 'Meta', configJson: { phone: '+212600000000' }, status: 'error' as const, lastTestedAt: isoTs(-20), createdBy: 'USR-001', createdAt: isoTs(-60), updatedAt: isoTs(-20) },
    ];
    const connIds: string[] = [];
    for (const c of connRows) { const [r] = await tx.insert(communicationConnections).values(c).returning(); connIds.push(r!.id); }
    const segRows = ['Tous les élèves', 'Parents 2nde', 'Enseignants actifs'].map((name, i) => ({ tenantId, branchId, name, description: `Segment ${name}`, definition: { role: i === 2 ? 'teacher' : 'student' }, memberCount: i === 0 ? 200 : i === 1 ? 50 : 20, lastComputedAt: isoTs(-1), createdBy: 'USR-001', createdAt: isoTs(-30), updatedAt: isoTs(-1) }));
    const segIds: string[] = [];
    for (const s of segRows) { const [r] = await tx.insert(communicationSegments).values(s).returning(); segIds.push(r!.id); }
    const tplRows = ['Rappel de paiement', 'Absence élève', 'Convocation réunion parents'].map((name, i) => ({ tenantId, name, channel: (i % 2 === 0 ? 'sms' : 'email') as const, category: i === 0 ? 'finance' : i === 1 ? 'attendance' : 'events', isActive: true, createdBy: 'USR-001', createdAt: isoTs(-45), updatedAt: isoTs(-45) }));
    const tplIds: string[] = [];
    for (const t of tplRows) { const [r] = await tx.insert(communicationTemplates).values(t).returning(); tplIds.push(r!.id); }
    const tplVerRows = tplIds.map((tid, i) => ({ tenantId, templateId: tid, version: 1, subject: i % 2 === 0 ? null : 'Information Atlas', bodyText: 'Bonjour, veuillez trouver ci-joint une information importante.', bodyHtml: null, variableSchema: { variables: ['firstName'] }, locale: 'fr', status: 'published' as const, providerApprovalStatus: 'approved' as const, createdBy: 'USR-001', createdAt: isoTs(-45) }));
    const tplVerIds: string[] = [];
    for (const v of tplVerRows) { const [r] = await tx.insert(communicationTemplateVersions).values(v).returning(); tplVerIds.push(r!.id); }
    const campRows = ['Campagne SMS rappel scolarité', 'Newsletter réunion parents'].map((name, i) => ({
      tenantId, branchId, name, channel: (i === 0 ? 'sms' : 'email') as const, connectionId: connIds[i], segmentId: segIds[0], templateId: tplIds[i], templateVersionId: tplVerIds[i], subject: i === 0 ? null : 'Réunion parents', bodyText: i === 0 ? 'Rappel : échéance de scolarité à venir.' : 'Vous êtes conviés à la réunion parents du semestre.', bodyHtml: null, scheduleAt: isoTs(3), timezone: 'Africa/Casablanca', status: (i === 0 ? 'completed' : 'scheduled') as const, targetedCount: 200, excludedCount: 0, invalidCount: 0, dedupCount: 0, consentExcludedCount: 0, suppressionExcludedCount: 0, enqueuedCount: i === 0 ? 200 : 0, sentCount: i === 0 ? 190 : 0, deliveredCount: i === 0 ? 180 : 0, failedCount: i === 0 ? 10 : 0, estimatedCost: i === 0 ? '95.00' : '0.00', idempotencyKey: `camp-${i}`, createdBy: 'USR-001', approvedBy: 'USR-001', approvedAt: isoTs(-1), sentAt: i === 0 ? isoTs(-2) : null, completedAt: i === 0 ? isoTs(-2) : null, createdAt: isoTs(-10), updatedAt: isoTs(-1),
    }));
    const campIds: string[] = [];
    for (const c of campRows) { const [r] = await tx.insert(communicationCampaigns).values(c).returning(); campIds.push(r!.id); }
    const campRecipientRows = studentIds.slice(0, 40).map((sid, i) => ({ tenantId, campaignId: campIds[0], recipientKind: 'student' as const, recipientId: sid, contactName: null, phone: `+2126${String(10000000 + i).slice(0, 8)}`, email: null, status: (i % 20 === 0 ? 'failed' : 'sent') as const, skipReason: i % 20 === 0 ? 'NO_RESPONSE' : null, createdAt: isoTs(-2) }));
    const campRecipientIds: string[] = [];
    for (let i = 0; i < campRecipientRows.length; i += 50) { const rows = await tx.insert(communicationCampaignRecipients).values(campRecipientRows.slice(i, i + 50)).returning({ id: communicationCampaignRecipients.id }); campRecipientIds.push(...rows.map((r) => r.id)); }
    const consentRows = studentIds.slice(0, 30).map((sid, i) => ({ tenantId, recipientKind: 'student' as const, recipientId: sid, channel: (i % 2 === 0 ? 'sms' : 'email') as const, granted: i % 5 !== 0, source: 'inscription', capturedAt: isoTs(-90), createdAt: isoTs(-90), updatedAt: isoTs(-90) }));
    for (let i = 0; i < consentRows.length; i += 50) await tx.insert(communicationConsents).values(consentRows.slice(i, i + 50));
    const suppressionRows = studentIds.slice(0, 6).map((sid, i) => ({ tenantId, recipientKind: 'student' as const, recipientId: sid, channel: i % 2 === 0 ? ('sms' as const) : null, reason: 'Opt-out', createdBy: 'USR-001', createdAt: isoTs(-15) }));
    await tx.insert(communicationSuppressions).values(suppressionRows);
    const deliveryRows = campRecipientIds.map((rid, i) => ({ tenantId, campaignId: campIds[0], recipientId: rid, channel: 'sms' as const, provider: 'OVH', status: (i % 20 === 0 ? 'failed' : i % 7 === 0 ? 'delivered' : 'sent') as const, providerRef: `ref-${i}`, failureReason: i % 20 === 0 ? 'TIMEOUT' : null, retryCount: i % 20 === 0 ? 2 : 0, maxRetries: 3, nextRetryAt: null, lockedUntil: null, idempotencyKey: `dlv-${rid}`, sentAt: isoTs(-2), deliveredAt: i % 7 === 0 ? isoTs(-2) : null, failedAt: i % 20 === 0 ? isoTs(-2) : null, createdAt: isoTs(-2), updatedAt: isoTs(-2) }));
    const deliveryIds: string[] = [];
    for (let i = 0; i < deliveryRows.length; i += 50) { const rows = await tx.insert(communicationDeliveries).values(deliveryRows.slice(i, i + 50)).returning({ id: communicationDeliveries.id }); deliveryIds.push(...rows.map((r) => r.id)); }
    const dlvEventRows = deliveryIds.slice(0, 20).map((did, i) => ({ tenantId, deliveryId: did, campaignId: campIds[0], eventType: pick(['queued', 'sent', 'delivered', 'failed'] as const), status: null, detail: { step: 'provider_ack' }, createdAt: isoTs(-2) }));
    await tx.insert(communicationDeliveryEvents).values(dlvEventRows);
    const autoRows = ['Souhaits d’anniversaire – élèves', 'Souhaits d’anniversaire – personnel'].map((name, i) => ({ tenantId, branchId, name, kind: (i === 0 ? 'birthday_student' : 'birthday_staff') as const, channel: 'sms' as const, connectionId: connIds[0], templateId: tplIds[0], audienceKind: i === 0 ? 'students' : 'staff', timezone: 'Africa/Casablanca', sendTime: '08:00', quietHoursStart: null, quietHoursEnd: null, approvalMode: 'auto', isActive: true, nextRunAt: isoTs(1), createdBy: 'USR-001', createdAt: isoTs(-40), updatedAt: isoTs(-40) }));
    const autoIds: string[] = [];
    for (const a of autoRows) { const [r] = await tx.insert(communicationAutomations).values(a).returning(); autoIds.push(r!.id); }
    const runRows = autoIds.map((aid, i) => ({ tenantId, automationId: aid, runDate: '2026-08-10', status: (i === 0 ? 'completed' : 'pending') as const, createdCount: i === 0 ? 12 : 0, queuedCount: 12, skippedCount: 2, failedCount: 0, startedAt: i === 0 ? isoTs(0) : null, completedAt: i === 0 ? isoTs(0) : null, createdAt: isoTs(0) }));
    const runIds: string[] = [];
    for (const r of runRows) { const [rr] = await tx.insert(communicationAutomationRuns).values(r).returning(); runIds.push(rr!.id); }
    const autoRecRows = runIds.flatMap((rid) => studentIds.slice(0, 6).map((sid, k) => ({ tenantId, runId: rid, personId: sid, channel: 'sms' as const, status: (k === 5 ? 'skipped' : 'sent') as const, skipReason: k === 5 ? 'NO_CONSENT' : null, createdAt: isoTs(0) })));
    await tx.insert(communicationAutomationRecipients).values(autoRecRows);
    const smsTplRows = ['Rappel scolarité', 'Absence', 'Convocation'].map((name) => ({ tenantId, name, body: `Message automatique : ${name}.`, createdAt: isoTs(-30), updatedAt: isoTs(-30) }));
    await tx.insert(smsTemplates).values(smsTplRows);
    const smsMsgRows = studentIds.slice(0, 25).map((sid, i) => ({ tenantId, recipientPhone: `+2126${String(70000000 + i).slice(0, 8)}`, studentId: sid, body: 'Rappel : réunion parents samedi à 10h.', status: (i % 5 === 0 ? 'failed' : 'sent') as const, sentAt: i % 5 === 0 ? null : isoTs(-1), createdById: 'USR-001', createdAt: isoTs(-1) }));
    for (let i = 0; i < smsMsgRows.length; i += 50) await tx.insert(smsMessages).values(smsMsgRows.slice(i, i + 50));
    console.log(`  · seeded communication (${connIds.length} connections, ${tplIds.length} templates, ${campIds.length} campaigns, ${deliveryIds.length} deliveries, ${autoIds.length} automations)`);

    // -----------------------------------------------------------------------
    // Certificates + documents: definitions, templates, requests, issued
    // certs, jobs, signatories, document templates, ID cards, marksheets.
    // -----------------------------------------------------------------------
    const defRows = ['Certificat de scolarité', 'Attestation de réussite', 'Certificat de non redoublement'].map((title, i) => ({ tenantId, title, description: `Document officiel ${title}`, allowedTargetType: 'student', status: (i === 0 ? 'active' : 'draft') as const, createdAt: isoTs(-50), createdBy: 'USR-001' }));
    const defIds: string[] = [];
    for (const d of defRows) { const [r] = await tx.insert(certificateDefinitions).values(d).returning(); defIds.push(r!.id); }
    const defVerIds: string[] = [];
    for (const did of defIds) { const [r] = await tx.insert(certificateDefinitionVersions).values({ tenantId, definitionId: did, versionNumber: 1, fieldAllowlist: ['nom', 'classe', 'annee'], templateSchema: { layout: 'A4' }, pdfmeBasePdf: { page: { width: 210, height: 297 } }, status: 'active' as const, createdAt: isoTs(-50), createdBy: 'USR-001' }).returning(); defVerIds.push(r!.id); }
    const certTplRows = ['Modèle diplôme lycée', 'Modèle certificat scolarité'].map((name, i) => ({ tenantId, name, description: `Gabarit ${name}`, status: (i === 0 ? 'active' : 'draft') as const, createdAt: isoTs(-50), createdBy: 'USR-001' }));
    const certTplIds: string[] = [];
    for (const t of certTplRows) { const [r] = await tx.insert(certificateTemplates).values(t).returning(); certTplIds.push(r!.id); }
    const certTplVerIds: string[] = [];
    for (const tid of certTplIds) { const [r] = await tx.insert(certificateTemplateVersions).values({ tenantId, templateId: tid, versionNumber: 1, templateSchema: { fields: ['nom', 'classe'] }, pdfmeBasePdf: { page: { width: 210, height: 297 } }, status: 'active' as const, createdAt: isoTs(-50), createdBy: 'USR-001' }).returning(); certTplVerIds.push(r!.id); }
    const reqRows = studentIds.slice(0, 18).map((sid, i) => ({ tenantId, definitionId: defIds[i % 3], requesterId: 'USR-001', recipientId: sid, evidenceSnapshot: { source: 'admin' }, status: pick(['submitted', 'approved', 'issued', 'under_review'] as const), notes: null, createdAt: isoTs(-20), updatedAt: isoTs(-5) }));
    const reqIds: string[] = [];
    for (let i = 0; i < reqRows.length; i += 50) { const rows = await tx.insert(certificateRequests).values(reqRows.slice(i, i + 50)).returning({ id: certificateRequests.id }); reqIds.push(...rows.map((r) => r.id)); }
    const issuedRows = studentIds.slice(0, 15).map((sid, i) => ({ tenantId, definitionId: defIds[i % 3], versionId: defVerIds[i % 3], recipientId: sid, requestId: reqIds[i] ?? null, serialNumber: `CERT-2026-${pad4(i + 1)}`, verificationTokenHash: `vh-${i}-${sid.slice(0, 6)}`, status: i % 8 === 0 ? 'replaced' : 'valid', evidenceSnapshot: { nom: sid }, issuedAt: isoTs(-10), issuedBy: 'USR-001', fileExt: 'pdf' }));
    const issuedIds: string[] = [];
    for (let i = 0; i < issuedRows.length; i += 50) { const rows = await tx.insert(issuedCertificates).values(issuedRows.slice(i, i + 50)).returning({ id: issuedCertificates.id }); issuedIds.push(...rows.map((r) => r.id)); }
    const certJobRows = defIds.map((did, i) => ({ tenantId, definitionId: did, status: (i === 0 ? 'completed' : 'processing') as const, totalCount: 50, successCount: i === 0 ? 48 : 0, errorCount: i === 0 ? 2 : 0, createdAt: isoTs(-5), createdBy: 'USR-001' }));
    const certJobIds: string[] = [];
    for (const j of certJobRows) { const [r] = await tx.insert(certificateJobs).values(j).returning(); certJobIds.push(r!.id); }
    const certJobItemRows = studentIds.slice(0, 20).map((sid, i) => ({ tenantId, jobId: certJobIds[i % 2], recipientId: sid, status: (i % 7 === 0 ? 'failed' : 'success') as const, errorReason: i % 7 === 0 ? 'RENDER_TIMEOUT' : null, issuedCertificateId: i % 7 === 0 ? null : issuedIds[i % issuedIds.length] }));
    await tx.insert(certificateJobItems).values(certJobItemRows);
    const certEventRows = issuedIds.slice(0, 8).map((icid, i) => ({ tenantId, issuedCertificateId: icid, eventKind: (i % 3 === 1 ? 'replaced' : 'issued') as const, actorId: 'USR-001', reason: null, metadata: null, createdAt: isoTs(-10) }));
    await tx.insert(certificateEvents).values(certEventRows);
    await tx.insert(certificateSignatories).values([{ tenantId, name: 'Youssef El Amrani', title: 'Directeur', signatureImageId: 'sig-dir-1', isActive: true, createdAt: isoTs(-90) }, { tenantId, name: 'Fatima Zahra', title: 'Secrétaire générale', signatureImageId: 'sig-sg-1', isActive: true, createdAt: isoTs(-90) }]);
    const certRosterRows = studentIds.slice(0, 12).map((sid, i) => ({ tenantId, eventName: 'Cérémonie remise des diplômes 2026', participantId: sid, status: pick(['going', 'attended', 'not_going'] as const), createdAt: isoTs(-8) }));
    await tx.insert(certificateEventRosters).values(certRosterRows);
    const docTplRows = [{ name: 'Carte étudiant', type: 'student_id' as const }, { name: 'Badge personnel', type: 'employee_id' as const }, { name: 'Convocation examen', type: 'admit_card' as const }].map((t, i) => ({ tenantId, name: t.name, type: t.type, status: (i === 0 ? 'published' : 'draft') as const, isDefault: i === 0, createdAt: isoTs(-40), createdBy: 'USR-001' }));
    const docTplIds: string[] = [];
    for (const t of docTplRows) { const [r] = await tx.insert(documentTemplates).values(t).returning(); docTplIds.push(r!.id); }
    const docTplVerIds: string[] = [];
    for (const tid of docTplIds) { const [r] = await tx.insert(documentTemplateVersions).values({ tenantId, templateId: tid, versionNumber: 1, pageWidthMm: 86, pageHeightMm: 54, orientation: 'landscape', schemaJson: { fields: ['nom', 'photo', 'classe'] }, storageKey: null, publishedById: 'USR-001', publishedAt: isoTs(-40), createdAt: isoTs(-40) }).returning(); docTplVerIds.push(r!.id); }
    const issuedDocRows = studentIds.slice(0, 12).map((sid, i) => ({ tenantId, type: (i % 3 === 2 ? 'admit_card' : 'student_id') as const, templateVersionId: docTplVerIds[i % 3 === 2 ? 2 : 0], subjectType: 'student' as const, subjectId: sid, examCandidateId: null, publicTokenHash: `doc-${i}-${sid.slice(0, 6)}`, status: (i % 6 === 0 ? 'revoked' : 'active') as const, validFrom: '2025-09-01T00:00:00.000Z', validUntil: '2026-08-31T00:00:00.000Z', renderDataSnapshot: { nom: sid }, issuedById: 'USR-001', issuedAt: isoTs(-90), replacedDocumentId: null, revokedAt: i % 6 === 0 ? isoTs(-3) : null, revokedById: i % 6 === 0 ? 'USR-001' : null, revokeReason: i % 6 === 0 ? 'perdu' : null }));
    const issuedDocIds: string[] = [];
    for (let i = 0; i < issuedDocRows.length; i += 50) { const rows = await tx.insert(issuedDocuments).values(issuedDocRows.slice(i, i + 50)).returning({ id: issuedDocuments.id }); issuedDocIds.push(...rows.map((r) => r.id)); }
    const genJobs = [{ type: 'student_id' as const, total: 200 }, { type: 'admit_card' as const, total: 80 }].map((g, i) => ({ tenantId, type: g.type, templateVersionId: docTplVerIds[i * 2 === 0 ? 0 : 2], filtersSnapshot: { classes: ['2nde', 'Terminale'] }, status: (i === 0 ? 'completed' : 'processing') as const, totalCount: g.total, successCount: i === 0 ? g.total : 0, errorCount: i === 0 ? 0 : 3, startedAt: isoTs(-4), completedAt: i === 0 ? isoTs(-4) : null, createdAt: isoTs(-4), createdBy: 'USR-001' }));
    const genJobIds: string[] = [];
    for (const g of genJobs) { const [r] = await tx.insert(documentGenerationJobs).values(g).returning(); genJobIds.push(r!.id); }
    const genItemRows = studentIds.slice(0, 15).map((sid, i) => ({ tenantId, jobId: genJobIds[0], subjectType: 'student' as const, subjectId: sid, issuedDocumentId: issuedDocIds[i % issuedDocIds.length], status: (i % 5 === 0 ? 'failed' : 'success') as const, errorCode: i % 5 === 0 ? 'RENDER_ERR' : null, errorMessage: i % 5 === 0 ? 'champs manquants' : null }));
    await tx.insert(documentGenerationItems).values(genItemRows);
    await tx.insert(marksheetTemplates).values([
      { tenantId: tenantId.toString(), title: 'Bulletin S1 – Lycée', columnsJson: ['matiere', 'note', 'coeff', 'mention'], showGrades: true, showRankings: true, roundingMethod: 'half_up', signatureLabelsJson: ['Le Directeur', 'Le Professeur principal'], createdAt: isoTs(-60) },
      { tenantId: tenantId.toString(), title: 'Relevé de notes – Collège', columnsJson: ['matiere', 'note', 'coeff'], showGrades: true, showRankings: false, roundingMethod: 'half_up', signatureLabelsJson: ['Le Directeur'], createdAt: isoTs(-60) },
    ]);
    console.log(`  · seeded certificates/documents (${defIds.length} defs, ${issuedIds.length} issued certs, ${issuedDocIds.length} ID cards, ${genJobIds.length} gen jobs)`);

    // -----------------------------------------------------------------------
    // Admissions / alumni / student extras: campaigns, applicants, alumni
    // directory, promotions, discipline, leaves, parent requests.
    // -----------------------------------------------------------------------
    const [camp] = await tx.insert(admissionCampaigns).values({ tenantId, name: 'Rentrée 2026-2027', startDate: '2026-03-01', endDate: '2026-08-31', academicTermId: ayTerm1!.id, isActive: true, createdAt: isoTs(-60), updatedAt: isoTs(-1) }).returning();
    const appFirst = ['Sara', 'Yassine', 'Imane', 'Karim', 'Salma', 'Mehdi', 'Nadia', 'Omar'];
    const appLast = ['Bennani', 'Alaoui', 'Cherkaoui', 'El Fassi', 'Tazi', 'Berrada', 'Idrissi', 'Rahmani'];
    const applicantRows = Array.from({ length: 20 }, (_, i) => ({ tenantId, campaignId: camp!.id, firstName: appFirst[i % 8], lastName: appLast[i % 8], email: `candidat.${i + 1}@atlas.ma`, phone: `+2126${String(50000000 + i).slice(0, 8)}`, dateOfBirth: `${2008 + (i % 5)}-0${(i % 9) + 1}-15`, targetProgramId: programIds[i % 2], status: pick(['new', 'contacted', 'qualified', 'converted', 'lost']), guardianName: `Parent ${appLast[i % 8]}`, guardianPhone: `+2126${String(60000000 + i).slice(0, 8)}`, guardianEmail: null, applicationDate: isoTs(-int(5, 60)), convertedUserId: i % 5 === 3 ? studentIds[i % 200] : null, gender: i % 2 === 0 ? ('female' as const) : ('male' as const), nationality: 'Marocaine', motherTongue: 'Français', city: 'Casablanca', bloodGroup: pick(['A+', 'O+', 'B+', 'AB+']), academicYearId: ay25!.id, guardianId: null, checklistDocumentsReceived: i % 3 !== 0, checklistInterviewDone: i % 4 === 0, checklistFileComplete: i % 5 === 0 }));
    const appIds: string[] = [];
    for (let i = 0; i < applicantRows.length; i += 50) { const rows = await tx.insert(applicants).values(applicantRows.slice(i, i + 50)).returning({ id: applicants.id }); appIds.push(...rows.map((r) => r.id)); }
    const interviewRows = appIds.slice(0, 8).map((aid, i) => ({ tenantId, applicantId: aid, scheduledAt: isoTs(int(3, 15)), interviewerId: teacherIds[i % 20], location: 'Salle des entretiens', status: pick(['scheduled', 'completed', 'cancelled'] as const), notes: i % 2 === 0 ? 'Bon dossier' : null, createdAt: isoTs(-7), updatedAt: isoTs(-1) }));
    await tx.insert(admissionInterviews).values(interviewRows);
    const appCommentRows = appIds.slice(0, 8).map((aid, i) => ({ tenantId, applicantId: aid, authorId: 'USR-001', body: `Entretien ${i + 1} : élève motivé.`, createdAt: isoTs(-6) }));
    await tx.insert(admissionComments).values(appCommentRows);
    const appDocRows = appIds.slice(0, 10).map((aid, i) => ({ tenantId, applicantId: aid, documentType: pick(['birth_certificate', 'school_certificate', 'photo'] as const), fileExt: 'pdf', uploadedAt: isoTs(-10) }));
    await tx.insert(applicantDocuments).values(appDocRows);
    const alumniRows = studentIds.slice(0, 15).map((sid, i) => ({ tenantId, alumnusId: sid, showName: true, showCohort: i % 4 !== 0, showCurrentEmployer: i % 3 === 0, showContactInfo: i % 2 === 0, currentEmployer: i % 3 === 0 ? pick(['OCP', 'Maroc Telecom', 'Université Hassan II']) : null, updatedAt: isoTs(-30) }));
    await tx.insert(alumniDirectoryConsent).values(alumniRows);
    const [alumEv] = await tx.insert(alumniEvents).values({ tenantId, title: 'Rencontre des anciens 2026', description: 'Réunion annuelle des diplômés Atlas.', location: 'Auditorium principal', startsAt: isoTs(20), endsAt: isoTs(20), createdBy: 'USR-001', createdAt: isoTs(-15) }).returning();
    const alumRsvpRows = studentIds.slice(0, 10).map((sid, i) => ({ tenantId, eventId: alumEv!.id, alumnusId: sid, status: pick(['going', 'not_going', 'maybe'] as const), updatedAt: isoTs(-2) }));
    await tx.insert(alumniEventRsvps).values(alumRsvpRows);
    const mentorRows = studentIds.slice(0, 6).map((sid, i) => ({ tenantId, alumnusId: sid, isActive: true, offering: pick(['Orientation universitaire', 'Coaching carrière', 'Aide aux devoirs']), contactPreference: 'email', createdAt: isoTs(-40), updatedAt: isoTs(-1) }));
    await tx.insert(alumniMentorListings).values(mentorRows);
    const alumReqRows = studentIds.slice(0, 8).map((sid, i) => ({ tenantId, alumnusId: sid, type: pick(['correction', 'reissue', 'data_access', 'deletion'] as const), status: pick(['pending', 'approved', 'rejected'] as const), note: 'Demande de réédition de diplôme', relatedDocumentId: null, decidedBy: i % 2 === 0 ? 'USR-001' : null, decidedAt: i % 2 === 0 ? isoTs(-3) : null, decisionNote: i % 2 === 0 ? 'Approuvé' : null, createdAt: isoTs(-20) }));
    await tx.insert(alumniRequests).values(alumReqRows);
    const studDocRows = studentIds.slice(0, 16).flatMap((sid, i) => [
      { tenantId, studentId: sid, documentType: 'photo' as const, fileExt: 'jpg', uploadedAt: isoTs(-100) },
      { tenantId, studentId: sid, documentType: 'birth_certificate' as const, fileExt: 'pdf', uploadedAt: isoTs(-100) },
    ]);
    for (let i = 0; i < studDocRows.length; i += 50) await tx.insert(studentDocuments).values(studDocRows.slice(i, i + 50));
    const discipRows = studentIds.slice(0, 10).map((sid, i) => ({ tenantId, studentId: sid, date: `${2026}-0${(i % 6) + 1}-${(i % 27) + 1}`, infraction: pick(['Retard répété', 'Non-respect du règlement', 'Absence non justifiée']), actionTaken: i % 2 === 0 ? 'Avertissement oral' : 'Avertissement écrit', reportedById: teacherIds[i % 20], createdAt: isoTs(-15) }));
    await tx.insert(studentDiscipline).values(discipRows);
    const leaveRows = studentIds.slice(0, 12).map((sid, i) => ({ tenantId, studentId: sid, startDate: '2026-03-10', endDate: '2026-03-12', reason: pick(['Voyage familial', 'Rendez-vous médical', 'Événement familial']), status: pick(['pending', 'approved', 'rejected'] as const), createdAt: isoTs(-25), updatedAt: isoTs(-20) }));
    await tx.insert(studentLeaves).values(leaveRows);
    const [promoBatch] = await tx.insert(promotionBatches).values({ tenantId, sourceClassSectionId: classInfo['3ème']!.sections[0], targetSessionYearId: sessionYearId, status: 'committed' as const, idempotencyKey: 'promo-2026-01', operatorId: 'USR-001', revertedAt: null, createdAt: isoTs(-30) }).returning();
    const promoRows = studentIds.slice(0, 12).map((sid, i) => ({ tenantId, batchId: promoBatch!.id, studentId: sid, decision: (i % 6 === 0 ? 'repeat' : i % 7 === 0 ? 'withdraw' : 'promote') as const, targetClassSectionId: i % 6 === 0 ? null : classInfo['2nde']!.sections[i % 3], placementId: null, averagePercentageAtDecision: int(55, 96), reason: i % 6 === 0 ? 'Échec aux examens' : null, createdAt: isoTs(-30) }));
    await tx.insert(promotionDecisions).values(promoRows);
    const parentReqRows = studentIds.slice(0, 10).map((sid, i) => ({ tenantId, guardianId: guardianIds[i % 130], studentId: sid, requestType: 'absence', subject: 'Autorisation d’absence', body: 'Merci d’accepter l’absence de mon enfant.', status: pick(['pending', 'approved', 'rejected']), decidedById: i % 2 === 0 ? 'USR-001' : null, decisionNotes: i % 2 === 0 ? 'OK' : null, createdAt: isoTs(-12), updatedAt: isoTs(-8) }));
    await tx.insert(parentRequests).values(parentReqRows);
    console.log(`  · seeded admissions/alumni/student extras (${appIds.length} applicants, alumni, promotions)`);

    // -----------------------------------------------------------------------
    // Guard / reception portals + platform: gates, shifts, visits, incidents,
    // reception appointments, custom fields, role permissions, domains, settings.
    // -----------------------------------------------------------------------
    const gateRows = [['PORT-A', 'Portail principal', 'in'], ['PORT-B', 'Portail secondaire', 'out']].map((g, i) => ({ tenantId, branchId, gateCode: g[0], gateName: g[1], direction: g[2], isActive: true, createdAt: isoTs(-90), updatedAt: isoTs(-90) }));
    const gateIds: string[] = [];
    for (const g of gateRows) { const [r] = await tx.insert(guardGates).values(g).returning(); gateIds.push(r!.id); }
    const gShiftRows = [['Matin', '06:00', '14:00'], ['Après-midi', '14:00', '22:00'], ['Nuit', '22:00', '06:00']].map((s) => ({ tenantId, branchId, name: s[0], startTime: s[1], endTime: s[2], isActive: true, createdAt: isoTs(-90), updatedAt: isoTs(-90) }));
    const gShiftIds: string[] = [];
    for (const s of gShiftRows) { const [r] = await tx.insert(guardShifts).values(s).returning(); gShiftIds.push(r!.id); }
    const gAssignRows = [0, 1, 2, 3].map((i) => ({ tenantId, branchId, guardUserId: teacherIds[i % 20], gateId: gateIds[i % 2], shiftId: gShiftIds[i % 3], deviceId: null, effectiveFrom: '2025-09-01T00:00:00.000Z', effectiveUntil: i % 2 === 0 ? null : '2026-12-31T00:00:00.000Z', status: 'active', createdAt: isoTs(-90), updatedAt: isoTs(-90) }));
    await tx.insert(guardAssignments).values(gAssignRows);
    const gInvRows = [0, 1, 2, 3, 4].map((i) => ({ tenantId, branchId, visitorFirstName: pick(['Ahmed', 'Samira', 'Hassan', 'Khadija', 'Rachid']), visitorLastName: 'Visiteur', visitorPhone: `+2126${String(40000000 + i).slice(0, 8)}`, visitorEmail: null, purpose: pick(['Entretien admission', 'Réunion parents', 'Livraison']), hostId: teacherIds[i % 20], expectedDate: isoTs(int(1, 10)), expectedStart: '10:00', expectedEnd: '12:00', status: i % 2 === 0 ? 'approved' : 'pending', approvedById: i % 2 === 0 ? 'USR-001' : null, approvedAt: i % 2 === 0 ? isoTs(-1) : null, createdById: 'USR-001', createdAt: isoTs(-5), updatedAt: isoTs(-1) }));
    await tx.insert(guardVisitorInvitations).values(gInvRows);
    const gVisitRows = [0, 1, 2].map((i) => ({ tenantId, branchId, invitationId: null, visitorFirstName: pick(['Youssef', 'Latifa', 'Brahim']), visitorLastName: 'Visiteur', visitorPhone: `+2126${String(30000000 + i).slice(0, 8)}`, visitorEmail: null, purpose: 'Rencontre administrative', hostId: null, hostName: 'Direction', passNumber: `PASS-${pad4(i + 1)}`, badgeCredentialId: null, status: i === 0 ? 'checked_in' : 'checked_out', checkInAt: i === 0 ? isoTs(-1) : isoTs(-2), checkOutAt: i === 0 ? null : isoTs(-1), checkInBy: 'USR-001', checkOutBy: i === 0 ? null : 'USR-001', gateId: gateIds[0], createdById: 'USR-001', createdAt: isoTs(-2), updatedAt: isoTs(-1) }));
    await tx.insert(guardVisits).values(gVisitRows);
    const gAuthRows = studentIds.slice(0, 8).map((sid, i) => ({ tenantId, studentId: sid, pickupPersonId: guardianIds[i % 130], relationshipType: 'parent', authorizedFrom: '2025-09-01T00:00:00.000Z', authorizedUntil: '2026-08-31T00:00:00.000Z', reason: null, status: i % 3 === 0 ? 'cancelled' : 'active', consumedAt: null, createdById: 'USR-001', createdAt: isoTs(-80), updatedAt: isoTs(-80) }));
    const gAuthIds: string[] = [];
    for (const a of gAuthRows) { const [r] = await tx.insert(guardPickupAuthorizations).values(a).returning(); gAuthIds.push(r!.id); }
    const gRelRows = gAuthIds.slice(0, 4).map((aid, i) => ({ tenantId, studentId: studentIds[i], authorizationId: aid, releaseMethod: 'manual', operatorId: 'USR-001', gateId: gateIds[i % 2], deviceId: null, kioskSessionId: null, idempotencyKey: `rel-${aid.slice(0, 8)}`, releasedAt: isoTs(-1), evidence: { gate: 'PORT-A' } }));
    await tx.insert(guardReleaseEvents).values(gRelRows);
    const gScanRows = studentIds.slice(0, 15).map((sid, i) => ({ tenantId, kioskSessionId: null, gateId: gateIds[i % 2], deviceId: null, direction: i % 2 === 0 ? 'in' : 'out', credentialId: null, subjectType: 'student', studentId: sid, visitId: null, resultStatus: i % 7 === 0 ? 'rejected' : 'accepted', rejectionReason: i % 7 === 0 ? 'NO_AUTH' : null, idempotencyKey: `gscan-${sid}-${i}`, scannedAt: isoTs(0), actorId: 'USR-001' }));
    await tx.insert(guardGateScanEvents).values(gScanRows);
    const gIncRows = [0, 1, 2].map((i) => ({ tenantId, branchId, gateId: gateIds[i % 2], category: pick(['acces_non_autorise', 'materiel_endommage', 'intrusion']), severity: pick(['low', 'medium', 'high']), location: 'Portail principal', description: 'Incident de sécurité signalé', reportedById: 'USR-001', occurredAt: isoTs(-3), status: i === 0 ? 'open' : 'resolved', escalatedToId: null, escalatedAt: null, resolvedById: i === 0 ? null : 'USR-001', resolvedAt: i === 0 ? null : isoTs(-1), resolutionNotes: i === 0 ? null : 'Traité', createdAt: isoTs(-3), updatedAt: isoTs(-1) }));
    const gIncIds: string[] = [];
    for (const inc of gIncRows) { const [r] = await tx.insert(guardIncidents).values(inc).returning(); gIncIds.push(r!.id); }
    const gIncActRows = gIncIds.map((iid, i) => ({ tenantId, incidentId: iid, actionType: 'notification', notes: 'Avis transmis à la direction', actorId: 'USR-001', createdAt: isoTs(-2) }));
    await tx.insert(guardIncidentActions).values(gIncActRows);
    await tx.insert(guardEmergencyProcedures).values([{ tenantId, branchId, title: 'Incendie', body: 'Évacuer les élèves vers la cour.', version: 1, isActive: true, updatedById: 'USR-001', createdAt: isoTs(-120), updatedAt: isoTs(-120) }, { tenantId, branchId, title: 'Alerte intrusion', body: 'Fermer les portails et alerter les autorités.', version: 1, isActive: true, updatedById: 'USR-001', createdAt: isoTs(-120), updatedAt: isoTs(-120) }]);
    await tx.insert(guardEmergencyContacts).values([{ tenantId, branchId, name: 'Police', role: 'Sécurité', phone: '19', priority: 1, isActive: true, createdAt: isoTs(-120), updatedAt: isoTs(-120) }, { tenantId, branchId, name: 'Pompiers', role: 'Secours', phone: '15', priority: 2, isActive: true, createdAt: isoTs(-120), updatedAt: isoTs(-120) }]);
    await tx.insert(guardEmergencyActivations).values([{ tenantId, activatedById: 'USR-001', activatedAt: isoTs(-4), procedureSnapshot: { title: 'Exercice incendie' }, status: 'ended', endedById: 'USR-001', endedAt: isoTs(-4), reason: 'Exercice', createdAt: isoTs(-4) }]);
    const recRows = [0, 1, 2, 3, 4].map((i) => ({ tenantId, branchId, guestType: pick(['parent', 'visiteur', 'candidat']), guestName: `Visiteur ${i + 1}`, guestPhone: `+2126${String(20000000 + i).slice(0, 8)}`, purpose: pick(['Inscription', 'Réclamation', 'Rencontre']), hostId: teacherIds[i % 20]!, hostName: null, startAt: isoTs(int(1, 8)), endAt: isoTs(int(1, 8)), status: i % 2 === 0 ? 'completed' : 'scheduled', notes: null, version: 1, idempotencyKey: null, createdById: 'USR-001', createdAt: isoTs(-3), updatedAt: isoTs(-1) }));
    const recIds: string[] = [];
    for (const r of recRows) { const [rr] = await tx.insert(receptionAppointments).values(r).returning(); recIds.push(rr!.id); }
    const recHistRows = recIds.slice(0, 4).map((rid, i) => ({ tenantId, appointmentId: rid, fromStatus: i === 0 ? null : 'scheduled', toStatus: 'completed', changedById: 'USR-001', reason: null, createdAt: isoTs(-1) }));
    await tx.insert(receptionAppointmentStatusHistory).values(recHistRows);
    const recIdvRows = studentIds.slice(0, 6).map((sid, i) => ({ tenantId, subjectType: 'student', subjectId: sid, method: pick(['cni', 'passport', 'badge']), outcome: 'success', notes: null, verifierId: 'USR-001', performedAt: isoTs(-2) }));
    await tx.insert(receptionIdentityVerifications).values(recIdvRows);
    const handRows = [0, 1, 2].map((i) => ({ tenantId, branchId, category: pick(['maintenance', 'document', 'admin']), subjectType: null, subjectId: null, title: `Tâche réception ${i + 1}`, description: null, priority: i % 2 === 0 ? 'high' : 'normal', assignedToId: 'USR-001', deadline: isoTs(int(2, 10)), status: i === 0 ? 'open' : 'resolved', resolutionNotes: i === 0 ? null : 'Traité', acknowledgedById: i === 0 ? null : 'USR-001', acknowledgedAt: i === 0 ? null : isoTs(-1), resolvedById: i === 0 ? null : 'USR-001', resolvedAt: i === 0 ? null : isoTs(-1), idempotencyKey: null, createdById: 'USR-001', createdAt: isoTs(-3), updatedAt: isoTs(-1) }));
    const handIds: string[] = [];
    for (const h of handRows) { const [r] = await tx.insert(receptionHandoffs).values(h).returning(); handIds.push(r!.id); }
    const handHistRows = handIds.map((hid, i) => ({ tenantId, handoffId: hid, fromStatus: null, toStatus: 'open', changedById: 'USR-001', reason: null, createdAt: isoTs(-3) }));
    await tx.insert(receptionHandoffStatusHistory).values(handHistRows);
    await tx.insert(tenantDomains).values([{ tenantId, domain: 'atlas.schoolos.app', domainType: 'subdomain' as const, status: 'approved' as const, verificationToken: 'vt-1', requestedAt: isoTs(-60), requestedById: 'USR-001', approvedAt: isoTs(-60), approvedById: 'USR-001', createdAt: isoTs(-60), updatedAt: isoTs(-60) }, { tenantId, domain: 'groupe-atlas.ma', domainType: 'custom' as const, status: 'pending' as const, verificationToken: 'vt-2', requestedAt: isoTs(-5), requestedById: 'USR-001', approvedAt: null, approvedById: null, createdAt: isoTs(-5), updatedAt: isoTs(-5) }]);
    await tx.insert(schoolSettings).values({ tenantId, establishmentName: 'Groupe Scolaire Atlas', city: 'Casablanca', address: '12, Avenue Mohammed V', phone: '+212522000000', email: 'contact@atlas.ma', academicYear: '2025-2026', startDate: '2025-09-01', endDate: '2026-06-30', allowOperations: true, presenceModes: ['morning', 'afternoon'], languages: ['fr', 'ar'], security: { twoFactor: true }, createdAt: isoTs(-180), updatedAt: isoTs(-1), ice: 'ICE-001234567', legalStatus: 'Privé', directorName: 'Youssef El Amrani', shortName: 'Atlas', website: 'https://atlas.ma', country: 'Maroc', rc: 'RC-12345', taxId: 'IF-123456', directorEmail: 'y.elamrani@atlas.ma', directorPhone: '+212522000001', financialContactName: 'Fatima Zahra', financialContactEmail: 'finance@atlas.ma', financialContactPhone: '+212522000002', admissionsContactName: 'Samira', admissionsContactEmail: 'admissions@atlas.ma', admissionsContactPhone: '+212522000003', localeTimezone: 'Africa/Casablanca', dateFormat: 'DD/MM/YYYY', documentHeaderStyle: 'classic', loginAccessMethod: 'username', attendanceLateGraceMinutes: 15, attendancePeriodStartTime: '08:00' });
    const cfRows = ([['matricule', 'N° matricule', 'student', 'text'], ['sport', 'Sport pratiqué', 'student', 'select']] as const).map((c, i) => ({ tenantId, key: c[0], label: c[1], entityType: c[2], fieldType: c[3], options: c[3] === 'select' ? ['football', 'basket', 'natation'] : null, required: false, defaultValue: null, sortOrder: i + 1, isActive: true, createdAt: isoTs(-70), updatedAt: isoTs(-70) }));
    const cfIds: string[] = [];
    for (const c of cfRows) { const [r] = await tx.insert(customFieldDefinitions).values(c).returning(); cfIds.push(r!.id); }
    const cfValRows = studentIds.slice(0, 20).map((sid, i) => ({ tenantId, definitionId: cfIds[i % 2]!, entityId: sid, value: i % 2 === 0 ? { value: `ATL-${i}` } : { value: 'football' }, updatedBy: 'USR-001', createdAt: isoTs(-70), updatedAt: isoTs(-70) }));
    await tx.insert(customFieldValues).values(cfValRows);
    const rolePermRows = ['school_admin', 'teacher', 'accountant', 'receptionist', 'guard', 'librarian'].flatMap((role) => ['dashboard.view', 'students.view', 'finance.view', 'settings.view'].map((perm) => ({ tenantId, roleId: role, permissionId: perm, createdAt: isoTs(-90), granted: true })));
    for (let i = 0; i < rolePermRows.length; i += 50) await tx.insert(rolePermissions).values(rolePermRows.slice(i, i + 50));
    const permOverrideRows = teacherIds.slice(0, 4).map((tid, i) => ({ tenantId, userId: tid, permissionId: 'finance.view', granted: i % 2 === 0, createdAt: isoTs(-30) }));
    await tx.insert(userPermissionOverrides).values(permOverrideRows);
    const inqRows2 = await tx.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.tenantId, tenantId));
    const followUpRows = inqRows2.slice(0, 8).map((q, i) => ({ tenantId, inquiryId: q.id, type: pick(['call', 'email', 'meeting', 'note'] as const), notes: `Relance ${i + 1}`, scheduledFor: i % 2 === 0 ? isoTs(int(1, 5)) : null, completedAt: i % 3 === 0 ? isoTs(-1) : null, createdById: 'USR-001', createdAt: isoTs(-4) }));
    await tx.insert(inquiryFollowUps).values(followUpRows);
    console.log(`  · seeded guard/reception/portal (${gateIds.length} gates, ${gAuthIds.length} authorizations, ${recIds.length} appointments, ${handIds.length} handoffs, ${rolePermRows.length} role permissions)`);

    // -----------------------------------------------------------------------
    // Accounts (login credentials) - all use the shared hashed password.
    // -----------------------------------------------------------------------
    const now = new Date();
    const hashedPassword = await hashPassword(SEED_PASSWORD);
    const demoStudentIds = [studentIds[0]!, studentIds[50]!, studentIds[100]!, studentIds[150]!];
    const parentUserRows = [1, 2, 3, 4, 5, 6].map((i) => ({
      id: `PARENT-00${i}`,
      tenantId,
      email: `parent.00${i}@atlas.ma`,
      name: `Parent ${i} Atlas`,
      role: 'parent' as const,
      userStatus: 'active' as const,
    }));
    for (let i = 0; i < parentUserRows.length; i += 10) await tx.insert(user).values(parentUserRows.slice(i, i + 10)).onConflictDoNothing();
    const credentialUserIds = [
      'USR-001', 'USR-ACC-001', 'USR-SUPER-001', ...teacherIds, ...demoStudentIds, ...parentUserRows.map((p) => p.id),
    ];
    for (const userId of credentialUserIds) {
      await tx
        .insert(account)
        .values({
          id: `seed-credential-${userId.toLowerCase()}`,
          accountId: userId,
          providerId: 'credential',
          userId,
          password: hashedPassword,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({ target: account.id, set: { password: hashedPassword, updatedAt: now } });
    }
    console.log(`  · seeded ${credentialUserIds.length} login accounts (password: ${SEED_PASSWORD})`);
  });
}

run()
  .then(() => {
    console.log('seed-full: DONE. Atlas tenant fully reseeded (200 students, 20 teachers, academics, exams, calendar, assignments, finance, add-ons).');
    process.exit(0);
  })
  .catch((err) => {
    console.error('seed-full FAILED:', err);
    process.exit(1);
  });
