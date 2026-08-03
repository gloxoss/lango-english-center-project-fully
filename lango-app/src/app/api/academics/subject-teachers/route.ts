import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, subjectTeacherCreateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, classSubjects, subjects, subjectTeachers, user } from '@/models/Schema';

// ponytail: pure join record, no PUT - reassignment is delete + recreate.

function toApiSubjectTeacher(row: typeof subjectTeachers.$inferSelect) {
  return {
    id: row.id,
    classSectionId: row.classSectionId,
    subjectId: row.subjectId,
    classSubjectId: row.classSubjectId,
    teacherId: row.teacherId,
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
    const where = eq(subjectTeachers.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(subjectTeachers).where(where).limit(pagination.limit).offset(pagination.offset),
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

    const [sectionRow] = await db.select({ id: classSections.id, classId: classSections.classId }).from(classSections).where(and(eq(classSections.id, body.classSectionId), eq(classSections.tenantId, tenantId))).limit(1);
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
    const [classSubjectRow] = await db.select({ id: classSubjects.id }).from(classSubjects).where(and(
      eq(classSubjects.id, body.classSubjectId),
      eq(classSubjects.tenantId, tenantId),
      eq(classSubjects.classId, sectionRow.classId),
      eq(classSubjects.subjectId, body.subjectId),
    )).limit(1);
    if (!classSubjectRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Cette matière n\'est pas assignée à la classe de cette section.');
    }

    const [teacherRow] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher'))).limit(1);
    if (!teacherRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    const [inserted] = await db
      .insert(subjectTeachers)
      .values({
        tenantId,
        classSectionId: body.classSectionId,
        subjectId: body.subjectId,
        classSubjectId: body.classSubjectId,
        teacherId: body.teacherId,
      })
      .returning();

    recordAudit(context, 'create', 'subject_teacher', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSubjectTeacher(inserted!) });
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

    await db.delete(subjectTeachers).where(and(eq(subjectTeachers.id, id), eq(subjectTeachers.tenantId, tenantId)));
    recordAudit(context, 'delete', 'subject_teacher', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
