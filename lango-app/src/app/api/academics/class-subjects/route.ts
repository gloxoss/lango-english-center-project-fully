import { and, count, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { classSubjectCreateSchema, classSubjectUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assessmentPlans, classes, classScheduleSlots, classSubjects, semesters, subjectTeachers, subjects } from '@/models/Schema';

function toApiClassSubject(row: typeof classSubjects.$inferSelect) {
  return {
    id: row.id,
    classId: row.classId,
    subjectId: row.subjectId,
    type: row.type,
    semesterId: row.semesterId,
    offeringId: row.offeringId,
    weeklyMinutes: row.weeklyMinutes,
    displayOrder: row.displayOrder,
    coefficient: row.coefficient,
    passThreshold: row.passThreshold,
    isActive: row.isActive,
    curriculumLabel: row.curriculumLabel,
    schoolId: row.tenantId,
  };
}

async function assertReferencesBelongToTenant(tenantId: string, refs: { classId: string; subjectId: string; semesterId?: string | null }) {
  const [classRow] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, refs.classId), eq(classes.tenantId, tenantId))).limit(1);
  if (!classRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
  }
  const [subjectRow] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, refs.subjectId), eq(subjects.tenantId, tenantId))).limit(1);
  if (!subjectRow) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La matière indiquée n\'existe pas pour cet établissement.');
  }
  if (refs.semesterId) {
    const [semesterRow] = await db.select({ id: semesters.id }).from(semesters).where(and(eq(semesters.id, refs.semesterId), eq(semesters.tenantId, tenantId))).limit(1);
    if (!semesterRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le semestre indiqué n\'existe pas pour cet établissement.');
    }
  }
}

