import { NextRequest, NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { TeacherQuestionBankService } from '@/features/assessment/services/teacher-question-bank-service';

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const created = await TeacherQuestionBankService.seedDefaultTemplates(tenantId, context.userId);

    recordAudit(context, 'create', 'teacher_question_bank_item', 'bulk-seed', {
      count: created.length,
      action: 'seed_default_templates',
    });

    const allItems = await TeacherQuestionBankService.list(tenantId);
    return NextResponse.json({ success: true, data: allItems, count: created.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
