import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { loadScopedMarksheet, writableStudentIds } from '@/features/assessment/services/marksheet-access';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

/**
 * Standalone grade entry, for marking an assessment that is not part of an exam
 * term.
 *
 * The page this backs used to render a hardcoded student exam-taking mock — ten
 * invented maths questions with pre-filled answers — behind the `grading.read`
 * guard, so a teacher clicking "Saisie des notes" got a fake paper and no way to
 * record a mark. This is the real endpoint.
 *
 * Separate from the exam-term marksheet on purpose: that route enforces the
 * term's workflow stage (marks only during `valuation`), which is meaningless for
 * a continuous-assessment mark with no term behind it.
 */
const saveGradesSchema = z.object({
  assessmentDefinitionId: z.string().uuid(),
  marks: z.array(z.object({
    studentId: z.string().min(1),
    rawScore: z.number().nonnegative().optional(),
    status: z.enum(['graded', 'exempted', 'absent', 'withheld']).optional(),
  })).min(1).max(500),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.read');

    const assessmentDefinitionId = new URL(request.url).searchParams.get('assessmentDefinitionId');
    if (!assessmentDefinitionId) {
      throw new ApiError(400, 'BAD_REQUEST', 'L\'identifiant de l\'épreuve est requis.');
    }

    const payload = await loadScopedMarksheet(context, tenantId, assessmentDefinitionId);
    if (!payload) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const body = await parseJson(request, saveGradesSchema);

    const [definition] = await db
      .select({ id: assessmentDefinitions.id, maximumScore: assessmentDefinitions.maximumScore })
      .from(assessmentDefinitions)
      .where(and(
        eq(assessmentDefinitions.id, body.assessmentDefinitionId),
        eq(assessmentDefinitions.tenantId, tenantId),
      ))
      .limit(1);

    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    const studentIds = [...new Set(body.marks.map(m => m.studentId))];

    const owned = await db
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.id, studentIds), eq(user.tenantId, tenantId), eq(user.role, 'student')));

    if (owned.length !== studentIds.length) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Un ou plusieurs élèves n\'appartiennent pas à cet établissement.');
    }

    // A teacher may only mark students in the sections they teach. Refused whole
    // rather than filtered: marks reach families, so silently dropping part of a
    // batch would leave a teacher believing they had saved marks they had not.
    const writable = await writableStudentIds(context, tenantId, body.assessmentDefinitionId);
    if (writable) {
      const outside = studentIds.filter(id => !writable.has(id));
      if (outside.length > 0) {
        throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez saisir des notes que pour les élèves de vos classes.');
      }
    }

    // A score above the paper's maximum silently skews every average computed
    // from it, so it is refused here as well as in the grid.
    const maximumScore = Number(definition.maximumScore);
    const overMax = body.marks.filter(m => m.rawScore !== undefined && m.rawScore > maximumScore);
    if (overMax.length > 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', `Une note dépasse le barème de l'épreuve (${maximumScore}).`);
    }

    const outcomes = await ExamMasterService.saveMarksheetGrid({
      tenantId,
      assessmentDefinitionId: body.assessmentDefinitionId,
      markerId: context.userId,
      marks: body.marks,
    });

    recordAudit(context, 'update', 'grade_entry', body.assessmentDefinitionId, { studentCount: body.marks.length });

    return NextResponse.json({ success: true, data: outcomes });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
