import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { requireExamTermStage } from '@/features/assessment/services/exam-term-guard';
import { loadScopedMarksheet, writableStudentIds } from '@/features/assessment/services/marksheet-access';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const saveMarksheetSchema = z.object({
  assessmentDefinitionId: z.string().uuid(),
  marks: z.array(z.object({
    studentId: z.string(),
    rawScore: z.number().optional(),
    status: z.enum(['graded', 'exempted', 'absent', 'withheld']).optional(),
  })).min(1),
}).strict();

/**
 * The roster the marksheet grid is entered against: the definition's scale and
 * pass mark, its students, and whatever marks already exist.
 *
 * A teacher sees only students in the class sections they teach. Without that
 * filter the grid would be a roster of the whole school — every student's name
 * and national id — to anyone holding grading.manage.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params; // examTermId groups the route; assessmentDefinitionId is the scoping key
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const assessmentDefinitionId = new URL(request.url).searchParams.get('assessmentDefinitionId');
    if (!assessmentDefinitionId) {
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de l\'épreuve est requis.');
    }

    // Shared with the standalone grade-entry route, so the teacher filter exists
    // in one place rather than being implemented twice and forgotten once.
    const payload = await loadScopedMarksheet(context, tenantId, assessmentDefinitionId);
    if (!payload) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: examTermId } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    // Marks are only accepted once the term has reached correction. Before that
    // the papers have not been sat, so a "mark" would be a guess about an exam
    // that has not happened. The URL's term id used to be discarded here.
    await requireExamTermStage(tenantId, examTermId, 'enter_marks');

    const body = await parseJson(request, saveMarksheetSchema);

    const [definition] = await db.select({ id: assessmentDefinitions.id }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.id, body.assessmentDefinitionId), eq(assessmentDefinitions.tenantId, tenantId))).limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    const studentIds = body.marks.map(m => m.studentId);
    const validStudents = await db.select({ id: user.id }).from(user).where(and(inArray(user.id, studentIds), eq(user.tenantId, tenantId)));
    if (validStudents.length !== new Set(studentIds).size) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Un ou plusieurs élèves n\'appartiennent pas à cet établissement.');
    }

    // The GET scoped a teacher to their own sections; this did not, so any teacher
    // holding grading.manage could post a mark for any student in the school.
    // Refused whole rather than filtered: marks reach families, so a partially
    // accepted batch would leave a teacher believing they saved marks they had not.
    const writable = await writableStudentIds(context, tenantId, body.assessmentDefinitionId);
    if (writable) {
      const outside = studentIds.filter(id => !writable.has(id));
      if (outside.length > 0) {
        throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez saisir des notes que pour les élèves de vos classes.');
      }
    }

    const outcomes = await ExamMasterService.saveMarksheetGrid({
      tenantId,
      assessmentDefinitionId: body.assessmentDefinitionId,
      markerId: context.userId,
      marks: body.marks,
    });

    recordAudit(context, 'update', 'exam_marksheet', body.assessmentDefinitionId, { studentCount: body.marks.length });

    return NextResponse.json({ success: true, data: outcomes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
