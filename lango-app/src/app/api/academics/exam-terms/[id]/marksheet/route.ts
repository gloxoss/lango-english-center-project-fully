import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessmentDefinitions } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params; // examTermId in the URL, not needed beyond route grouping - assessmentDefinitionId is the real scoping key
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
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
