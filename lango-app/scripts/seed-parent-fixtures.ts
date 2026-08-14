import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { and, eq, like } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '../src/libs/DB';
import {
  account,
  announcements,
  attendance,
  attendanceExcuses,
  attendanceSummary,
  classSections,
  guardians,
  guardianStudents,
  invoices,
  meetingSlots,
  parentGuardianLinkTokens,
  payments,
  session,
  smsMessages,
  studentDocuments,
  user,
} from '../src/models/Schema';
import {
  assessmentDefinitions,
  assessmentOutcomes,
  homeworkDetails,
  homeworkAttempts,
} from '../src/features/assessment/models/assessment-schema';

// Parent Portal verification fixtures. Idempotent: clears its own PRN- rows
// first, then creates parents/guardians/children/relationships covering every
// effective-state and rights case the security sweep exercises.
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const PASS = 'ParentAdmin123!';
const future = new Date(Date.now() + 90 * 86400000).toISOString();
const past = new Date(Date.now() - 90 * 86400000).toISOString();

async function cleanup() {
  // Order matters: guardians.userId and account.userId FKs have no ON DELETE
  // CASCADE, so delete link tokens, guardians (cascade guardian_students +
  // tokens), then accounts, then the PRN- users they reference.
  // Assessment rows: delete outcomes by PRN student first, then the
  // PRN-SEED-created definitions (cascade removes details/attempts/audiences).
  await db.delete(assessmentOutcomes).where(like(assessmentOutcomes.studentId, 'PRN-%'));
  await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.createdBy, 'PRN-SEED'));
  await db.delete(attendanceExcuses).where(like(attendanceExcuses.studentId, 'PRN-%'));
  await db.delete(attendanceSummary).where(like(attendanceSummary.studentId, 'PRN-%'));
  await db.delete(attendance).where(like(attendance.studentId, 'PRN-%'));
  // Finance + communication + meetings + documents fixtures (createdBy/teacherId
  // are text FKs to user.id; explicit deletes before the PRN- user delete).
  await db.delete(announcements).where(eq(announcements.createdById, 'PRN-TEACHER'));
  await db.delete(meetingSlots).where(eq(meetingSlots.teacherId, 'PRN-TEACHER'));
  await db.delete(smsMessages).where(like(smsMessages.studentId, 'PRN-%'));
  await db.delete(studentDocuments).where(like(studentDocuments.studentId, 'PRN-%'));
  await db.delete(payments).where(like(payments.studentId, 'PRN-%'));
  await db.delete(invoices).where(like(invoices.studentId, 'PRN-%'));
  await db.delete(parentGuardianLinkTokens).where(eq(parentGuardianLinkTokens.createdBy, 'PRN-SEED'));
  await db.delete(guardians).where(like(guardians.email, 'prn-%@placeholder.local'));
  await db.delete(session).where(like(session.userId, 'PRN-%'));
  await db.delete(account).where(like(account.userId, 'PRN-%'));
  await db.delete(user).where(like(user.id, 'PRN-%'));
}

async function makeUser(id: string, tenantId: string, role: 'student' | 'parent' | 'teacher', name: string, extra: { matricule?: string; className?: string; level?: string; classSectionId?: string | null } = {}) {
  const now = new Date();
  await db.insert(user).values({
    id,
    tenantId,
    role,
    name,
    email: `prn-${id.toLowerCase()}@placeholder.local`,
    userStatus: 'active',
    matricule: extra.matricule ?? null,
    className: extra.className ?? null,
    level: extra.level ?? null,
    classSectionId: extra.classSectionId ?? null,
  });
  await db.insert(account).values({
    id: `credential-${id.toLowerCase()}`,
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hashPassword(PASS),
    createdAt: now,
    updatedAt: now,
  });
}

async function makeGuardian(tenantId: string, userId: string | null, email: string, firstName = 'Verif', lastName = 'Parent'): Promise<string> {
  const [row] = await db
    .insert(guardians)
    .values({ tenantId, userId, firstName, lastName, email, phone: '+212600000000' })
    .returning({ id: guardians.id });
  return row!.id;
}

