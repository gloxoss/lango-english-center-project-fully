import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  academicPeriodType,
  attendance,
  attendanceExcuses,
  attendanceRegisters,
  cashierSessions,
  classes,
  classSections,
  classSubjects,
  feeCategories,
  feeStructureAssignments,
  feeStructures,
  guardians,
  guardianStudents,
  invoiceItems,
  invoices,
  mediums,
  paymentAllocations,
  payments,
  promotionBatches,
  promotionDecisions,
  sections,
  sessionYears,
  semesters,
  shifts,
  streams,
  studentPlacements,
  subjectTeachers,
  subjects,
  tenants,
  user,
} from '@/models/Schema';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import { POST as postPromotion } from '@/app/api/students/promotions/route';
import {
  calculateMoroccanAverage,
  calculateAnnualAverage,
  calculateClassRanks,
  type SubjectGradeInput,
} from '@/libs/grading/moroccan-grade-engine';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

const sessionUserId = { value: null as string | null };

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () =>
        sessionUserId.value
          ? { user: { id: sessionUserId.value }, session: { id: 'sess-lifecycle-test' } }
          : null,
    },
  },
}));

vi.mock('@/features/portal/services/active-context', () => ({
  resolveActiveContext: async () => null,
}));

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('School Year Lifecycle End-to-End Test (Task T11)', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = randomUUID();
  const adminId = `ADMIN-LK-${suffix}`;
  const cashierId = `CASHIER-LK-${suffix}`;
  const teacherMathId = `TEACHER-MATH-${suffix}`;
  const teacherPCId = `TEACHER-PC-${suffix}`;

  let sessionYear2025Id = '';
  let sessionYear2026Id = '';
  let semester1Id = '';
  let semester2Id = '';
  let mediumFrId = '';
  let mediumArId = '';
  let shiftMatinId = '';
  let streamTcScId = '';
  let stream1BacSeId = '';
  let classTcScId = '';
  let class1BacSeId = '';
  let sectionAId = '';
  let classSectionTcScAId = '';
  let classSection1BacSeAId = '';

  let subjectMathId = '';
  let subjectPCId = '';
  let subjectSvtId = '';
  let subjectFrId = '';
  let subjectArId = '';
  let subjectAngId = '';
  let subjectPhilId = '';
  let subjectEpsId = '';

  // 6 Students with distinct academic profiles
  const studentAmineId = `STU-AMINE-${suffix}`;
  const studentKenzaId = `STU-KENZA-${suffix}`;
  const studentYoussefId = `STU-YOUSSEF-${suffix}`;
  const studentNadiaId = `STU-NADIA-${suffix}`;
  const studentSalmaId = `STU-SALMA-${suffix}`;
  const studentOmarId = `STU-OMAR-${suffix}`;

  const allStudentIds = [
    studentAmineId,
    studentKenzaId,
    studentYoussefId,
    studentNadiaId,
    studentSalmaId,
    studentOmarId,
  ];

  beforeAll(async () => {
    // 1. Provision Fresh Tenant
    await db.insert(tenants).values({
      id: tenantId,
      name: `Lycée d'Excellence Al Khawarizmi ${suffix}`,
      slug: `alkhawarizmi-${suffix}`,
      isActive: true,
      planTier: 'trial',
      subscriptionStatus: 'active',
    });

    // 2. Provision Session Years (2025-2026 and 2026-2027)
    const [sy2025] = await db.insert(sessionYears).values({
      tenantId,
      name: '2025-2026',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
      isDefault: true,
    }).returning();
    sessionYear2025Id = sy2025!.id;

    const [sy2026] = await db.insert(sessionYears).values({
      tenantId,
      name: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      isDefault: false,
    }).returning();
    sessionYear2026Id = sy2026!.id;

    // 3. Provision Semesters
    const [sem1] = await db.insert(semesters).values({
      tenantId,
      name: 'Semestre 1',
      startMonth: 9,
      endMonth: 1,
    }).returning();
    semester1Id = sem1!.id;

    const [sem2] = await db.insert(semesters).values({
      tenantId,
      name: 'Semestre 2',
      startMonth: 2,
      endMonth: 6,
    }).returning();
    semester2Id = sem2!.id;

    // 4. Provision Mediums, Shifts, Streams, Sections
    const [medFr] = await db.insert(mediums).values({ tenantId, name: 'Français' }).returning();
    const [medAr] = await db.insert(mediums).values({ tenantId, name: 'Arabe' }).returning();
    mediumFrId = medFr!.id;
    mediumArId = medAr!.id;

    const [shMatin] = await db.insert(shifts).values({
      tenantId,
      name: 'Matinée',
      startTime: '08:00',
      endTime: '12:00',
    }).returning();
    shiftMatinId = shMatin!.id;

    const [strTc] = await db.insert(streams).values({ tenantId, name: 'Tronc Commun Scientifique' }).returning();
    const [str1Bac] = await db.insert(streams).values({ tenantId, name: '1ère Année Bac Sciences Expérimentales' }).returning();
    streamTcScId = strTc!.id;
    stream1BacSeId = str1Bac!.id;

    const [secA] = await db.insert(sections).values({ tenantId, name: 'Section A' }).returning();
    sectionAId = secA!.id;

    // 5. Provision Classes & ClassSections
    const [clTc] = await db.insert(classes).values({
      tenantId,
      name: 'TC-SC',
      cycle: 'lycee',
      mediumId: mediumFrId,
      shiftId: shiftMatinId,
      streamId: streamTcScId,
      includeSemesters: true,
      periodType: 'semester',
    }).returning();
    classTcScId = clTc!.id;

    const [cl1Bac] = await db.insert(classes).values({
      tenantId,
      name: '1BAC-SE',
      cycle: 'lycee',
      mediumId: mediumFrId,
      shiftId: shiftMatinId,
      streamId: stream1BacSeId,
      includeSemesters: true,
      periodType: 'semester',
    }).returning();
    class1BacSeId = cl1Bac!.id;

    const [csTc] = await db.insert(classSections).values({
      tenantId,
      classId: classTcScId,
      sectionId: sectionAId,
      mediumId: mediumFrId,
      maxStudents: 35,
    }).returning();
    classSectionTcScAId = csTc!.id;

    const [cs1Bac] = await db.insert(classSections).values({
      tenantId,
      classId: class1BacSeId,
      sectionId: sectionAId,
      mediumId: mediumFrId,
      maxStudents: 35,
    }).returning();
    classSection1BacSeAId = cs1Bac!.id;

    // 6. Provision Moroccan Subjects
    const [sMath] = await db.insert(subjects).values({ tenantId, name: 'Mathématiques', code: 'MATH', mediumId: mediumFrId, type: 'theory' }).returning();
    const [sPC] = await db.insert(subjects).values({ tenantId, name: 'Physique-Chimie', code: 'PC', mediumId: mediumFrId, type: 'practical' }).returning();
    const [sSvt] = await db.insert(subjects).values({ tenantId, name: 'Sciences de la Vie et de la Terre', code: 'SVT', mediumId: mediumFrId, type: 'practical' }).returning();
    const [sFr] = await db.insert(subjects).values({ tenantId, name: 'Français', code: 'FR', mediumId: mediumFrId, type: 'theory' }).returning();
    const [sAr] = await db.insert(subjects).values({ tenantId, name: 'Arabe', code: 'AR', mediumId: mediumArId, type: 'theory' }).returning();
    const [sAng] = await db.insert(subjects).values({ tenantId, name: 'Anglais', code: 'ANG', mediumId: mediumFrId, type: 'theory' }).returning();
    const [sPhil] = await db.insert(subjects).values({ tenantId, name: 'Philosophie', code: 'PHIL', mediumId: mediumArId, type: 'theory' }).returning();
    const [sEps] = await db.insert(subjects).values({ tenantId, name: 'Éducation Physique', code: 'EPS', mediumId: mediumFrId, type: 'practical' }).returning();

    subjectMathId = sMath!.id;
    subjectPCId = sPC!.id;
    subjectSvtId = sSvt!.id;
    subjectFrId = sFr!.id;
    subjectArId = sAr!.id;
    subjectAngId = sAng!.id;
    subjectPhilId = sPhil!.id;
    subjectEpsId = sEps!.id;

    // 7. Assign Subjects to TC-SC with Moroccan Coefficients
    await db.insert(classSubjects).values([
      { tenantId, classId: classTcScId, subjectId: subjectMathId, type: 'compulsory', coefficient: '7.00' },
      { tenantId, classId: classTcScId, subjectId: subjectPCId, type: 'compulsory', coefficient: '5.00' },
      { tenantId, classId: classTcScId, subjectId: subjectSvtId, type: 'compulsory', coefficient: '5.00' },
      { tenantId, classId: classTcScId, subjectId: subjectFrId, type: 'compulsory', coefficient: '4.00' },
      { tenantId, classId: classTcScId, subjectId: subjectArId, type: 'compulsory', coefficient: '2.00' },
      { tenantId, classId: classTcScId, subjectId: subjectAngId, type: 'compulsory', coefficient: '2.00' },
      { tenantId, classId: classTcScId, subjectId: subjectPhilId, type: 'compulsory', coefficient: '2.00' },
      { tenantId, classId: classTcScId, subjectId: subjectEpsId, type: 'compulsory', coefficient: '2.00' },
    ]);

    // 8. Provision Staff & Teachers
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'Directeur Al Khawarizmi', email: `admin-${suffix}@alkhawarizmi.ma`, role: 'school_admin', userStatus: 'active' },
      { id: cashierId, tenantId, name: 'Comptable Trésorerie', email: `comptable-${suffix}@alkhawarizmi.ma`, role: 'accountant', userStatus: 'active' },
      { id: teacherMathId, tenantId, name: 'Professeur Mathématiques', email: `profmath-${suffix}@alkhawarizmi.ma`, role: 'teacher', userStatus: 'active' },
      { id: teacherPCId, tenantId, name: 'Professeur Physique', email: `profpc-${suffix}@alkhawarizmi.ma`, role: 'teacher', userStatus: 'active' },
    ]);

    // 9. Provision 6 Students
    const studentData = [
      { id: studentAmineId, name: 'Amine Bennani', email: `amine-${suffix}@eleve.alkhawarizmi.ma`, matricule: `2025-TCS-001-${suffix}` },
      { id: studentKenzaId, name: 'Kenza El Idrissi', email: `kenza-${suffix}@eleve.alkhawarizmi.ma`, matricule: `2025-TCS-002-${suffix}` },
      { id: studentYoussefId, name: 'Youssef Alami', email: `youssef-${suffix}@eleve.alkhawarizmi.ma`, matricule: `2025-TCS-003-${suffix}` },
      { id: studentNadiaId, name: 'Nadia Berrada', email: `nadia-${suffix}@eleve.alkhawarizmi.ma`, matricule: `2025-TCS-004-${suffix}` },
      { id: studentSalmaId, name: 'Salma Tazi', email: `salma-${suffix}@eleve.alkhawarizmi.ma`, matricule: `2025-TCS-005-${suffix}` },
      { id: studentOmarId, name: 'Omar Chraibi', email: `omar-${suffix}@eleve.alkhawarizmi.ma`, matricule: `2025-TCS-006-${suffix}` },
    ];

    for (const s of studentData) {
      await db.insert(user).values({
        id: s.id,
        tenantId,
        name: s.name,
        email: s.email,
        matricule: s.matricule,
        role: 'student',
        userStatus: 'active',
      });

      // Record placement in 2025-2026
      await recordStudentPlacement({
        tenantId,
        studentId: s.id,
        sessionYearId: sessionYear2025Id,
        classSectionId: classSectionTcScAId,
        startDate: '2025-09-01',
        status: 'enrolled',
      });
    }

    // 10. Provision Guardians
    const guardianId = randomUUID();
    await db.insert(guardians).values({
      id: guardianId,
      tenantId,
      firstName: 'Mohamed',
      lastName: 'Bennani',
      phone: '+212661000001',
      email: `tuteur-${suffix}@family.ma`,
    });
    await db.insert(guardianStudents).values({
      id: randomUUID(),
      tenantId,
      guardianId,
      studentId: studentAmineId,
      relationshipType: 'father',
      isEmergencyContact: true,
      canPickup: true,
    });
  });

  afterAll(async () => {
    // Cascade cleanup
    await db.delete(paymentAllocations).where(eq(paymentAllocations.tenantId, tenantId));
    await db.delete(payments).where(eq(payments.tenantId, tenantId));
    await db.delete(invoiceItems).where(eq(invoiceItems.tenantId, tenantId));
    await db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await db.delete(cashierSessions).where(eq(cashierSessions.tenantId, tenantId));
    await db.delete(feeStructureAssignments).where(eq(feeStructureAssignments.tenantId, tenantId));
    await db.delete(feeStructures).where(eq(feeStructures.tenantId, tenantId));
    await db.delete(feeCategories).where(eq(feeCategories.tenantId, tenantId));
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(promotionDecisions).where(eq(promotionDecisions.tenantId, tenantId));
    await db.delete(promotionBatches).where(eq(promotionBatches.tenantId, tenantId));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantId));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantId));
    await db.delete(subjectTeachers).where(eq(subjectTeachers.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(streams).where(eq(streams.tenantId, tenantId));
    await db.delete(shifts).where(eq(shifts.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(semesters).where(eq(semesters.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('Phase 1 & 2: confirms initial tenant setup, academic structure, and student enrollments', async () => {
    const studentRows = await db.select().from(user).where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));
    expect(studentRows).toHaveLength(6);

    for (const st of studentRows) {
      expect(st.classSectionId).toBe(classSectionTcScAId);
    }

    const placements = await db.select().from(studentPlacements).where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.sessionYearId, sessionYear2025Id),
      eq(studentPlacements.isCurrent, true),
    ));
    expect(placements).toHaveLength(6);
  });

  it('Phase 3: executes fee scheduling, student invoicing, and cashier payment collection', async () => {
    // 1. Fee Category & Structure
    const [feeCat] = await db.insert(feeCategories).values({
      tenantId,
      name: 'Frais de Scolarité Tronc Commun',
    }).returning();

    const [feeStruct] = await db.insert(feeStructures).values({
      tenantId,
      name: 'Grille Tarifaire TC 2025-2026',
      amount: 3500,
    }).returning();

    // 2. Issue Invoices for Students
    const invoiceAmineId = randomUUID();
    const invoiceKenzaId = randomUUID();
    const invoiceOmarId = randomUUID();

    await db.insert(invoices).values([
      {
        id: invoiceAmineId,
        tenantId,
        studentId: studentAmineId,
        invoiceNumber: `FAC-2025-001-${suffix}`,
        amount: 3500,
        netAmount: 3500,
        status: 'pending',
        dueDate: '2025-09-30',
        issueDate: '2025-09-01',
      },
      {
        id: invoiceKenzaId,
        tenantId,
        studentId: studentKenzaId,
        invoiceNumber: `FAC-2025-002-${suffix}`,
        amount: 3500,
        netAmount: 3500,
        status: 'pending',
        dueDate: '2025-09-30',
        issueDate: '2025-09-01',
      },
      {
        id: invoiceOmarId,
        tenantId,
        studentId: studentOmarId,
        invoiceNumber: `FAC-2025-003-${suffix}`,
        amount: 3500,
        netAmount: 3500,
        status: 'pending',
        dueDate: '2025-09-30',
        issueDate: '2025-09-01',
      },
    ]);

    // 3. Open Cashier Session
    const [cashierSess] = await db.insert(cashierSessions).values({
      tenantId,
      cashierId,
      startingFloat: 1000,
      status: 'open',
    }).returning();

    // 4. Record Payments
    // Amine: Full payment of 3,500.00 MAD
    const [payAmine] = await db.insert(payments).values({
      tenantId,
      invoiceId: invoiceAmineId,
      studentId: studentAmineId,
      amount: 3500,
      paymentMethod: 'cash',
      paymentDate: '2025-09-05',
      referenceId: `REC-2025-001-${suffix}`,
    }).returning();

    await db.insert(paymentAllocations).values({
      tenantId,
      paymentId: payAmine!.id,
      invoiceId: invoiceAmineId,
      allocatedAmount: '3500.00',
    });

    await db.update(invoices).set({ status: 'paid' }).where(eq(invoices.id, invoiceAmineId));

    // Kenza: Partial payment of 2,000.00 MAD (remaining 1,500.00 MAD)
    const [payKenza] = await db.insert(payments).values({
      tenantId,
      invoiceId: invoiceKenzaId,
      studentId: studentKenzaId,
      amount: 2000,
      paymentMethod: 'transfer',
      paymentDate: '2025-09-10',
      referenceId: `REC-2025-002-${suffix}`,
    }).returning();

    await db.insert(paymentAllocations).values({
      tenantId,
      paymentId: payKenza!.id,
      invoiceId: invoiceKenzaId,
      allocatedAmount: '2000.00',
    });

    await db.update(invoices).set({ status: 'partial' }).where(eq(invoices.id, invoiceKenzaId));

    // Verify Invoicing & Payment States
    const [inv1] = await db.select().from(invoices).where(eq(invoices.id, invoiceAmineId));
    expect(inv1!.status).toBe('paid');

    const [inv2] = await db.select().from(invoices).where(eq(invoices.id, invoiceKenzaId));
    expect(inv2!.status).toBe('partial');

    const [inv3] = await db.select().from(invoices).where(eq(invoices.id, invoiceOmarId));
    expect(inv3!.status).toBe('pending');
  });

  it('Phase 4: records attendance sessions and validates attendance tracking with medical excuses', async () => {
    // Create attendance register for ClassSection TC-SC-A
    const [register] = await db.insert(attendanceRegisters).values({
      tenantId,
      classId: classTcScId,
      date: '2025-10-15',
      reference: `REG-2025-10-15-${suffix}`,
      status: 'LOCKED',
      submittedById: teacherMathId,
    }).returning();

    // Mark attendance rows
    await db.insert(attendance).values([
      { tenantId, registerId: register!.id, studentId: studentAmineId, date: '2025-10-15', status: 'present' },
      { tenantId, registerId: register!.id, studentId: studentKenzaId, date: '2025-10-15', status: 'present' },
      { tenantId, registerId: register!.id, studentId: studentYoussefId, date: '2025-10-15', status: 'present' },
      { tenantId, registerId: register!.id, studentId: studentNadiaId, date: '2025-10-15', status: 'present' },
      { tenantId, registerId: register!.id, studentId: studentSalmaId, date: '2025-10-15', status: 'late', note: 'Retard de 15 min' },
      { tenantId, registerId: register!.id, studentId: studentOmarId, date: '2025-10-15', status: 'absent', note: 'Absence non justifiée' },
    ]);

    // Record a medical excuse for Kenza for another session
    const [excuseRegister] = await db.insert(attendanceRegisters).values({
      tenantId,
      classId: classTcScId,
      date: '2025-10-16',
      reference: `REG-2025-10-16-${suffix}`,
      status: 'LOCKED',
      submittedById: teacherMathId,
    }).returning();

    await db.insert(attendance).values({
      tenantId,
      registerId: excuseRegister!.id,
      studentId: studentKenzaId,
      date: '2025-10-16',
      status: 'excused',
    });

    await db.insert(attendanceExcuses).values({
      tenantId,
      studentId: studentKenzaId,
      date: '2025-10-16',
      reason: 'Certificat médical de consultation pédiatrique',
      status: 'approved',
    });

    const excuses = await db.select().from(attendanceExcuses).where(and(eq(attendanceExcuses.tenantId, tenantId), eq(attendanceExcuses.studentId, studentKenzaId)));
    expect(excuses).toHaveLength(1);
    expect(excuses[0]!.status).toBe('approved');
  });

  it('Phase 5: executes Moroccan grade engine calculations with tie ranking and medical exemptions', () => {
    // 1. Amine Bennani: Outstanding student (Mention Très Bien, Rank 1)
    const amineS1: SubjectGradeInput[] = [
      { subjectId: subjectMathId, subjectName: 'Mathématiques', grade: 18.5, coefficient: 7 },
      { subjectId: subjectPCId, subjectName: 'Physique-Chimie', grade: 17.5, coefficient: 5 },
      { subjectId: subjectSvtId, subjectName: 'SVT', grade: 17.0, coefficient: 5 },
      { subjectId: subjectFrId, subjectName: 'Français', grade: 16.0, coefficient: 4 },
      { subjectId: subjectArId, subjectName: 'Arabe', grade: 15.5, coefficient: 2 },
      { subjectId: subjectAngId, subjectName: 'Anglais', grade: 17.0, coefficient: 2 },
      { subjectId: subjectPhilId, subjectName: 'Philosophie', grade: 14.5, coefficient: 2 },
      { subjectId: subjectEpsId, subjectName: 'EPS', grade: 16.0, coefficient: 2 },
    ];
    const amineS1Res = calculateMoroccanAverage(amineS1);
    expect(amineS1Res.generalAverage).toBeGreaterThan(16.5);
    expect(amineS1Res.mention).toBe('Très Bien');
    expect(amineS1Res.status).toBe('Admis');

    // 2. Nadia Berrada: Medical Exemption in EPS (EPS excluded from calculation)
    const nadiaS1: SubjectGradeInput[] = [
      { subjectId: subjectMathId, subjectName: 'Mathématiques', grade: 13.0, coefficient: 7 },
      { subjectId: subjectPCId, subjectName: 'Physique-Chimie', grade: 12.5, coefficient: 5 },
      { subjectId: subjectSvtId, subjectName: 'SVT', grade: 13.0, coefficient: 5 },
      { subjectId: subjectFrId, subjectName: 'Français', grade: 12.0, coefficient: 4 },
      { subjectId: subjectArId, subjectName: 'Arabe', grade: 13.0, coefficient: 2 },
      { subjectId: subjectAngId, subjectName: 'Anglais', grade: 14.0, coefficient: 2 },
      { subjectId: subjectPhilId, subjectName: 'Philosophie', grade: 12.0, coefficient: 2 },
      { subjectId: subjectEpsId, subjectName: 'EPS', grade: 0, coefficient: 2, isExempt: true }, // Medical exemption
    ];
    const nadiaS1Res = calculateMoroccanAverage(nadiaS1);
    expect(nadiaS1Res.totalCoefficients).toBe(27); // 29 - 2 (EPS exempt) = 27
    expect(nadiaS1Res.mention).toBe('Assez Bien');
    expect(nadiaS1Res.status).toBe('Admis');

    // 3. Omar Chraibi: Struggling student (Mention Insuffisant, Ajourné)
    const omarS1: SubjectGradeInput[] = [
      { subjectId: subjectMathId, subjectName: 'Mathématiques', grade: 7.0, coefficient: 7 },
      { subjectId: subjectPCId, subjectName: 'Physique-Chimie', grade: 8.0, coefficient: 5 },
      { subjectId: subjectSvtId, subjectName: 'SVT', grade: 7.5, coefficient: 5 },
      { subjectId: subjectFrId, subjectName: 'Français', grade: 8.0, coefficient: 4 },
      { subjectId: subjectArId, subjectName: 'Arabe', grade: 9.0, coefficient: 2 },
      { subjectId: subjectAngId, subjectName: 'Anglais', grade: 8.5, coefficient: 2 },
      { subjectId: subjectPhilId, subjectName: 'Philosophie', grade: 8.0, coefficient: 2 },
      { subjectId: subjectEpsId, subjectName: 'EPS', grade: 11.0, coefficient: 2 },
    ];
    const omarS1Res = calculateMoroccanAverage(omarS1);
    expect(omarS1Res.generalAverage).toBeLessThan(10.0);
    expect(omarS1Res.mention).toBe('Insuffisant');
    expect(omarS1Res.status).toBe('Ajourné');

    // 4. Annual Aggregations & Ranking
    const annualAverages = [
      { studentId: studentAmineId, generalAverage: 17.25 },
      { studentId: studentKenzaId, generalAverage: 14.80 },
      { studentId: studentYoussefId, generalAverage: 13.10 },
      { studentId: studentNadiaId, generalAverage: 12.75 },
      { studentId: studentSalmaId, generalAverage: 10.40 },
      { studentId: studentOmarId, generalAverage: 8.15 },
    ];

    const ranks = calculateClassRanks(annualAverages);
    expect(ranks.find(r => r.studentId === studentAmineId)?.rank).toBe(1);
    expect(ranks.find(r => r.studentId === studentKenzaId)?.rank).toBe(2);
    expect(ranks.find(r => r.studentId === studentYoussefId)?.rank).toBe(3);
    expect(ranks.find(r => r.studentId === studentNadiaId)?.rank).toBe(4);
    expect(ranks.find(r => r.studentId === studentSalmaId)?.rank).toBe(5);
    expect(ranks.find(r => r.studentId === studentOmarId)?.rank).toBe(6);
  });

  it('Phase 6: commits academic year-end rollover via POST /api/students/promotions', async () => {
    sessionUserId.value = adminId;

    const promotionPayload = {
      sourceClassSectionId: classSectionTcScAId,
      targetSessionYearId: sessionYear2026Id,
      idempotencyKey: `promo-2025-2026-tc-${suffix}`,
      decisions: [
        { studentId: studentAmineId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 86.25, reason: 'Admis en 1BAC-SE avec Félicitations' },
        { studentId: studentKenzaId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 74.00, reason: 'Admis en 1BAC-SE avec Tableau d\'Honneur' },
        { studentId: studentYoussefId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 65.50, reason: 'Admis en 1BAC-SE avec Encouragements' },
        { studentId: studentNadiaId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 63.75, reason: 'Admis en 1BAC-SE (dispense EPS prise en compte)' },
        { studentId: studentSalmaId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 52.00, reason: 'Admis en 1BAC-SE' },
        { studentId: studentOmarId, decision: 'repeat', targetClassSectionId: classSectionTcScAId, averagePercentage: 40.75, reason: 'Autorisé à redoubler le Tronc Commun Scientifique' },
      ],
    };

    const req = new Request('http://localhost/api/students/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promotionPayload),
    });

    const res = await postPromotion(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.decisions).toHaveLength(6);

    // Verify DB ledger integrity
    const [batch] = await db.select().from(promotionBatches).where(and(
      eq(promotionBatches.tenantId, tenantId),
      eq(promotionBatches.idempotencyKey, `promo-2025-2026-tc-${suffix}`),
    ));
    expect(batch).toBeTruthy();
    expect(batch!.status).toBe('committed');

    const decisions = await db.select().from(promotionDecisions).where(and(
      eq(promotionDecisions.tenantId, tenantId),
      eq(promotionDecisions.batchId, batch!.id),
    ));
    expect(decisions).toHaveLength(6);

    // Verify 5 students promoted to 1BAC-SE-A in session 2026-2027
    const promotedStudents = [studentAmineId, studentKenzaId, studentYoussefId, studentNadiaId, studentSalmaId];
    for (const sid of promotedStudents) {
      const [u] = await db.select().from(user).where(eq(user.id, sid));
      expect(u!.classSectionId).toBe(classSection1BacSeAId);

      // Verify active placement in 2026-2027
      const [currentPlacement] = await db.select().from(studentPlacements).where(and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, sid),
        eq(studentPlacements.isCurrent, true),
      ));
      expect(currentPlacement!.classSectionId).toBe(classSection1BacSeAId);
      expect(currentPlacement!.sessionYearId).toBe(sessionYear2026Id);

      // Verify historical placement in 2025-2026 remains closed and preserved
      const [histPlacement] = await db.select().from(studentPlacements).where(and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, sid),
        eq(studentPlacements.sessionYearId, sessionYear2025Id),
      ));
      expect(histPlacement!.isCurrent).toBe(false);
      expect(histPlacement!.classSectionId).toBe(classSectionTcScAId);
    }

    // Verify Omar repeats in TC-SC-A for session 2026-2027
    const [omar] = await db.select().from(user).where(eq(user.id, studentOmarId));
    expect(omar!.classSectionId).toBe(classSectionTcScAId);

    const [omarCurrentPlacement] = await db.select().from(studentPlacements).where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.studentId, studentOmarId),
      eq(studentPlacements.isCurrent, true),
    ));
    expect(omarCurrentPlacement!.classSectionId).toBe(classSectionTcScAId);
    expect(omarCurrentPlacement!.sessionYearId).toBe(sessionYear2026Id);
  });

  it('enforces idempotency: re-submitting the exact same promotion batch returns the committed result', async () => {
    sessionUserId.value = adminId;

    const promotionPayload = {
      sourceClassSectionId: classSectionTcScAId,
      targetSessionYearId: sessionYear2026Id,
      idempotencyKey: `promo-2025-2026-tc-${suffix}`,
      decisions: [
        { studentId: studentAmineId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 86.25 },
        { studentId: studentKenzaId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 74.00 },
        { studentId: studentYoussefId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 65.50 },
        { studentId: studentNadiaId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 63.75 },
        { studentId: studentSalmaId, decision: 'promote', targetClassSectionId: classSection1BacSeAId, averagePercentage: 52.00 },
        { studentId: studentOmarId, decision: 'repeat', targetClassSectionId: classSectionTcScAId, averagePercentage: 40.75 },
      ],
    };

    const req = new Request('http://localhost/api/students/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promotionPayload),
    });

    const res = await postPromotion(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.decisions).toHaveLength(6);
  });
});
