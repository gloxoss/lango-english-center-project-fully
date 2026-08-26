import { and, count, desc, eq, gte, ilike, inArray, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, studentCreateSchema, studentUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { reserveMatricule } from '@/libs/services/matricule';
import { assertStudentCapacity } from '@/features/subscriptions/services/plan-limits-service';
import { academicYears, attendance, classes, classSections, guardians, guardianStudents, invoices, payments, sections, user } from '@/models/Schema';
import { toDbStatus, toUiStatus } from '@/models/userMapping';

// ponytail: students are `user` rows with role = 'student'. The schema has no
// students table, and matricule/payment_status are stopgap columns on `user` -
// see MIGRATION-NOTES.md. level/className are DEPRECATED stopgaps, superseded by
// the real classSectionId FK; still read as a fallback for rows written before
// classSectionId existed.

type StudentRow = typeof user.$inferSelect;
type ClassSectionDisplay = { className: string | null; sectionName: string | null } | null;

// The response shape is byte-identical to the previous SQLite implementation so the
// dashboard keeps working untouched. Do not "tidy" these field names.
function toApiStudent(row: StudentRow, classSection: ClassSectionDisplay) {
  return {
    id: row.id,
    matricule: row.matricule,
    fullName: row.name,
    classSectionId: row.classSectionId,
    level: classSection?.className ?? row.level,
    className: classSection ? `${classSection.className} ${classSection.sectionName}`.trim() : row.className,
    guardianName: row.guardianName,
    phone: row.phone,
    status: toUiStatus(row.userStatus),
    paymentStatus: row.paymentStatus,
    schoolId: row.tenantId,
  };
}

async function assertClassSectionBelongsToTenant(tenantId: string, classSectionId: string) {
  const [row] = await db.select({ id: classSections.id }).from(classSections).where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId))).limit(1);
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

// Single-student detail fetch (dashboard/students/:id profile page). This app
// has no [id] dynamic API routes anywhere - every detail/update/delete is a
// query-param on the collection route (see PUT/DELETE below) - so `?id=`
// matches the established convention rather than introducing a new one.
// Accepts role IN ('student', 'alumni') - NOT just 'student' - so the same
// detail page can show a transitioned alumnus's real profile too
// (future-implementation/alumni-portal reuses this view for the staff-side
// alumni admin page). The list query elsewhere in this file stays
// student-only; this relaxation is scoped to the single-id lookup only.
async function getStudentDetail(tenantId: string, id: string) {
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
    .where(and(eq(user.id, id), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
    .limit(1);

  if (!row) {
    return null;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [guardianRows, attendanceRows, paymentRows, invoiceRows, academicYearRow] = await Promise.all([
    db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        email: guardians.email,
        relationshipType: guardianStudents.relationshipType,
      })
      .from(guardianStudents)
      .innerJoin(guardians, eq(guardianStudents.guardianId, guardians.id))
      .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.studentId, id))),
    db
      .select({ date: attendance.date, status: attendance.status, lateMinutes: attendance.lateMinutes })
      .from(attendance)
      .where(and(eq(attendance.tenantId, tenantId), eq(attendance.studentId, id), gte(attendance.date, thirtyDaysAgo)))
      .orderBy(desc(attendance.date)),
    db
      .select({ id: payments.id, amount: payments.amount, paymentMethod: payments.paymentMethod, paymentDate: payments.paymentDate })
      .from(payments)
      .where(and(eq(payments.tenantId, tenantId), eq(payments.studentId, id)))
      .orderBy(desc(payments.paymentDate))
      .limit(10),
    db
      .select({ netAmount: invoices.netAmount, paidAmount: invoices.paidAmount, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.studentId, id))),
    row.student.academicYearId
      ? db.select({ name: academicYears.name }).from(academicYears).where(eq(academicYears.id, row.student.academicYearId)).limit(1)
      : Promise.resolve([]),
  ]);

  const presentCount = attendanceRows.filter(a => a.status === 'present').length;
  const attendanceRate = attendanceRows.length > 0 ? Math.round((presentCount / attendanceRows.length) * 1000) / 10 : null;
  const balanceDue = invoiceRows.reduce((sum, inv) => sum + Math.max(0, inv.netAmount - inv.paidAmount), 0);

  return {
    ...toApiStudent(row.student, row.className ? { className: row.className, sectionName: row.sectionName } : null),
    role: row.student.role,
    firstName: row.student.firstName,
    lastName: row.student.lastName,
    email: row.student.email,
    dateOfBirth: row.student.dateOfBirth,
    gender: row.student.gender,
    address: row.student.address,
    nationalId: row.student.nationalId,
    nationality: row.student.nationality,
    motherTongue: row.student.motherTongue,
    city: row.student.city,
    bloodGroup: row.student.bloodGroup,
    academicYearName: academicYearRow[0]?.name ?? null,
    photoUrl: row.student.photoUrl ? `/api/students/photos?id=${row.student.id}` : null,
    createdAt: row.student.createdAt,
    guardians: guardianRows,
    attendance: { last30Days: attendanceRows, rate: attendanceRate },
    payments: paymentRows,
    balanceDue,
  };
}

