import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { TeacherQuestionBankService } from '@/features/assessment/services/teacher-question-bank-service';

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  content: z.string().trim().optional(),
  attachmentUrl: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const items = await TeacherQuestionBankService.list(tenantId);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(req, createSchema);

    const created = await TeacherQuestionBankService.create({
      tenantId,
      createdById: context.userId,
      title: body.title,
      content: body.content,
      attachmentUrl: body.attachmentUrl,
      tags: body.tags,
    });

    recordAudit(context, 'create', 'teacher_question_bank_item', created.id, { title: body.title });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
