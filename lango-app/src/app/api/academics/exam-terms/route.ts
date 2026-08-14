import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { examTerms } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createExamTermSchema = z.object({
  sessionYearId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(1).max(50),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const terms = await db.select().from(examTerms).where(eq(examTerms.tenantId, tenantId)).orderBy(desc(examTerms.createdAt));
    return NextResponse.json({ success: true, data: terms });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createExamTermSchema);

    const term = await ExamMasterService.createExamTerm({ tenantId, ...body });
    recordAudit(context, 'create', 'exam_term', term!.id, { name: body.name });

    return NextResponse.json({ success: true, data: term }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