type LinkOpts = {
  status?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  finance?: boolean;
  academic?: boolean;
  attendance?: boolean;
  medical?: boolean;
  communication?: boolean;
  pickup?: boolean;
  financiallyResponsible?: boolean;
  custody?: string | null;
  sensitive?: boolean;
  primary?: boolean;
};

async function link(tenantId: string, guardianId: string, studentId: string, opts: LinkOpts = {}) {
  await db.insert(guardianStudents).values({
    tenantId,
    guardianId,
    studentId,
    relationshipType: 'Parent',
    isPrimaryContact: opts.primary ?? false,
    isEmergencyContact: false,
    canPickup: false,
    status: opts.status ?? 'active',
    effectiveFrom: opts.effectiveFrom ?? null,
    effectiveTo: opts.effectiveTo ?? null,
    canAccessFinance: opts.finance ?? true,
    canAccessAcademic: opts.academic ?? true,
    canAccessAttendance: opts.attendance ?? true,
    canAccessMedical: opts.medical ?? true,
    canAccessCommunication: opts.communication ?? true,
    hasPickupAuthority: opts.pickup ?? false,
    isFinanciallyResponsible: opts.financiallyResponsible ?? true,
    custodyRestriction: opts.custody ?? null,
    sensitiveContactHidden: opts.sensitive ?? false,
  });
}

