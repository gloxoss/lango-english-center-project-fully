import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { classTeacherCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { reassignClassTeacher } from '@/libs/services/class-teacher-assignment';
import { classes, classSections, classTeachers, user } from '@/models/Schema';

function toApiClassTeacher(row: typeof classTeachers.$inferSelect) {
  return {
    id: row.id,
    classSectionId: row.classSectionId,
    offeringId: row.offeringId,
    teacherId: row.teacherId,
    role: row.role,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    status: row.status,
    assignedBy: row.assignedBy,
    notes: row.notes,
    schoolId: row.tenantId,
  };
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const offeringId = searchParams.get('offeringId');
    const classSectionId = searchParams.get('classSectionId');

    const conditions = [eq(classTeachers.tenantId, tenantId)];
    if (offeringId) {
      conditions.push(eq(classTeachers.offeringId, offeringId));
    }
    if (classSectionId) {
      conditions.push(eq(classTeachers.classSectionId, classSectionId));
    }

    const where = and(...conditions);

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

    const [sectionRow] = await db
      .select({ id: classSections.id, branchId: classes.branchId })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(and(eq(classSections.id, body.classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);

    if (!sectionRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe indiquée n\'existe pas pour cet établissement.');
    }

    const [teacherRow] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, body.teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .limit(1);

    if (!teacherRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    // Cross-campus teaching needs an explicit model; until one exists, a
    // branch-pinned teacher cannot be assigned to another branch's class.
    // A null branch means "whole-school / not yet assigned" and stays allowed.
    if (teacherRow.branchId && sectionRow.branchId && teacherRow.branchId !== sectionRow.branchId) {
      throw new ApiError(422, 'CROSS_BRANCH_ASSIGNMENT', 'Cet enseignant appartient à un autre campus que cette classe.');
    }

    const assigned = await reassignClassTeacher({
      tenantId,
      classSectionId: body.classSectionId,
      offeringId: body.offeringId ?? null,
      teacherId: body.teacherId,
      role: body.role ?? 'primary',
      assignedBy: context.userId,
      notes: body.notes ?? null,
    });

    recordAudit(context, 'create', 'class_teacher', assigned.id);

    return NextResponse.json({ success: true, data: toApiClassTeacher(assigned) }, { status: 201 });
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
