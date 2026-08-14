import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { HomeworkService } from '@/features/assessment/services/homework-service';

const submitSchema = z.object({
  responseText: z.string().trim().max(10000).optional(),
  files: z.array(z.object({
    fileName: z.string(),
    fileUrl: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
  })).optional(),
}).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(req, ['student']);
    const tenantId = requireTenant(context);
    const { id } = await params;
    const body = await parseJson(req, submitSchema);

    const attempt = await HomeworkService.submitHomeworkAttempt({
      tenantId,
      assessmentDefinitionId: id,
      studentId: context.userId,
      responseText: body.responseText,
      files: body.files,
    });

    recordAudit(context, 'create', 'homework_attempt', attempt.id, { assessmentDefinitionId: id });

    return NextResponse.json({ success: true, data: attempt });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
