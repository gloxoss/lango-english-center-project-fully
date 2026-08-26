import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { TeacherQuestionBankService } from '@/features/assessment/services/teacher-question-bank-service';

const updateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().trim().optional(),
  attachmentUrl: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict();

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const { id } = await params;
    const body = await parseJson(req, updateSchema);

    const updated = await TeacherQuestionBankService.update({
      tenantId,
      itemId: id,
      ...body,
    });

    recordAudit(context, 'update', 'teacher_question_bank_item', id);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const { id } = await params;

    await TeacherQuestionBankService.remove({ tenantId, itemId: id });

    recordAudit(context, 'delete', 'teacher_question_bank_item', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
