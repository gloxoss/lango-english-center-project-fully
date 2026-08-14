import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { examHalls } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createExamHallSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(1).max(50),
  capacity: z.number().int().positive().optional(),
  isAccessible: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const halls = await db.select().from(examHalls).where(eq(examHalls.tenantId, tenantId)).orderBy(desc(examHalls.createdAt));
    return NextResponse.json({ success: true, data: halls });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createExamHallSchema);

    const hall = await ExamMasterService.createExamHall({ tenantId, ...body });
    recordAudit(context, 'create', 'exam_hall', hall!.id, { name: body.name });

    return NextResponse.json({ success: true, data: hall }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
