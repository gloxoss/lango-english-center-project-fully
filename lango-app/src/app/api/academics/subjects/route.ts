import { and, count, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parsePagination } from '@/libs/api/pagination';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson, subjectCreateSchema, subjectUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSubjects, mediums, subjects, subjectTeachers } from '@/models/Schema';

function toApiSubject(row: typeof subjects.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    mediumId: row.mediumId,
    type: row.type,
    schoolId: row.tenantId,
  };
}

async function assertMediumBelongsToTenant(tenantId: string, mediumId: string) {
  const [row] = await db.select({ id: mediums.id }).from(mediums).where(and(eq(mediums.id, mediumId), eq(mediums.tenantId, tenantId))).limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'Le modèle linguistique indiqué n\'existe pas pour cet établissement.');
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const { searchParams } = new URL(request.url);
    const pagination = parsePagination(searchParams);
    const where = eq(subjects.tenantId, tenantId);

    const [rows, totalRows] = await Promise.all([
      db.select().from(subjects).where(where).limit(pagination.limit).offset(pagination.offset),
      db.select({ total: count() }).from(subjects).where(where),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map(toApiSubject),
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
    const body = await parseJson(request, subjectCreateSchema);

    await assertMediumBelongsToTenant(tenantId, body.mediumId);

    const [inserted] = await db
      .insert(subjects)
      .values({ tenantId, name: body.name, code: body.code, mediumId: body.mediumId, type: body.type })
      .returning();

    recordAudit(context, 'create', 'subject', inserted!.id);

    return NextResponse.json({ success: true, data: toApiSubject(inserted!) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');
    const body = await parseJson(request, subjectUpdateSchema);

    if (body.mediumId) {
      await assertMediumBelongsToTenant(tenantId, body.mediumId);
    }

    const [updated] = await db
      .update(subjects)
      .set({
        name: body.name,
        code: body.code,
        mediumId: body.mediumId,
        type: body.type,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(subjects.id, body.id), eq(subjects.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    recordAudit(context, 'update', 'subject', body.id);

    return NextResponse.json({ success: true, data: toApiSubject(updated) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Reference safety: a subject is the authoritative catalogue row behind
 * class_subjects (curriculum + coefficients) and teacher assignments.
 * Assessments and grades hang off class_subjects, so deleting a referenced
 * subject would orphan that whole context.
 *
 * attendance.subject_id references the legacy `courses` table in the current
 * schema, NOT the subjects catalogue — it is deliberately not claimed here.
 */
export async function subjectDependencyBlockers(tenantId: string, subjectId: string) {
  const [classSubjectRows, subjectTeacherRows] = await Promise.all([
    db.select({ n: count() }).from(classSubjects).where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.subjectId, subjectId))),
    db.select({ n: count() }).from(subjectTeachers).where(and(eq(subjectTeachers.tenantId, tenantId), eq(subjectTeachers.subjectId, subjectId))),
  ]);

  return [
    { key: 'class_subjects', count: Number(classSubjectRows[0]?.n ?? 0) },
    { key: 'subject_teacher_assignments', count: Number(subjectTeacherRows[0]?.n ?? 0) },
  ].filter(blocker => blocker.count > 0);
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

    const [existing] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId))).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Introuvable' }, { status: 404 });
    }

    const blockers = await subjectDependencyBlockers(tenantId, id);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SUBJECT_IN_USE',
            message: 'Cette matière est utilisée par le curriculum, des affectations ou des présences et ne peut pas être supprimée.',
          },
          blockers,
        },
        { status: 409 },
      );
    }

    await db.delete(subjects).where(and(eq(subjects.id, id), eq(subjects.tenantId, tenantId)));
    recordAudit(context, 'delete', 'subject', id);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
