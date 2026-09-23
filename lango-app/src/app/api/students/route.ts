import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { assertStudentCapacity } from '@/features/subscriptions/services/plan-limits-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, studentCreateSchema, studentUpdateSchema } from '@/libs/api/validation';
import { csvSafeCell } from '@/libs/csv-safe';
import { db } from '@/libs/DB';
import { reserveMatricule } from '@/libs/services/matricule';
import { hardDeleteStudent, transitionStudentLifecycle } from '@/libs/services/student-lifecycle';
import {
  alumniDirectoryConsent,
  alumniRequests,
  assessmentResults,
  assessments,
  attendance,
  branches,
  classes,
  classSections,
  guardians,
  guardianStudents,
  invoices,
  payments,
  sections,
  sessionYears,
  studentPlacements,
  user,
} from '@/models/Schema';
import { toDbStatus, toUiStatus } from '@/models/userMapping';

type StudentRow = typeof user.$inferSelect;
type ClassSectionDisplay = { className: string | null; sectionName: string | null } | null;

export type StudentFinanceSnapshot = {
  financialStatus: 'À jour' | 'Partiel' | 'En retard';
  outstandingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  academicYearName?: string | null;
};

export type StudentGuardianProjection = {
  guardianName: string | null;
  guardianPhone: string | null;
  relationshipType?: string | null;
  isVerified: boolean;
  isLegacyFallback: boolean;
};

export function resolveStudentGuardianProjection(
  relationalGuardians?: Array<{
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    relationshipType?: string | null;
    isPrimaryContact?: boolean | null;
  }> | null,
  legacy?: {
    guardianName?: string | null;
    guardianPhone?: string | null;
  } | null,
): StudentGuardianProjection {
  if (relationalGuardians && relationalGuardians.length > 0) {
    const primary = relationalGuardians.find(g => g.isPrimaryContact) ?? relationalGuardians[0];
    if (primary) {
      const name = `${primary.firstName || ''} ${primary.lastName || ''}`.trim() || null;
      return {
        guardianName: name,
        guardianPhone: primary.phone ?? null,
        relationshipType: primary.relationshipType ?? null,
        isVerified: true,
        isLegacyFallback: false,
      };
    }
  }

  if (legacy?.guardianName || legacy?.guardianPhone) {
    return {
      guardianName: legacy.guardianName ?? null,
      guardianPhone: legacy.guardianPhone ?? null,
      relationshipType: null,
      isVerified: false,
      isLegacyFallback: true,
    };
  }

  return {
    guardianName: null,
    guardianPhone: null,
    relationshipType: null,
    isVerified: false,
    isLegacyFallback: false,
  };
}

export function toApiStudent(
  row: StudentRow,
  classSection: ClassSectionDisplay,
  finance?: StudentFinanceSnapshot,
  guardianProj?: StudentGuardianProjection,
) {
  const guardian = guardianProj ?? resolveStudentGuardianProjection(null, {
    guardianName: row.guardianName,
    guardianPhone: row.guardianPhone,
  });

  return {
    id: row.id,
    matricule: row.matricule,
    codeMassar: row.nationalId,
    nationalId: row.nationalId,
    fullName: row.name,
    firstName: row.firstName,
    lastName: row.lastName,
    classSectionId: row.classSectionId,
    level: classSection?.className ?? row.level,
    className: classSection ? `${classSection.className} ${classSection.sectionName}`.trim() : row.className,
    guardianName: guardian.guardianName,
    guardianPhone: guardian.guardianPhone,
    guardianVerified: guardian.isVerified,
    isLegacyFallback: guardian.isLegacyFallback,
    guardianRelation: guardian.relationshipType ?? null,
    phone: row.phone,
    status: toUiStatus(row.userStatus),
    paymentStatus: finance?.financialStatus ?? (row.paymentStatus === 'En retard' ? 'En retard' : 'À jour'),
    outstandingAmount: finance?.outstandingAmount ?? 0,
    overdueAmount: finance?.overdueAmount ?? 0,
    overdueCount: finance?.overdueCount ?? 0,
    schoolId: row.tenantId,
    branchId: row.branchId,
    createdAt: row.createdAt,
  };
}

async function assertClassSectionBelongsToTenant(tenantId: string, classSectionId: string) {
  const [row] = await db
    .select({ id: classSections.id })
    .from(classSections)
    .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe indiquée n\'existe pas pour cet établissement.');
  }
}

async function loadClassSectionDisplay(classSectionId: string | null | undefined): Promise<ClassSectionDisplay> {
  if (!classSectionId) {
    return null;
  }
  const [row] = await db
    .select({ className: classes.name, sectionName: sections.name })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .where(eq(classSections.id, classSectionId))
    .limit(1);
  return row ?? null;
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const lower = email.toLowerCase().trim();
  return lower.endsWith('@placeholder.local') || lower.endsWith('@demo.schoolos.internal') || (lower.startsWith('stu-') && lower.includes('placeholder'));
}

