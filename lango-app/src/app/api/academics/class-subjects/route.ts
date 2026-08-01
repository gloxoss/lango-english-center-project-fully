import { and, count, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { classSubjectCreateSchema, classSubjectUpdateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, classSubjects, semesters, subjects } from '@/models/Schema';

function toApiClassSubject(row: typeof classSubjects.$inferSelect) {
  return {
    id: row.id,
    classId: row.classId,
    subjectId: row.subjectId,
    type: row.type,
    semesterId: row.semesterId,
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

// No DB-level unique constraint covers (classId, subjectId, semesterId) - a
// nullable semesterId column has NULL-distinctness semantics that would let
// duplicate whole-year (semesterId = null) rows through a unique index anyway.
// A duplicate is the same class+subject for the same semester scope (including
// two "whole year" rows both with semesterId = null); a class may legitimately
// have the same subject assigned separately per semester.
async function assertNotAlreadyAssigned(tenantId: string, classId: string, subjectId: string, semesterId: string | null | undefined, excludeId?: string) {
  const semesterCondition = semesterId
    ? eq(classSubjects.semesterId, semesterId)
    : isNull(classSubjects.semesterId);

  const [existing] = await db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(
      eq(classSubjects.tenantId, tenantId),
      eq(classSubjects.classId, classId),
      eq(classSubjects.subjectId, subjectId),
      semesterCondition,
    ))
    .limit(1);

  if (existing && existing.id !== excludeId) {
    throw new ApiError(409, 'ALREADY_ASSIGNED', 'Cette matière est déjà assignée à cette classe pour ce semestre.');
  }
}

export async function GET(request: Request) {
  try {
    // ponytail: teachers need read access for grade-entry class/subject
    // pickers - writes stay school_admin-only below.
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(classSubjects.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(classSubjects).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(classSubjects).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiClassSubject),
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
    const body = await parseJson(request, classSubjectCreateSchema);

    await assertReferencesBelongToTenant(tenantId, body);
    await assertNotAlreadyAssigned(tenantId, body.classId, body.subjectId, body.semesterId);

    const [inserted] = await db
      .insert(classSubjects)
      .values({
        tenantId,
        classId: body.classId,
        subjectId: body.subjectId,
        type: body.type,
        semesterId: body.semesterId,
      })
      .returning();

    recordAudit(context, 'create', 'class_subject', inserted!.id);

    return NextResponse.json({ success: true, data: toApiClassSubject(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, classSubjectUpdateSchema);

    const [existing] = await db.select().from(classSubjects).where(and(eq(classSubjects.id, body.id), eq(classSubjects.tenantId, tenantId))).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const classId = body.classId ?? existing.classId;
    const subjectId = body.subjectId ?? existing.subjectId;
    const semesterId = body.semesterId !== undefined ? body.semesterId : existing.semesterId;

    if (body.classId || body.subjectId) {
      await assertReferencesBelongToTenant(tenantId, { classId, subjectId, semesterId });
      await assertNotAlreadyAssigned(tenantId, classId, subjectId, semesterId, body.id);
    }

    const [updated] = await db
      .update(classSubjects)
      .set({ classId, subjectId, type: body.type, semesterId, updatedAt: new Date().toISOString() })
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(classSubjects).where(and(eq(classSubjects.id, id), eq(classSubjects.tenantId, tenantId)));
    recordAudit(context, 'delete', 'class_subject', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
