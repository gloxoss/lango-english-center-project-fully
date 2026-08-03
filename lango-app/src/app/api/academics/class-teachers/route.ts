import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { classTeacherCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSections, classTeachers, user } from '@/models/Schema';

// ponytail: pure join record, no PUT - reassignment is delete + recreate.

function toApiClassTeacher(row: typeof classTeachers.$inferSelect) {
  return {
    id: row.id,
    classSectionId: row.classSectionId,
    teacherId: row.teacherId,
    schoolId: row.tenantId,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(classTeachers.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(classTeachers).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(classTeachers).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiClassTeacher),
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
    const body = await parseJson(request, classTeacherCreateSchema);

    const [sectionRow] = await db.select({ id: classSections.id }).from(classSections).where(and(eq(classSections.id, body.classSectionId), eq(classSections.tenantId, tenantId))).limit(1);
    if (!sectionRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe indiquée n\'existe pas pour cet établissement.');
    }

    const [teacherRow] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher'))).limit(1);
    if (!teacherRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    const [inserted] = await db
      .insert(classTeachers)
      .values({ tenantId, classSectionId: body.classSectionId, teacherId: body.teacherId })
      .returning();

    recordAudit(context, 'create', 'class_teacher', inserted!.id);

    return NextResponse.json({ success: true, data: toApiClassTeacher(inserted!) });
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

    await db.delete(classTeachers).where(and(eq(classTeachers.id, id), eq(classTeachers.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class_teacher', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