async function getStudentDetail(tenantId: string, id: string, branchId?: string | null) {
  const whereConditions = [
    eq(user.id, id),
    eq(user.tenantId, tenantId),
    inArray(user.role, ['student', 'alumni']),
  ];
  if (branchId) {
    whereConditions.push(eq(user.branchId, branchId));
  }

  const [row] = await db
    .select({
      student: user,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(user)
    .leftJoin(classSections, eq(user.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(...whereConditions))
    .limit(1);

  if (!row) {
    return null;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const [
    guardianRows,
    attendanceRows,
    paymentRows,
    _invoiceRows,
    invoiceTotals,
    paymentTotals,
    activePlacement,
    activeSessionYearRow,
    placementsHistory,
    recentAssessments,
    cohortRow,
    directoryRow,
    alumniRequestRows,
  ] = await Promise.all([
    db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        email: guardians.email,
        relationshipType: guardianStudents.relationshipType,
        isPrimaryContact: guardianStudents.isPrimaryContact,
        isEmergencyContact: guardianStudents.isEmergencyContact,
        canPickup: guardianStudents.canPickup,
      })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
      .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, id))),
    db
      .select({ date: attendance.date, status: attendance.status, lateMinutes: attendance.lateMinutes })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, id), eq(attendance.isVoided, false), gte(attendance.date, thirtyDaysAgo)))
      .orderBy(desc(attendance.date)),
    db
      .select({ id: payments.id, amount: payments.amount, paymentMethod: payments.paymentMethod, paymentDate: payments.paymentDate })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.studentId, id), sql`${payments.status} != 'reversed'`))
      .orderBy(desc(payments.paymentDate))
      .limit(10),
    db
      .select({ netAmount: invoices.netAmount, paidAmount: invoices.paidAmount, dueDate: invoices.dueDate, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, id), ne(invoices.status, 'cancelled'))),
    db
      .select({
        totalInvoiced: sql<number>`coalesce(sum(${invoices.netAmount}), 0)::float`,
        totalPaidOnInvoices: sql<number>`coalesce(sum(${invoices.paidAmount}), 0)::float`,
        balanceDue: sql<number>`coalesce(sum(greatest(0, ${invoices.netAmount} - ${invoices.paidAmount})), 0)::float`,
        overdueAmount: sql<number>`coalesce(sum(case when ${invoices.dueDate} < ${today} and ${invoices.status} != 'paid' then greatest(0, ${invoices.netAmount} - ${invoices.paidAmount}) else 0 end), 0)::float`,
        overdueCount: sql<number>`coalesce(sum(case when ${invoices.dueDate} < ${today} and ${invoices.status} != 'paid' then 1 else 0 end), 0)::int`,
      })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, id), ne(invoices.status, 'cancelled'))),
    db
      .select({
        totalPaid: sql<number>`coalesce(sum(${payments.amount}), 0)::float`,
      })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.studentId, id), sql`${payments.status} != 'reversed'`)),
    db
      .select({
        id: studentPlacements.id,
        sessionYearId: studentPlacements.sessionYearId,
        sessionYearName: sessionYears.name,
        classSectionId: studentPlacements.classSectionId,
        className: classes.name,
        sectionName: sections.name,
        status: studentPlacements.status,
        startDate: studentPlacements.startDate,
      })
      .from(studentPlacements)
      .leftJoin(sessionYears, eq(studentPlacements.sessionYearId, sessionYears.id))
      .leftJoin(classSections, eq(studentPlacements.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, id),
        eq(studentPlacements.isCurrent, true),
      ))
      .orderBy(desc(studentPlacements.startDate), desc(studentPlacements.createdAt))
      .limit(1),
    db
      .select({
        id: sessionYears.id,
        name: sessionYears.name,
        isDefault: sessionYears.isDefault,
        startDate: sessionYears.startDate,
        endDate: sessionYears.endDate,
      })
      .from(sessionYears)
      .where(eq(sessionYears.tenantId, tenantId)),
    db
      .select({
        id: studentPlacements.id,
        sessionYearId: studentPlacements.sessionYearId,
        sessionYearName: sessionYears.name,
        classSectionId: studentPlacements.classSectionId,
        className: classes.name,
        sectionName: sections.name,
        status: studentPlacements.status,
        startDate: studentPlacements.startDate,
        endDate: studentPlacements.endDate,
        isCurrent: studentPlacements.isCurrent,
        notes: studentPlacements.notes,
      })
      .from(studentPlacements)
      .leftJoin(sessionYears, eq(studentPlacements.sessionYearId, sessionYears.id))
      .leftJoin(classSections, eq(studentPlacements.classSectionId, classSections.id))
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.studentId, id),
      ))
      .orderBy(desc(studentPlacements.startDate), desc(studentPlacements.createdAt)),
    db
      .select({
        id: assessmentResults.id,
        title: assessments.title,
        finalPercentage: assessmentResults.finalPercentage,
        gradeCode: assessmentResults.gradeCode,
        date: assessments.assessmentDate,
      })
      .from(assessmentResults)
      .innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id))
      .where(and(eq(assessmentResults.tenantId, tenantId), eq(assessmentResults.studentId, id)))
      .orderBy(desc(assessments.assessmentDate), desc(assessmentResults.createdAt))
      .limit(5),
    row.student.graduationCohortSessionYearId
      ? db.select({ name: sessionYears.name }).from(sessionYears).where(eq(sessionYears.id, row.student.graduationCohortSessionYearId)).limit(1)
      : Promise.resolve([]),
    row.student.role === 'alumni'
      ? db.select().from(alumniDirectoryConsent).where(and(eq(alumniDirectoryConsent.tenantId, tenantId), eq(alumniDirectoryConsent.alumnusId, id))).limit(1)
      : Promise.resolve([]),
    row.student.role === 'alumni'
      ? db
          .select({
            id: alumniRequests.id,
            type: alumniRequests.type,
            status: alumniRequests.status,
            note: alumniRequests.note,
            decisionNote: alumniRequests.decisionNote,
            decidedAt: alumniRequests.decidedAt,
            createdAt: alumniRequests.createdAt,
          })
          .from(alumniRequests)
          .where(and(eq(alumniRequests.tenantId, tenantId), eq(alumniRequests.alumnusId, id)))
          .orderBy(desc(alumniRequests.createdAt))
          .limit(10)
      : Promise.resolve([]),
  ]);

  const presentCount = attendanceRows.filter(a => a.status === 'present').length;
  const absentCount = attendanceRows.filter(a => a.status === 'absent').length;
  const excusedCount = attendanceRows.filter(a => a.status === 'excused').length;
  const lateCount = attendanceRows.filter(a => a.status === 'late').length;
  const recordedCount = attendanceRows.length;
  // CANONICAL PRESENCE (Phase 7B): present + late + excused count as attended,
  // exactly like attendanceSummary/attendanceRate; NULL (never 100) when
  // nothing was recorded.
  const attendanceRate = recordedCount > 0
    ? Math.round(((presentCount + lateCount + excusedCount) / recordedCount) * 1000) / 10
    : null;

  const totalInvoiced = Number(invoiceTotals[0]?.totalInvoiced ?? 0);
  const totalPaid = Number(paymentTotals[0]?.totalPaid ?? invoiceTotals[0]?.totalPaidOnInvoices ?? 0);
  const balanceDue = Number(invoiceTotals[0]?.balanceDue ?? 0);
  const overdueAmount = Number(invoiceTotals[0]?.overdueAmount ?? 0);
  const overdueCount = Number(invoiceTotals[0]?.overdueCount ?? 0);

  // Authoritative session resolution:
  // Rule: current valid studentPlacement -> placement.sessionYearId -> sessionYear, or shared active session resolver (date-active, then isDefault)
  const now = new Date();
  const dateActiveSession = activeSessionYearRow.find(s => s.startDate && s.endDate && now >= new Date(s.startDate) && now <= new Date(s.endDate));
  const defaultSession = activeSessionYearRow.find(s => s.isDefault);
  const fallbackSession = dateActiveSession ?? defaultSession ?? activeSessionYearRow[0];

  const effectiveSessionYearId = activePlacement[0]?.sessionYearId ?? fallbackSession?.id ?? row.student.academicYearId;
  const effectiveSessionYearName = activePlacement[0]?.sessionYearName ?? fallbackSession?.name ?? null;

  const financeSnapshot: StudentFinanceSnapshot = {
    financialStatus: overdueAmount > 0 ? 'En retard' : balanceDue > 0 ? 'Partiel' : 'À jour',
    outstandingAmount: balanceDue,
    overdueAmount,
    overdueCount,
    academicYearName: effectiveSessionYearName,
  };

  const resolvedClassSection = activePlacement[0]?.className
    ? { className: activePlacement[0].className, sectionName: activePlacement[0].sectionName }
    : (row.className ? { className: row.className, sectionName: row.sectionName } : null);

  // Reusable guardian projection: relational guardian takes precedence; legacy fields marked unverified / à confirmer
  const guardianProj = resolveStudentGuardianProjection(
    guardianRows,
    { guardianName: row.student.guardianName, guardianPhone: row.student.guardianPhone },
  );

  const legacyGuardian = guardianProj.isLegacyFallback
    ? {
        name: guardianProj.guardianName,
        phone: guardianProj.guardianPhone,
        isLegacyFallback: true,
        verified: false,
      }
    : null;

  return {
    ...toApiStudent(row.student, resolvedClassSection, financeSnapshot, guardianProj),
    role: row.student.role,
    firstName: row.student.firstName,
    lastName: row.student.lastName,
    email: isSyntheticEmail(row.student.email) ? null : row.student.email,
    dateOfBirth: row.student.dateOfBirth,
    gender: row.student.gender,
    address: row.student.address,
    nationalId: row.student.nationalId,
    nationality: row.student.nationality,
    motherTongue: row.student.motherTongue,
    city: row.student.city,
    bloodGroup: row.student.bloodGroup,
    academicYearId: effectiveSessionYearId,
    academicYearName: effectiveSessionYearName,
    currentPlacement: activePlacement[0] ?? null,
    placementsHistory,
    recentAssessments,
    photoUrl: row.student.photoUrl ? `/api/students/photos?id=${row.student.id}` : null,
    createdAt: row.student.createdAt,
    guardians: guardianRows,
    legacyGuardian,
    guardianVerified: guardianProj.isVerified,
    isLegacyFallback: guardianProj.isLegacyFallback,
    attendance: {
      last30Days: attendanceRows,
      rate: attendanceRate,
      recordedCount,
      totalRecorded: recordedCount,
      presentCount,
      absentCount,
      excusedCount,
      lateCount,
    },
    payments: paymentRows,
    totalInvoiced,
    totalPaid,
    balanceDue,
    overdueAmount,
    alumniTransitionedAt: row.student.alumniTransitionedAt ?? null,
    cohortName: cohortRow[0]?.name ?? null,
    alumniDirectory: directoryRow[0]
      ? {
          currentEmployer: directoryRow[0].currentEmployer ?? null,
          showName: directoryRow[0].showName ?? false,
          showCohort: directoryRow[0].showCohort ?? false,
          showCurrentEmployer: directoryRow[0].showCurrentEmployer ?? false,
          showContactInfo: directoryRow[0].showContactInfo ?? false,
        }
      : null,
    alumniRequests: alumniRequestRows ?? [],
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);

    // 1. Authoritative Branch Scoping
    let effectiveBranchId: string | undefined = context.branchId || undefined;
    const requestedBranchId = searchParams.get('branchId');
    if (!context.branchId && requestedBranchId && requestedBranchId !== 'all') {
      const [bRow] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.id, requestedBranchId), eq(branches.tenantId, tenantId)))
        .limit(1);
      if (!bRow) {
        throw new ApiError(403, 'FORBIDDEN', 'Succursale demandée non autorisée ou introuvable.');
      }
      effectiveBranchId = bRow.id;
    }

    // 2. Single Student Detail
    const id = searchParams.get('id');
    if (id) {
      // Authoritative existence & branch isolation check
      const [studentExists] = await db
        .select({ id: user.id, branchId: user.branchId })
        .from(user)
        .where(and(eq(user.id, id), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
        .limit(1);

      if (!studentExists) {
        return NextResponse.json({ success: false, message: 'Élève non trouvé' }, { status: 404 });
      }

      if (context.branchId && studentExists.branchId && studentExists.branchId !== context.branchId) {
        return NextResponse.json({ success: false, message: 'Accès interdit à cette succursale.' }, { status: 403 });
      }

      const detail = await getStudentDetail(tenantId, id, effectiveBranchId);
      if (!detail) {
        return NextResponse.json({ success: false, message: 'Élève non trouvé' }, { status: 404 });
      }
      if (context.role === 'accountant') {
        const { attendance: _att, nationalId: _nid, bloodGroup: _bg, address: _addr, placementsHistory: _ph, recentAssessments: _ra, ...billingSafeDetail } = detail;
        return NextResponse.json({ success: true, data: billingSafeDetail });
      }
      if (context.role === 'teacher') {
        const { payments: _pay, balanceDue: _bal, totalInvoiced: _ti, totalPaid: _tp, overdueAmount: _oa, nationalId: _nid, bloodGroup: _bg, address: _addr, ...academicSafeDetail } = detail;
        return NextResponse.json({ success: true, data: academicSafeDetail });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    // 3. Search & Filters
    const search = searchParams.get('search') || searchParams.get('q') || '';
    const level = searchParams.get('level');
    const classId = searchParams.get('classId');
    const classSectionId = searchParams.get('classSectionId');
    const status = searchParams.get('status');
    const isExport = searchParams.get('export') === 'csv';

    const filters = [
      eq(user.role, 'student'),
      eq(user.tenantId, tenantId),
    ];

    if (effectiveBranchId) {
      filters.push(eq(user.branchId, effectiveBranchId));
    }

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      filters.push(
        or(
          ilike(user.name, term),
          ilike(user.matricule, term),
          ilike(user.nationalId, term),
          ilike(user.guardianName, term),
          ilike(user.guardianPhone, term),
          ilike(user.phone, term),
          ilike(user.className, term),
          ilike(classes.name, term),
        )!,
      );
    }

    if (classSectionId) {
      filters.push(eq(user.classSectionId, classSectionId));
    } else if (classId) {
      filters.push(eq(classes.id, classId));
    } else if (level && level !== 'Tous' && level !== 'all') {
      filters.push(or(eq(user.level, level), ilike(classes.name, `%${level}%`))!);
    }

    if (status && status !== 'Tous' && status !== 'all') {
      filters.push(eq(user.userStatus, toDbStatus(status)));
    }

    const identifierFilter = searchParams.get('identifierFilter') || searchParams.get('filterType');
    if (identifierFilter === 'missing_matricule') {
      filters.push(or(isNull(user.matricule), eq(user.matricule, ''))!);
    } else if (identifierFilter === 'missing_massar') {
      filters.push(or(isNull(user.nationalId), eq(user.nationalId, ''))!);
    } else if (identifierFilter === 'incomplete') {
      filters.push(
        or(
          isNull(user.matricule),
          eq(user.matricule, ''),
          isNull(user.nationalId),
          eq(user.nationalId, ''),
        )!,
      );
    }

    const pagination = parsePagination(searchParams);
    const where = and(...filters);
    const today = new Date().toISOString().slice(0, 10);

    // 4. Institutional Scope Queries for KPIs (NOT distorted by search text)
    const institutionalBranchFilter = effectiveBranchId ? eq(user.branchId, effectiveBranchId) : undefined;
    const [currentSessionYear] = await db
      .select({ id: sessionYears.id, startDate: sessionYears.startDate, name: sessionYears.name })
      .from(sessionYears)
      .where(and(eq(sessionYears.tenantId, tenantId), or(eq(sessionYears.isDefault, true), and(lte(sessionYears.startDate, today), gte(sessionYears.endDate, today)))))
      .orderBy(desc(sessionYears.isDefault), desc(sessionYears.startDate))
      .limit(1);

    const sessionStartDate = currentSessionYear?.startDate ?? `${new Date().getFullYear()}-01-01`;

    // 5. Query Active Rows & Global KPIs
    const [rows, totalRows, kpiStats, overdueFinance, enrollmentStats] = await Promise.all([
      db
        .select({
          student: user,
          className: classes.name,
          sectionName: sections.name,
        })
        .from(user)
        .leftJoin(classSections, eq(user.classSectionId, classSections.id))
        .leftJoin(classes, eq(classSections.classId, classes.id))
        .leftJoin(sections, eq(classSections.sectionId, sections.id))
        .where(where)
        .orderBy(desc(user.createdAt))
        .limit(isExport ? 5000 : pagination.limit)
        .offset(isExport ? 0 : pagination.offset),

      // Total matching current table filter
      db
        .select({ total: count() })
        .from(user)
        .leftJoin(classSections, eq(user.classSectionId, classSections.id))
        .leftJoin(classes, eq(classSections.classId, classes.id))
        .where(where),

      // Authoritative KPIs (Scope: Tenant + Active Branch)
      db
        .select({
          active: count(sql`CASE WHEN ${user.userStatus} = 'active' THEN 1 END`),
          unassigned: count(sql`CASE WHEN ${user.classSectionId} IS NULL AND ${user.userStatus} = 'active' THEN 1 END`),
          newProfilesThisYear: count(sql`CASE WHEN ${user.createdAt} >= ${sessionStartDate} THEN 1 END`),
        })
        .from(user)
        .where(and(
          eq(user.tenantId, tenantId),
          eq(user.role, 'student'),
          institutionalBranchFilter,
        )),

      // Real Finance Overdue Aggregation from invoices table
      db
        .select({
          studentId: invoices.studentId,
          remainingAmount: sql<number>`(${invoices.netAmount} - ${invoices.paidAmount})::float`,
          guardianPhone: user.guardianPhone,
        })
        .from(invoices)
        .innerJoin(user, and(eq(invoices.studentId, user.id), eq(user.tenantId, tenantId)))
        .where(and(
          eq(invoices.tenantId, tenantId),
          or(
            eq(invoices.status, 'overdue'),
            and(
              sql`${invoices.dueDate} < ${today}`,
              sql`${invoices.status} NOT IN ('paid', 'cancelled', 'draft')`,
            ),
          ),
          institutionalBranchFilter,
        )),

      // Authoritative Placement/Enrollment Stats for Active Session
      currentSessionYear
        ? db
            .select({
              newEnrollments: count(studentPlacements.id),
            })
            .from(studentPlacements)
            .innerJoin(user, and(eq(studentPlacements.studentId, user.id), eq(user.tenantId, tenantId)))
            .where(and(
              eq(studentPlacements.tenantId, tenantId),
              eq(studentPlacements.sessionYearId, currentSessionYear.id),
              eq(studentPlacements.status, 'enrolled'),
              isNull(studentPlacements.promotedFromPlacementId),
              institutionalBranchFilter,
            ))
        : Promise.resolve([{ newEnrollments: 0 }]),
    ]);

    const total = totalRows[0]?.total ?? 0;
    const totalOverdueMAD = overdueFinance.reduce((sum, r) => sum + Math.max(0, r.remainingAmount), 0);
    const overdueStudentsCount = new Set(overdueFinance.map(r => r.studentId)).size;
    const overdueFamiliesCount = new Set(overdueFinance.map(r => r.guardianPhone || r.studentId)).size;
    const newEnrollmentsCount = Number(enrollmentStats[0]?.newEnrollments ?? 0);
    const newProfilesCount = Number(kpiStats[0]?.newProfilesThisYear ?? 0);

    const stats = {
      total,
      active: Number(kpiStats[0]?.active ?? 0),
      unassigned: Number(kpiStats[0]?.unassigned ?? 0),
      newInscriptions: newEnrollmentsCount, // Authoritative placement source
      newEnrollments: newEnrollmentsCount,
      newProfilesThisYear: newProfilesCount,
      overdueStudentsCount,
      overdueFamiliesCount,
      totalOverdueMAD,
      overdue: overdueStudentsCount, // Backward compatibility for legacy clients
      activeAcademicYear: currentSessionYear?.name ?? 'En cours',
    };

    // 6. Batch Query Financial & Guardian Truth for Returned Students (Eliminating N+1)
    const studentIds = rows.map(r => r.student.id);
    const [pageInvoices, pageGuardians] = await Promise.all([
      studentIds.length > 0
        ? db
            .select({
              studentId: invoices.studentId,
              netAmount: invoices.netAmount,
              paidAmount: invoices.paidAmount,
              dueDate: invoices.dueDate,
              status: invoices.status,
            })
            .from(invoices)
            .where(and(
              eq(invoices.tenantId, tenantId),
              inArray(invoices.studentId, studentIds),
              ne(invoices.status, 'cancelled'),
            ))
        : Promise.resolve([]),
      studentIds.length > 0
        ? db
            .select({
              studentId: guardianStudents.studentId,
              firstName: guardians.firstName,
              lastName: guardians.lastName,
              phone: guardians.phone,
              relationshipType: guardianStudents.relationshipType,
              isPrimaryContact: guardianStudents.isPrimaryContact,
            })
            .from(guardianStudents)
            .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
            .where(and(
              eq(guardianStudents.tenantId, tenantId),
              inArray(guardianStudents.studentId, studentIds),
            ))
        : Promise.resolve([]),
    ]);

    const guardiansByStudent = new Map<string, Array<{ firstName: string | null; lastName: string | null; phone: string | null; relationshipType: string | null; isPrimaryContact: boolean | null }>>();
    for (const g of pageGuardians) {
      const list = guardiansByStudent.get(g.studentId) ?? [];
      list.push(g);
      guardiansByStudent.set(g.studentId, list);
    }

    const financeByStudent = new Map<string, StudentFinanceSnapshot>();
    for (const sid of studentIds) {
      const invs = pageInvoices.filter(i => i.studentId === sid);
      const outstanding = invs.reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);
      const overdue = invs
        .filter(i => i.dueDate < today && i.status !== 'paid')
        .reduce((sum, i) => sum + Math.max(0, i.netAmount - i.paidAmount), 0);
      const overdueCount = invs.filter(i => i.dueDate < today && i.status !== 'paid').length;

      financeByStudent.set(sid, {
        financialStatus: overdue > 0 ? 'En retard' : outstanding > 0 ? 'Partiel' : 'À jour',
        outstandingAmount: outstanding,
        overdueAmount: overdue,
        overdueCount,
      });
    }

    const mappedStudents = rows.map((row) => {
      const fin = financeByStudent.get(row.student.id);
      const guardianProj = resolveStudentGuardianProjection(
        guardiansByStudent.get(row.student.id),
        { guardianName: row.student.guardianName, guardianPhone: row.student.guardianPhone },
      );
      return toApiStudent(row.student, row.className ? { className: row.className, sectionName: row.sectionName } : null, fin, guardianProj);
    });

    // 7. Role-Specific Field Filtering (Least Privilege on Directory Listing)
    let roleFilteredData = mappedStudents;
    if (context.role === 'teacher') {
      roleFilteredData = mappedStudents.map(({ outstandingAmount: _oa, overdueAmount: _ova, overdueCount: _ovc, ...rest }) => ({
        ...rest,
        outstandingAmount: 0,
        overdueAmount: 0,
        overdueCount: 0,
      }));
    } else if (context.role === 'accountant') {
      roleFilteredData = mappedStudents.map(({ nationalId: _nid, ...rest }) => ({
        ...rest,
        nationalId: null,
      }));
    }

    // 8. Server-Side CSV Export if Requested
    if (isExport) {
      const csvHeaders = ['Matricule', 'Nom Complet', 'Classe', 'Tuteur Legal', 'Telephone Tuteur', 'Statut', 'Situation Financiere', 'Montant Restant (MAD)', 'Montant Echu (MAD)'];
      const csvLines = [
        csvHeaders.join(';'),
        ...roleFilteredData.map(st => [
          st.matricule || '',
          st.fullName || '',
          st.className || 'Non assigne',
          st.guardianName || '',
          st.guardianPhone || '',
          st.status,
          st.paymentStatus,
          st.outstandingAmount || 0,
          st.overdueAmount || 0,
        ].map(csvSafeCell).join(';')),
      ];

      return new NextResponse(csvLines.join('\n'), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8;',
          'Content-Disposition': `attachment; filename="Repertoire_Eleves_${today}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: roleFilteredData,
      total,
      stats,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.create');
    const body = await parseJson(request, studentCreateSchema);
    const id = `STU-${Date.now()}`;

    // Authoritative sequential matricule: use provided or generate via reserveMatricule
    let matricule = body.matricule?.trim().toUpperCase() || null;
    if (matricule) {
      const [dupMatricule] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.matricule, matricule)))
        .limit(1);
      if (dupMatricule) {
        throw new ApiError(409, 'MATRICULE_CONFLICT', `Le matricule "${matricule}" est déjà attribué à un autre élève dans votre établissement.`);
      }
    } else {
      matricule = await reserveMatricule(db, tenantId);
    }

    // Code Massar validation & normalization
    const rawMassar = (body.codeMassar || body.nationalId)?.trim().toUpperCase() || null;
    let cleanMassar: string | null = null;
    if (rawMassar) {
      if (!/^[A-Z]\d{9}$/i.test(rawMassar)) {
        throw new ApiError(422, 'FORMAT_INVALID', `Le Code Massar "${rawMassar}" est invalide (format attendu : 1 lettre suivie de 9 chiffres, ex: G134567890).`);
      }
      const [dupMassar] = await db
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.nationalId, rawMassar)))
        .limit(1);
      if (dupMassar) {
        throw new ApiError(409, 'MASSAR_CONFLICT', `Le Code Massar "${rawMassar}" est déjà attribué à un autre élève dans votre établissement.`);
      }
      cleanMassar = rawMassar;
    }

    // Resolve Authoritative Branch
    let branchId = context.branchId;
    if (!branchId) {
      const [defaultBranch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.tenantId, tenantId), eq(branches.isDefault, true)))
        .limit(1);
      branchId = defaultBranch?.id ?? null;
    }

    if (body.classSectionId) {
      await assertClassSectionBelongsToTenant(tenantId, body.classSectionId);
    }

    await assertStudentCapacity(tenantId, 1);

    const [inserted] = await db
      .insert(user)
      .values({
        id,
        tenantId,
        branchId,
        matricule,
        nationalId: cleanMassar,
        name: body.fullName,
        email: body.email || `${id.toLowerCase()}@placeholder.local`,
        role: 'student',
        classSectionId: body.classSectionId,
        guardianName: body.guardianName,
        guardianPhone: body.guardianPhone,
        phone: body.phone,
        userStatus: toDbStatus(body.status),
        paymentStatus: body.paymentStatus || 'À jour',
      })
      .returning();

    recordAudit(context, 'create', 'student', inserted!.id, {
      branchId,
      matricule,
      nationalId: cleanMassar,
      classSectionId: body.classSectionId || null,
    });

    return NextResponse.json({
      success: true,
      data: toApiStudent(inserted!, await loadClassSectionDisplay(inserted!.classSectionId)),
      message: 'Élève inscrit dans la base de données avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');
    const body = await parseJson(request, studentUpdateSchema);

    // Verify branch isolation if actor is branch-restricted
    const updateConditions = [
      eq(user.id, body.id),
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
    ];
    if (context.branchId) {
      updateConditions.push(eq(user.branchId, context.branchId));
    }

    const [existing] = await db.select({ id: user.id }).from(user).where(and(...updateConditions)).limit(1);
    if (!existing) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable ou non autorisé pour votre succursale.');
    }

    if (body.classSectionId) {
      await assertClassSectionBelongsToTenant(tenantId, body.classSectionId);
    }

    const updateData: Record<string, any> = {};
    if (body.fullName !== undefined) {
      updateData.name = body.fullName;
    }

    // Validate and check duplicate matricule within tenant
    if (body.matricule !== undefined) {
      const normMat = body.matricule?.trim().toUpperCase() || null;
      if (normMat) {
        const [dupMat] = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.matricule, normMat), ne(user.id, body.id)))
          .limit(1);
        if (dupMat) {
          throw new ApiError(409, 'MATRICULE_CONFLICT', `Le matricule "${normMat}" est déjà attribué à un autre élève dans votre établissement.`);
        }
      }
      updateData.matricule = normMat;
    }

    // Validate and check duplicate Code Massar within tenant
    const rawUpdateMassar = (body.codeMassar !== undefined || body.nationalId !== undefined)
      ? ((body.codeMassar || body.nationalId)?.trim().toUpperCase() || null)
      : undefined;
    if (rawUpdateMassar !== undefined) {
      if (rawUpdateMassar) {
        if (!/^[A-Z]\d{9}$/i.test(rawUpdateMassar)) {
          throw new ApiError(422, 'FORMAT_INVALID', `Le Code Massar "${rawUpdateMassar}" est invalide (format attendu : 1 lettre suivie de 9 chiffres, ex: G134567890).`);
        }
        const [dupMassar] = await db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.nationalId, rawUpdateMassar), ne(user.id, body.id)))
          .limit(1);
        if (dupMassar) {
          throw new ApiError(409, 'MASSAR_CONFLICT', `Le Code Massar "${rawUpdateMassar}" est déjà attribué à un autre élève dans votre établissement.`);
        }
      }
      updateData.nationalId = rawUpdateMassar;
    }

    if (body.firstName !== undefined) {
      updateData.firstName = body.firstName;
    }
    if (body.lastName !== undefined) {
      updateData.lastName = body.lastName;
    }
    if (body.email !== undefined) {
      updateData.email = body.email;
    }
    if (body.phone !== undefined) {
      updateData.phone = body.phone;
    }
    if (body.guardianName !== undefined) {
      updateData.guardianName = body.guardianName;
    }
    if (body.guardianPhone !== undefined) {
      updateData.guardianPhone = body.guardianPhone;
    }
    if (body.classSectionId !== undefined) {
      updateData.classSectionId = body.classSectionId;
    }
    if (body.status !== undefined) {
      updateData.userStatus = toDbStatus(body.status);
    }
    if (body.paymentStatus !== undefined) {
      updateData.paymentStatus = body.paymentStatus;
    }
    if (body.dateOfBirth !== undefined) {
      updateData.dateOfBirth = body.dateOfBirth;
    }
    if (body.gender !== undefined) {
      updateData.gender = body.gender;
    }
    if (body.address !== undefined) {
      updateData.address = body.address;
    }
    if (body.nationality !== undefined) {
      updateData.nationality = body.nationality;
    }
    if (body.motherTongue !== undefined) {
      updateData.motherTongue = body.motherTongue;
    }
    if (body.city !== undefined) {
      updateData.city = body.city;
    }
    if (body.bloodGroup !== undefined) {
      updateData.bloodGroup = body.bloodGroup;
    }
    if (body.academicYearId !== undefined) {
      updateData.academicYearId = body.academicYearId;
    }
    updateData.updatedAt = sql`now()`;

    const [updated] = await db
      .update(user)
      .set(updateData)
      .where(and(eq(user.id, body.id), eq(user.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'student', body.id, {
      matricule: updateData.matricule,
      nationalId: updateData.nationalId,
    });
    const detail = await getStudentDetail(tenantId, body.id, context.branchId);

    return NextResponse.json({
      success: true,
      data: detail ?? toApiStudent(updated!, await loadClassSectionDisplay(updated!.classSectionId)),
      message: 'Élève mis à jour en base de données',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');
    const body = await request.json();

    if (!body.id || !body.targetStatus) {
      throw new ApiError(400, 'BAD_REQUEST', 'id et targetStatus requis.');
    }

    const result = await transitionStudentLifecycle({
      tenantId,
      branchId: context.branchId,
      studentId: body.id,
      targetStatus: body.targetStatus,
      reason: body.reason,
      effectiveDate: body.effectiveDate,
      actor: context,
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.delete');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const forceHard = searchParams.get('mode') === 'hard';

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    // Verify branch boundary on DELETE
    const studentConditions = [
      eq(user.id, id),
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
    ];
    if (context.branchId) {
      studentConditions.push(eq(user.branchId, context.branchId));
    }

    const [student] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(...studentConditions))
      .limit(1);

    if (!student) {
      return NextResponse.json({ success: false, message: 'Élève non trouvé ou non autorisé pour cette succursale.' }, { status: 404 });
    }

    if (forceHard) {
      // Direct hard delete request: strictly fails if historical records exist
      const hardResult = await hardDeleteStudent({
        tenantId,
        branchId: context.branchId,
        studentId: id,
        actor: context,
      });
      return NextResponse.json(hardResult);
    }

    // Default safe lifecycle transition: Archive without wiping classSectionId!
    const _archiveResult = await transitionStudentLifecycle({
      tenantId,
      branchId: context.branchId,
      studentId: id,
      targetStatus: 'archived',
      reason: 'Archivage administratif sécurisé depuis le répertoire',
      actor: context,
    });

    return NextResponse.json({
      success: true,
      action: 'archived',
      message: 'Élève archivé (statut archivé, historique pédagogique et comptable intégralement préservés).',
      id,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
