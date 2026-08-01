import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { electiveGroupCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classes, electiveGroups, electiveGroupSubjects, subjects } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    const filters = [eq(electiveGroups.tenantId, tenantId)];
    if (classId) {
      filters.push(eq(electiveGroups.classId, classId));
    }

    const groups = await db.select().from(electiveGroups).where(and(...filters));
    const groupIds = groups.map(g => g.id);

    let subjectRows: { electiveGroupId: string; subjectId: string; subjectName: string }[] = [];
    if (groupIds.length > 0) {
      subjectRows = await db
        .select({ electiveGroupId: electiveGroupSubjects.electiveGroupId, subjectId: electiveGroupSubjects.subjectId, subjectName: subjects.name })
        .from(electiveGroupSubjects)
        .innerJoin(subjects, eq(electiveGroupSubjects.subjectId, subjects.id))
        .where(inArray(electiveGroupSubjects.electiveGroupId, groupIds));
    }

    const data = groups.map(g => ({
      ...g,
      subjects: subjectRows.filter(s => s.electiveGroupId === g.id).map(s => ({ id: s.subjectId, name: s.subjectName })),
    }));

    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, electiveGroupCreateSchema);

    const [classRow] = await db.select({ id: classes.id }).from(classes).where(and(eq(classes.id, body.classId), eq(classes.tenantId, tenantId))).limit(1);
    if (!classRow) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
    }
    const subjectRows = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.tenantId, tenantId)));
    const validSubjectIds = new Set(subjectRows.map(s => s.id));
    for (const subjectId of body.subjectIds) {
      if (!validSubjectIds.has(subjectId)) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'Une des matières indiquées n\'existe pas pour cet établissement.');
      }
    }

    const result = await db.transaction(async (tx) => {
      const [group] = await tx
        .insert(electiveGroups)
        .values({ tenantId, classId: body.classId, name: body.name, maxChoices: body.maxChoices ?? 1 })
        .returning();

      await tx.insert(electiveGroupSubjects).values(body.subjectIds.map(subjectId => ({ electiveGroupId: group!.id, subjectId })));

      return group;
    });

    recordAudit(context, 'create', 'elective_group', result!.id);

    return NextResponse.json({ success: true, data: result, message: 'Groupe de matières optionnelles créé avec succès' });
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

    await db.delete(electiveGroups).where(and(eq(electiveGroups.id, id), eq(electiveGroups.tenantId, tenantId)));
    recordAudit(context, 'delete', 'elective_group', id);

    return NextResponse.json({ success: true, message: 'Groupe supprimé', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
