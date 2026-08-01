import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { electiveChoiceCreateSchema, parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { electiveGroups, electiveGroupSubjects, studentElectiveChoices, user } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const electiveGroupId = searchParams.get('electiveGroupId');

    const filters = [eq(studentElectiveChoices.tenantId, tenantId)];
    if (electiveGroupId) {
      filters.push(eq(studentElectiveChoices.electiveGroupId, electiveGroupId));
    }

    const rows = await db
      .select({
        id: studentElectiveChoices.id,
        studentId: studentElectiveChoices.studentId,
        studentName: user.name,
        electiveGroupId: studentElectiveChoices.electiveGroupId,
        subjectId: studentElectiveChoices.subjectId,
      })
      .from(studentElectiveChoices)
      .innerJoin(user, eq(studentElectiveChoices.studentId, user.id))
      .where(and(...filters));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, electiveChoiceCreateSchema);

    const [group] = await db.select().from(electiveGroups).where(and(eq(electiveGroups.id, body.electiveGroupId), eq(electiveGroups.tenantId, tenantId))).limit(1);
    if (!group) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Le groupe de matières optionnelles indiqué n\'existe pas.');
    }

    const [membership] = await db
      .select({ id: electiveGroupSubjects.id })
      .from(electiveGroupSubjects)
      .where(and(eq(electiveGroupSubjects.electiveGroupId, body.electiveGroupId), eq(electiveGroupSubjects.subjectId, body.subjectId)))
      .limit(1);
    if (!membership) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Cette matière ne fait pas partie de ce groupe.');
    }

    const [student] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId), eq(user.role, 'student'))).limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas.');
    }

    const existingChoices = await db
      .select({ id: studentElectiveChoices.id, subjectId: studentElectiveChoices.subjectId })
      .from(studentElectiveChoices)
      .where(and(eq(studentElectiveChoices.studentId, body.studentId), eq(studentElectiveChoices.electiveGroupId, body.electiveGroupId)));

    if (existingChoices.some(c => c.subjectId === body.subjectId)) {
      throw new ApiError(409, 'ALREADY_ASSIGNED', 'Cet élève a déjà choisi cette matière dans ce groupe.');
    }
    if (existingChoices.length >= group.maxChoices) {
      throw new ApiError(422, 'MAX_CHOICES_REACHED', `Cet élève a déjà atteint la limite de ${group.maxChoices} choix pour ce groupe.`);
    }

    const [inserted] = await db
      .insert(studentElectiveChoices)
      .values({ tenantId, studentId: body.studentId, electiveGroupId: body.electiveGroupId, subjectId: body.subjectId })
      .returning();

    recordAudit(context, 'create', 'student_elective_choice', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Choix enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await db.delete(studentElectiveChoices).where(and(eq(studentElectiveChoices.id, id), eq(studentElectiveChoices.tenantId, tenantId)));
    recordAudit(context, 'delete', 'student_elective_choice', id);

    return NextResponse.json({ success: true, message: 'Choix supprimé', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
