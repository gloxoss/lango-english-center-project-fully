import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { HomeworkService } from '@/features/assessment/services/homework-service';

const gradeSchema = z.object({
  score: z.number().min(0),
  feedbackText: z.string().trim().max(2000).optional(),
}).strict();

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