async function assertNotAlreadyAssigned(tenantId: string, classId: string, subjectId: string, semesterId: string | null | undefined, excludeId?: string) {
  const semesterCondition = semesterId
    ? eq(classSubjects.semesterId, semesterId)
    : isNull(classSubjects.semesterId);

  const conditions = [
    eq(classSubjects.tenantId, tenantId),
    eq(classSubjects.classId, classId),
    eq(classSubjects.subjectId, subjectId),
    semesterCondition,
  ];

  const [existing] = await db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(...conditions))
    .limit(1);

  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, 'ALREADY_EXISTS', 'Cette matière est déjà assignée à cette classe pour ce semestre.');
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant', 'receptionist']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const classId = searchParams.get('classId');
    const offeringId = searchParams.get('offeringId');

    const conditions = [eq(classSubjects.tenantId, tenantId)];
    if (classId) conditions.push(eq(classSubjects.classId, classId));
    if (offeringId) conditions.push(eq(classSubjects.offeringId, offeringId));

    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: classSubjects.id,
          classId: classSubjects.classId,
          subjectId: classSubjects.subjectId,
          type: classSubjects.type,
          semesterId: classSubjects.semesterId,
          offeringId: classSubjects.offeringId,
          weeklyMinutes: classSubjects.weeklyMinutes,
          displayOrder: classSubjects.displayOrder,
          coefficient: classSubjects.coefficient,
          passThreshold: classSubjects.passThreshold,
          isActive: classSubjects.isActive,
          curriculumLabel: classSubjects.curriculumLabel,
          tenantId: classSubjects.tenantId,
          subjectName: subjects.name,
        })
        .from(classSubjects)
        .leftJoin(subjects, eq(classSubjects.subjectId, subjects.id))
        .where(where)
        .orderBy(classSubjects.displayOrder)
        .limit(pagination.limit)
        .offset(pagination.offset),
      db.select({ total: count() }).from(classSubjects).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({ ...toApiClassSubject(r as any), subjectName: r.subjectName })),
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
    const body = await parseJson(request, classSubjectCreateSchema);

    await assertReferencesBelongToTenant(tenantId, { classId: body.classId, subjectId: body.subjectId, semesterId: body.semesterId });
    await assertNotAlreadyAssigned(tenantId, body.classId, body.subjectId, body.semesterId);

    const [inserted] = await db
      .insert(classSubjects)
      .values({
        tenantId,
        classId: body.classId,
        subjectId: body.subjectId,
        type: body.type,
        semesterId: body.semesterId,
        offeringId: body.offeringId ?? null,
        weeklyMinutes: body.weeklyMinutes ?? null,
        displayOrder: body.displayOrder ?? 0,
        coefficient: body.coefficient ? body.coefficient.toString() : '1.00',
        passThreshold: body.passThreshold ? body.passThreshold.toString() : null,
        isActive: body.isActive ?? true,
        curriculumLabel: body.curriculumLabel ?? null,
      })
      .returning();

    recordAudit(context, 'create', 'class_subject', inserted!.id);

    return NextResponse.json({ success: true, data: toApiClassSubject(inserted!) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, classSubjectUpdateSchema);

    const [existing] = await db.select().from(classSubjects).where(and(eq(classSubjects.id, body.id), eq(classSubjects.tenantId, tenantId))).limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Matière assignée introuvable.');
    }

    const classId = body.classId ?? existing.classId;
    const subjectId = body.subjectId ?? existing.subjectId;
    const semesterId = body.semesterId !== undefined ? body.semesterId : existing.semesterId;

    if (body.classId || body.subjectId) {
      await assertReferencesBelongToTenant(tenantId, { classId, subjectId, semesterId });
      await assertNotAlreadyAssigned(tenantId, classId, subjectId, semesterId, body.id);
    }

    const updatePayload: Record<string, any> = {
      classId,
      subjectId,
      type: body.type ?? existing.type,
      semesterId,
      updatedAt: new Date().toISOString(),
    };
    if (body.offeringId !== undefined) updatePayload.offeringId = body.offeringId;
    if (body.weeklyMinutes !== undefined) updatePayload.weeklyMinutes = body.weeklyMinutes;
    if (body.displayOrder !== undefined) updatePayload.displayOrder = body.displayOrder;
    if (body.coefficient !== undefined) updatePayload.coefficient = body.coefficient ? body.coefficient.toString() : '1.00';
    if (body.passThreshold !== undefined) updatePayload.passThreshold = body.passThreshold ? body.passThreshold.toString() : null;
    if (body.isActive !== undefined) updatePayload.isActive = body.isActive;
    if (body.curriculumLabel !== undefined) updatePayload.curriculumLabel = body.curriculumLabel;

    const [updated] = await db
      .update(classSubjects)
      .set(updatePayload)
      .where(and(eq(classSubjects.id, body.id), eq(classSubjects.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'class_subject', body.id);

    return NextResponse.json({ success: true, data: toApiClassSubject(updated!) });
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
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de la matière assignée est requis.');
    }

    const [existing] = await db.select().from(classSubjects).where(and(eq(classSubjects.id, id), eq(classSubjects.tenantId, tenantId))).limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Matière assignée introuvable.');
    }

    // Protected Deletion Check: check references in assessmentPlans, subjectTeachers, classScheduleSlots
    const [assessmentCount] = await db
      .select({ count: count() })
      .from(assessmentPlans)
      .where(and(eq(assessmentPlans.tenantId, tenantId), eq(assessmentPlans.classSubjectId, id)));

    const [subjectTeacherCount] = await db
      .select({ count: count() })
      .from(subjectTeachers)
      .where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.classSubjectId, id)));

    const [scheduleSlotCount] = await db
      .select({ count: count() })
      .from(classScheduleSlots)
      .where(and(eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.classSubjectId, id)));

    const totalDependents = (assessmentCount?.count ?? 0) + (subjectTeacherCount?.count ?? 0) + (scheduleSlotCount?.count ?? 0);

    if (totalDependents > 0) {
      throw new ApiError(409, 'IN_USE', 'Impossible de supprimer cette matière : elle est liée à des données académiques existantes.');
    }

    await db.delete(classSubjects).where(and(eq(classSubjects.id, id), eq(classSubjects.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class_subject', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