async function main() {
  await cleanup();

  // --- Children (Atlas) ---
  await makeUser('PRN-CHILD-A', ATLAS, 'student', 'Vrf Child A', { matricule: 'PRN-001', className: 'CE1', level: 'CE1' });
  await makeUser('PRN-CHILD-B', ATLAS, 'student', 'Vrf Child B', { matricule: 'PRN-002', className: 'CE1', level: 'CE1' });
  await makeUser('PRN-CHILD-C', ATLAS, 'student', 'Vrf Child C', { matricule: 'PRN-003', className: 'CM1', level: 'CM1' });
  await makeUser('PRN-CHILD-D', ATLAS, 'student', 'Vrf Child D', { matricule: 'PRN-004', className: 'CM2', level: 'CM2' });
  await makeUser('PRN-CHILD-EXP', ATLAS, 'student', 'Vrf Child Exp', { matricule: 'PRN-005', className: 'CE2', level: 'CE2' });
  await makeUser('PRN-CHILD-FUT', ATLAS, 'student', 'Vrf Child Fut', { matricule: 'PRN-006', className: 'CE2', level: 'CE2' });
  await makeUser('PRN-CHILD-FIN', ATLAS, 'student', 'Vrf Child Fin', { matricule: 'PRN-007', className: 'CM1', level: 'CM1' });
  await makeUser('PRN-CHILD-CUST', ATLAS, 'student', 'Vrf Child Cust', { matricule: 'PRN-008', className: 'CM2', level: 'CM2' });
  await makeUser('PRN-CHILD-SUSP', ATLAS, 'student', 'Vrf Child Susp', { matricule: 'PRN-009', className: 'CE1', level: 'CE1' });
  // Rights-withheld children for the per-right denial tests.
  await makeUser('PRN-CHILD-ATD', ATLAS, 'student', 'Vrf Child Atd', { matricule: 'PRN-010', className: 'CE1', level: 'CE1' });
  await makeUser('PRN-CHILD-MED', ATLAS, 'student', 'Vrf Child Med', { matricule: 'PRN-011', className: 'CE1', level: 'CE1' });
  await makeUser('PRN-CHILD-COM', ATLAS, 'student', 'Vrf Child Com', { matricule: 'PRN-012', className: 'CM1', level: 'CM1' });
  // Host teacher for meeting slots (teacherId FK → user.id).
  await makeUser('PRN-TEACHER', ATLAS, 'teacher', 'Vrf Teacher');
  // Child in Lango for cross-tenant probes
  await makeUser('PRN-CHILD-LANGO', LANGO, 'student', 'Vrf Lango Child', { matricule: 'PRN-LANGO-01', className: 'CE1', level: 'CE1' });

  // --- Parents + guardians ---
  await makeUser('PRN-PARENT-A', ATLAS, 'parent', 'Vrf Parent A');
  await makeUser('PRN-PARENT-B', ATLAS, 'parent', 'Vrf Parent B');
  await makeUser('PRN-PARENT-C', LANGO, 'parent', 'Vrf Parent C Lango');
  await makeUser('PRN-PARENT-UNLINKED', ATLAS, 'parent', 'Vrf Parent Unlinked');

  const gA = await makeGuardian(ATLAS, 'PRN-PARENT-A', 'prn-guard-a@placeholder.local');
  const gB = await makeGuardian(ATLAS, 'PRN-PARENT-B', 'prn-guard-b@placeholder.local');
  const gC = await makeGuardian(LANGO, 'PRN-PARENT-C', 'prn-guard-c@placeholder.local');
  const gU = await makeGuardian(ATLAS, null, 'prn-guard-unlinked@placeholder.local');

  // --- Relationships ---
  await link(ATLAS, gA, 'PRN-CHILD-A', { primary: true });                          // full rights
  await link(ATLAS, gA, 'PRN-CHILD-B', { finance: false });                         // finance withheld
  await link(ATLAS, gA, 'PRN-CHILD-C', { status: 'revoked' });                      // revoked
  await link(ATLAS, gA, 'PRN-CHILD-EXP', { effectiveTo: past });                    // expired
  await link(ATLAS, gA, 'PRN-CHILD-FUT', { effectiveFrom: future });                // not yet effective
  await link(ATLAS, gA, 'PRN-CHILD-FIN', { financiallyResponsible: false });        // not financially responsible
  await link(ATLAS, gA, 'PRN-CHILD-CUST', { custody: 'non-custodial', sensitive: true }); // custody restricted
  await link(ATLAS, gA, 'PRN-CHILD-SUSP', { status: 'suspended' });                 // suspended
  await link(ATLAS, gA, 'PRN-CHILD-ATD', { attendance: false });                    // attendance right withheld
  await link(ATLAS, gA, 'PRN-CHILD-MED', { medical: false });                       // medical right withheld
  await link(ATLAS, gA, 'PRN-CHILD-COM', { communication: false });                 // communication right withheld

  // Guardian B: co-guardian on CHILD-A (with finance withheld) + exclusive on CHILD-D
  await link(ATLAS, gB, 'PRN-CHILD-A', { finance: false });
  await link(ATLAS, gB, 'PRN-CHILD-D', { primary: true });

  // Guardian C (Lango): linked to Lango child
  await link(LANGO, gC, 'PRN-CHILD-LANGO');

  // Guardian UNLINKED: has a link but no bound account yet (link/accept target)
  await link(ATLAS, gU, 'PRN-CHILD-B', { finance: false });

  // --- Class sections: pin CHILD-A and CHILD-B to two distinct live Atlas
  // --- class_sections so the announcement class-scope leak is testable.
  const sectionRows = await db
    .select({ id: classSections.id })
    .from(classSections)
    .where(eq(classSections.tenantId, ATLAS))
    .limit(2);
  const secA = sectionRows[0]?.id;
  const secB = sectionRows[1]?.id ?? sectionRows[0]?.id;
  if (secA) {
    await db.update(user).set({ classSectionId: secA }).where(eq(user.id, 'PRN-CHILD-A'));
  }
  if (secB) {
    await db.update(user).set({ classSectionId: secB }).where(eq(user.id, 'PRN-CHILD-B'));
  }

  // --- Announcements: one per pinned section + one tenant-wide parent notice.
  const nowIso = new Date().toISOString();
  if (secA) {
    await db.insert(announcements).values({
      tenantId: ATLAS,
      title: 'PRN Annonce Classe A',
      body: 'Annonce ciblée classe A (fixture).',
      targetRole: 'parent',
      targetClassSectionId: secA,
      createdById: 'PRN-TEACHER',
      publishedAt: nowIso,
    });
  }
  if (secB) {
    await db.insert(announcements).values({
      tenantId: ATLAS,
      title: 'PRN Annonce Classe B',
      body: 'Annonce ciblée classe B (fixture).',
      targetRole: 'parent',
      targetClassSectionId: secB,
      createdById: 'PRN-TEACHER',
      publishedAt: nowIso,
    });
  }
  await db.insert(announcements).values({
    tenantId: ATLAS,
    title: 'PRN Annonce Tous Parents',
    body: 'Annonce tous parents (fixture).',
    targetRole: 'parent',
    targetClassSectionId: null,
    createdById: 'PRN-TEACHER',
    publishedAt: nowIso,
  });

  // --- Finance fixtures for CHILD-A: one paid invoice + one unpaid (net 800),
  // --- so the amounts-match assert is deterministic (outstanding === 800).
  {
    const [paid] = await db
      .insert(invoices)
      .values({
        tenantId: ATLAS,
        studentId: 'PRN-CHILD-A',
        invoiceNumber: 'PRN-INV-0001',
        amount: 1200,
        discountAmount: 0,
        netAmount: 1200,
        paidAmount: 1200,
        status: 'paid',
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      })
      .returning({ id: invoices.id });
    await db.insert(payments).values({
      tenantId: ATLAS,
      invoiceId: paid!.id,
      studentId: 'PRN-CHILD-A',
      amount: 1200,
      paymentMethod: 'cash',
      paymentDate: nowIso,
    });
    await db.insert(invoices).values({
      tenantId: ATLAS,
      studentId: 'PRN-CHILD-A',
      invoiceNumber: 'PRN-INV-0002',
      amount: 800,
      discountAmount: 0,
      netAmount: 800,
      paidAmount: 0,
      status: 'pending',
      dueDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
    });
  }

  // --- Meeting slot (open) hosted by the PRN teacher, for the meetings list.
  await db.insert(meetingSlots).values({
    tenantId: ATLAS,
    teacherId: 'PRN-TEACHER',
    startTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    endTime: new Date(Date.now() + 2 * 86400000 + 3600_000).toISOString(),
    status: 'open',
  });

  // --- School documents for CHILD-A (birth certificate + bulletin).
  await db.insert(studentDocuments).values({
    tenantId: ATLAS,
    studentId: 'PRN-CHILD-A',
    documentType: 'birth_certificate',
    fileExt: 'pdf',
  });
  await db.insert(studentDocuments).values({
    tenantId: ATLAS,
    studentId: 'PRN-CHILD-A',
    documentType: 'bulletin',
    fileExt: 'pdf',
  });

  // --- Communication history for CHILD-A (one sms message).
  await db.insert(smsMessages).values({
    tenantId: ATLAS,
    recipientPhone: '+212600000001',
    studentId: 'PRN-CHILD-A',
    body: 'PRN message parent (fixture).',
    status: 'sent',
    sentAt: nowIso,
    createdById: 'PRN-TEACHER',
  });

  // --- Academic fixtures (results + homework) to exercise the published-only
  // --- gate and audience-matched homework. Definitions are keyed to PRN-SEED
  // --- so cleanup can remove them idempotently.
  async function makeAssessment(tenantId: string, studentId: string, type: string, title: string, moderationState: string, status: string) {
    const [def] = await db
      .insert(assessmentDefinitions)
      .values({
        tenantId,
        type,
        title,
        maximumScore: '20.00',
        coefficient: '1.00',
        status: 'published',
        createdBy: 'PRN-SEED',
      })
      .returning({ id: assessmentDefinitions.id });
    const defId = def!.id;
    await db.insert(assessmentOutcomes).values({
      tenantId,
      assessmentDefinitionId: defId,
      studentId,
      rawScore: '14.50',
      maximumScoreSnapshot: '20.00',
      normalizedScore: '14.50',
      grade: type === 'paper_exam' ? 'B' : '14.5/20',
      status,
      sourceType: 'paper_exam',
      moderationState,
    });
    return defId;
  }

  // Published + graded result for CHILD-A (must appear), draft for CHILD-A (must NOT).
  await makeAssessment(ATLAS, 'PRN-CHILD-A', 'paper_exam', 'PRN-Vérif Maths CE1', 'published', 'graded');
  await makeAssessment(ATLAS, 'PRN-CHILD-A', 'paper_exam', 'PRN-Vérif Français (brouillon)', 'draft', 'pending');
  await makeAssessment(ATLAS, 'PRN-CHILD-FIN', 'paper_exam', 'PRN-Vérif Sciences CM1', 'published', 'graded');

  // --- Attendance fixtures: authoritative summary + rows + excuses ---
  await db.insert(attendanceSummary).values({
    tenantId: ATLAS,
    studentId: 'PRN-CHILD-A',
    totalPresent: 18,
    totalAbsent: 2,
    totalLate: 1,
    totalExcused: 0,
    totalSessions: 21,
    attendanceRate: '95.24',
  });
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  await db.insert(attendance).values({ tenantId: ATLAS, studentId: 'PRN-CHILD-A', date: daysAgo(0), status: 'present', period: 1 });
  await db.insert(attendance).values({ tenantId: ATLAS, studentId: 'PRN-CHILD-A', date: daysAgo(2), status: 'absent', period: 1, note: 'Absence signalée par l\'enseignant.' });
  await db.insert(attendance).values({ tenantId: ATLAS, studentId: 'PRN-CHILD-A', date: daysAgo(5), status: 'late', period: 1, lateMinutes: 12 });
  await db.insert(attendanceExcuses).values({
    tenantId: ATLAS,
    studentId: 'PRN-CHILD-A',
    date: daysAgo(6),
    reason: 'Rendez-vous médical (fixture)',
    status: 'approved',
    reviewedAt: new Date().toISOString(),
  });
  await db.insert(attendanceExcuses).values({
    tenantId: ATLAS,
    studentId: 'PRN-CHILD-B',
    date: daysAgo(1),
    reason: 'Famille — demande en attente (fixture)',
    status: 'pending',
  });

  // Published homework for CHILD-A (broadcast audience → visible to all) + graded attempt.
  {
    const [hw] = await db
      .insert(assessmentDefinitions)
      .values({
        tenantId: ATLAS,
        type: 'homework',
        title: 'PRN-Devoir Maths n°1',
        description: 'Exercices page 12',
        maximumScore: '20.00',
        coefficient: '1.00',
        status: 'published',
        createdBy: 'PRN-SEED',
      })
      .returning({ id: assessmentDefinitions.id });
    const hwId = hw!.id;
    await db.insert(homeworkDetails).values({
      assessmentDefinitionId: hwId,
      instructions: 'Faire les exercices 1 à 5.',
      allowAttachments: true,
      maxAttachments: 3,
      lateSubmissionPolicy: 'accept_flag',
    });
    await db.insert(homeworkAttempts).values({
      assessmentDefinitionId: hwId,
      studentId: 'PRN-CHILD-A',
      attemptNumber: 1,
      submittedAt: new Date().toISOString(),
      isLate: false,
      status: 'graded',
      score: '17.00',
      feedbackText: 'Excellent travail.',
    });
  }

  console.log('Parent fixtures seeded:', {
    children: ['A', 'B', 'C', 'D', 'EXP', 'FUT', 'FIN', 'CUST', 'SUSP', 'LANGO'].length,
    parents: ['A', 'B', 'C', 'UNLINKED'].length,
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error('SEED ERROR:'); console.error(e); process.exit(1); });
