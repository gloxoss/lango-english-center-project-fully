import { and, asc, count, desc, eq, gte, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, subjectTeacherCreateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  getDefaultSessionYearId,
  removeSubjectAssignment,
} from '@/libs/services/subject-teacher-assignment';
import {
  academicClassOfferings,
  classes,
  classSections,
  classSubjects,
  subjects,
  subjectTeachers,
  user,
} from '@/models/Schema';

// Teacher subject assignments with history (migration 0146).
//
// POST is an ASSIGN/REASSIGN: the previous active assignment(s) for the
// (section, class-subject) pair are closed (status=inactive, endsOn=today) and
// a new active row is inserted for the target session year. Nothing is
// destroyed.
//
// DELETE closes when the assignment has teaching evidence; it hard-deletes
// only a mistake with zero timetable/assessment/mark usage.

function toApiSubjectTeacher(row: typeof subjectTeachers.$inferSelect) {
  return {
    id: row.id,
    classSectionId: row.classSectionId,
    subjectId: row.subjectId,
    classSubjectId: row.classSubjectId,
    teacherId: row.teacherId,
    sessionYearId: row.sessionYearId,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    schoolId: row.tenantId,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);

    const conditions = [eq(subjectTeachers.tenantId, tenantId)];
    const classSectionId = searchParams.get('classSectionId');
    const classSubjectId = searchParams.get('classSubjectId');
    const teacherId = searchParams.get('teacherId');
    if (classSectionId) {
      conditions.push(eq(subjectTeachers.classSectionId, classSectionId));
    }
    if (classSubjectId) {
      conditions.push(eq(subjectTeachers.classSubjectId, classSubjectId));
    }
    if (teacherId) {
      conditions.push(eq(subjectTeachers.teacherId, teacherId));
    }
    if (searchParams.get('current') === '1') {
      conditions.push(eq(subjectTeachers.status, 'active'));
      conditions.push(or(isNull(subjectTeachers.endsOn), gte(subjectTeachers.endsOn, new Date().toISOString().slice(0, 10)))!);
    }
    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(subjectTeachers)
        .where(where)
        .orderBy(desc(subjectTeachers.createdAt), asc(subjectTeachers.teacherId))
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(subjectTeachers).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiSubjectTeacher),
      total: totalRows[0]?.total ?? 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, subjectTeacherCreateSchema);

    const [sectionRow] = await db
      .select({ id: classSections.id, classId: classSections.classId, branchId: classes.branchId })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(and(eq(classSections.id, body.classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);
    if (!sectionRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe indiquée n\'existe pas pour cet établissement.');
    }

    const [subjectRow] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, body.subjectId), eq(subjects.tenantId, tenantId))).limit(1);
    if (!subjectRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La matière indiquée n\'existe pas pour cet établissement.');
    }

    // classSubjectId must be the assignment of that same subject to that same
    // section's class - otherwise the three ids describe an inconsistent
    // combination (e.g. a subject taught in a class it was never assigned to).
    const [classSubjectRow] = await db
      .select({ id: classSubjects.id, offeringId: classSubjects.offeringId })
      .from(classSubjects)
      .where(and(
        eq(classSubjects.id, body.classSubjectId),
        eq(classSubjects.tenantId, tenantId),
        eq(classSubjects.classId, sectionRow.classId),
        eq(classSubjects.subjectId, body.subjectId),
      ))
      .limit(1);
    if (!classSubjectRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Cette matière n\'est pas assignée à la classe de cette section.');
    }

    const [teacherRow] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .limit(1);
    if (!teacherRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    // Branch scope: the caller may only assign within their campus, and a
    // branch-pinned teacher may not be assigned to another campus's class.
    if (context.branchId && sectionRow.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez affecter des enseignants que pour les classes de votre campus.');
    }
    if (teacherRow.branchId && sectionRow.branchId && teacherRow.branchId !== sectionRow.branchId) {
      throw new ApiError(422, 'CROSS_BRANCH_ASSIGNMENT', 'Cet enseignant appartient à un autre campus que cette classe.');
    }

    // Target session year: the offering of this class-subject, else the
    // tenant's default session. Never fabricated when neither exists.
    let sessionYearId: string | null = null;
    if (classSubjectRow.offeringId) {
      const [offering] = await db
        .select({ sessionYearId: academicClassOfferings.sessionYearId })
        .from(academicClassOfferings)
        .where(and(eq(academicClassOfferings.id, classSubjectRow.offeringId), eq(academicClassOfferings.tenantId, tenantId)))
        .limit(1);
      sessionYearId = offering?.sessionYearId ?? null;
    }
    if (!sessionYearId) {
      sessionYearId = await getDefaultSessionYearId(tenantId);
    }

    const today = new Date().toISOString().slice(0, 10);

    const inserted = await db.transaction(async (tx) => {
      // Reassignment closes the previous active assignment(s) for the pair —
      // they stay queryable as history. Co-teaching is not an accepted model.
      await tx
        .update(subjectTeachers)
        .set({ status: 'inactive', endsOn: today })
        .where(and(
          eq(subjectTeachers.tenantId, tenantId),
          eq(subjectTeachers.classSectionId, body.classSectionId),
          eq(subjectTeachers.classSubjectId, body.classSubjectId),
          eq(subjectTeachers.status, 'active'),
          isNull(subjectTeachers.endsOn),
        ));

      const [row] = await tx
        .insert(subjectTeachers)
        .values({
          tenantId,
          classSectionId: body.classSectionId,
          subjectId: body.subjectId,
          classSubjectId: body.classSubjectId,
          teacherId: body.teacherId,
          sessionYearId,
          startsOn: today,
          status: 'active',
        })
        .returning();
      return row!;
    });

    recordAudit(context, 'create', 'subject_teacher', inserted.id, { sessionYearId });

    return NextResponse.json({ success: true, data: toApiSubjectTeacher(inserted), sessionYearId });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    // Branch scope: resolve the assignment's section/class branch first.
    const [row] = await db
      .select({ branchId: classes.branchId })
      .from(subjectTeachers)
      .innerJoin(classSections, eq(subjectTeachers.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(and(eq(subjectTeachers.id, id), eq(subjectTeachers.tenantId, tenantId)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }
    if (context.branchId && row.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez modifier que les affectations de votre campus.');
    }

    const result = await removeSubjectAssignment(tenantId, id);
    recordAudit(context, 'delete', 'subject_teacher', id, {
      action: result.action,
      evidence: result.evidence,
    });

    return NextResponse.json({
      success: true,
      id,
      action: result.action,
      message: 'Affectation supprimée.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
