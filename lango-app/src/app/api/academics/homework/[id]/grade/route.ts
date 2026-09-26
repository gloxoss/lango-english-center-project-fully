import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant , type RequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assessmentDefinitions, homeworkAttempts } from '@/features/assessment/models/assessment-schema';
import { classes, classSubjects } from '@/models/Schema';
import { HomeworkService } from '@/features/assessment/services/homework-service';
import { assertBranchScope } from '@/libs/api/portal-scope';

const gradeSchema = z.object({
  score: z.number().min(0),
  feedbackText: z.string().trim().max(2000).optional(),
}).strict();

/** Campus lock: homework lives on the campus of the class behind its subject. */
async function assertHomeworkCampus(context: RequestContext, tenantId: string, homeworkId: string) {
  const [campus] = await db
    .select({ branchId: classes.branchId })
    .from(assessmentDefinitions)
    .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))
    .leftJoin(classes, eq(classSubjects.classId, classes.id))
    .where(and(eq(assessmentDefinitions.id, homeworkId), eq(assessmentDefinitions.tenantId, tenantId)))
    .limit(1);
  assertBranchScope(context, campus?.branchId ?? null);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const { id } = await params;
    const body = await parseJson(req, gradeSchema);

    // Teachers may only grade homework they authored; admins override.
    if (context.role !== 'school_admin' && context.role !== 'super_admin') {
      const [owned] = await db
        .select({ createdBy: assessmentDefinitions.createdBy })
        .from(homeworkAttempts)
        .innerJoin(assessmentDefinitions, eq(homeworkAttempts.assessmentDefinitionId, assessmentDefinitions.id))
        .where(and(eq(homeworkAttempts.id, id), eq(assessmentDefinitions.tenantId, tenantId)))
        .limit(1);
      if (!owned || owned.createdBy !== context.userId) {
        throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez noter que vos propres devoirs.');
      }
    }

    await assertHomeworkCampus(context, tenantId, id);
    const graded = await HomeworkService.gradeHomeworkAttempt({
      tenantId,
      attemptId: id,
      score: body.score,
      feedbackText: body.feedbackText,
      gradedBy: context.userId,
    });

    recordAudit(context, 'update', 'homework_attempt', id, { score: body.score });

    return NextResponse.json({ success: true, data: graded });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