export async function GET(request: Request) {
  try {
    // ponytail: teachers need read access for attendance rosters
    // (POST /api/attendance already allows teacher); accountant needs it for
    // billing/collection lookups (has students.read, matches sidebar/portal
    // visibility) - writes stay school_admin-only below. Field-level
    // redaction (hiding academic/medical fields from accountant specifically)
    // not yet audited here - this route returns the same shape to every
    // allowed role today.
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);

    const id = searchParams.get('id');
    if (id) {
      const detail = await getStudentDetail(tenantId, id);
      if (!detail) {
        return NextResponse.json({ success: false, message: 'Élève non trouvé' }, { status: 404 });
      }
      // accountant has students.read for billing/collection lookups, not
      // academic data - attendance is the one field here that crosses that
      // line (payments/balanceDue are billing-relevant, guardians are needed
      // for guardian routing, neither of those has an academic/medical concept).
      if (context.role === 'accountant') {
        const { attendance: _attendance, ...billingSafeDetail } = detail;
        return NextResponse.json({ success: true, data: billingSafeDetail });
      }
      // teacher has students.read for roster/attendance lookups, not
      // finance.read - the mirror image of the accountant case above:
      // payments/balanceDue are billing-only and must not ride along.
      if (context.role === 'teacher') {
        const { payments: _payments, balanceDue: _balanceDue, ...academicSafeDetail } = detail;
        return NextResponse.json({ success: true, data: academicSafeDetail });
      }
      return NextResponse.json({ success: true, data: detail });
    }

    const search = searchParams.get('search') || '';
    const level = searchParams.get('level');
    const classId = searchParams.get('classId');
    const classSectionId = searchParams.get('classSectionId');
    const status = searchParams.get('status');

    const filters = [
      eq(user.role, 'student'),
      eq(user.tenantId, tenantId),
    ];

    if (context.branchId) {
      filters.push(eq(user.branchId, context.branchId));
    }

    if (search) {
    // ilike is case-insensitive in Postgres, replacing the LOWER(...) LIKE pattern.
      const term = `%${search}%`;
      filters.push(
        or(
          ilike(user.name, term),
          ilike(user.matricule, term),
          ilike(user.className, term),
        )!,
      );
    }

    // classSectionId filters by the exact class+section; classId filters by
    // the whole class (all its sections); level is a legacy filter against the
    // deprecated free-text column, kept for rows without a classSectionId yet.
    if (classSectionId) {
      filters.push(eq(user.classSectionId, classSectionId));
    } else if (classId) {
      filters.push(eq(classes.id, classId));
    } else if (level && level !== 'Tous') {
      filters.push(eq(user.level, level));
    }

    if (status && status !== 'Tous') {
      filters.push(eq(user.userStatus, toDbStatus(status)));
    }

    const pagination = parsePagination(searchParams);
    const where = and(...filters);

    const [rows, totalRows] = await Promise.all([
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
        .limit(pagination.limit)
        .offset(pagination.offset),
      db
        .select({ total: count() })
        .from(user)
        .leftJoin(classSections, eq(user.classSectionId, classSections.id))
        .leftJoin(classes, eq(classSections.classId, classes.id))
        .where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      data: rows.map(row => toApiStudent(row.student, row.className ? { className: row.className, sectionName: row.sectionName } : null)),
      total,
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
    const matricule = body.matricule || await reserveMatricule(db, tenantId);

    if (body.classSectionId) {
      await assertClassSectionBelongsToTenant(tenantId, body.classSectionId);
    }

    await assertStudentCapacity(tenantId, 1);

    const [inserted] = await db
      .insert(user)
      .values({
        id,
        tenantId,
        matricule,
        name: body.fullName,
        // user.email is NOT NULL and unique; the old students table had no email
        // column, so synthesise one from the id to keep the insert valid.
        email: body.email || `${id.toLowerCase()}@placeholder.local`,
        role: 'student',
        classSectionId: body.classSectionId,
        guardianName: body.guardianName,
        phone: body.phone,
        userStatus: toDbStatus(body.status),
        paymentStatus: body.paymentStatus,
      })
      .returning();

    recordAudit(context, 'create', 'student', inserted!.id);

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

    if (body.classSectionId) {
      await assertClassSectionBelongsToTenant(tenantId, body.classSectionId);
    }

    const [updated] = await db
      .update(user)
      .set({
        name: body.fullName,
        classSectionId: body.classSectionId,
        guardianName: body.guardianName,
        phone: body.phone,
        userStatus: toDbStatus(body.status),
        paymentStatus: body.paymentStatus,
      })
      .where(and(
        eq(user.id, body.id),
        eq(user.tenantId, tenantId),
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Élève non trouvé' }, { status: 404 });
    }

    recordAudit(context, 'update', 'student', body.id);

    return NextResponse.json({
      success: true,
      data: toApiStudent(updated, await loadClassSectionDisplay(updated.classSectionId)),
      message: 'Élève mis à jour en base de données',
    });
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

    if (id) {
      await db.delete(user).where(and(
        eq(user.id, id),
        eq(user.tenantId, tenantId),
      ));
      recordAudit(context, 'delete', 'student', id);
      return NextResponse.json({
        success: true,
        message: 'Élève supprimé de la base de données',
        id,
      });
    }

    return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
