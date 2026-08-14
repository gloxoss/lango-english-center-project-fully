import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { HomeworkService } from '@/features/assessment/services/homework-service';

const createHomeworkSchema = z.object({
  classSubjectId: z.string().uuid().optional(),
  sessionYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  maximumScore: z.number().positive().optional(),
  coefficient: z.number().positive().optional(),
  allowAttachments: z.boolean().optional(),
  maxAttachments: z.number().int().positive().optional(),
  lateSubmissionPolicy: z.enum(['reject', 'accept_flag', 'deduct_percentage']).optional(),
  closeAt: z.string().optional(),
  classOfferingIds: z.array(z.string().uuid()).optional(),
  sectionIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string()).optional(),
}).strict();

export async function GET(req: NextRequest) {
  try {
    const context = await requireRequestContext(req);
    const tenantId = requireTenant(context);

    const requestedStudentId = new URL(req.url).searchParams.get('studentId');
    const studentId = context.role === 'student' ? context.userId : (requestedStudentId ?? context.userId);
    if (context.role === 'student' && requestedStudentId && requestedStudentId !== context.userId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Vous ne disposez pas des autorisations nécessaires.' } }, { status: 403 });
    }

    const homeworkList = await HomeworkService.getHomeworkForStudent(tenantId, studentId);
    return NextResponse.json({ success: true, data: homeworkList });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(req, createHomeworkSchema);

    const created = await HomeworkService.createHomework({
      tenantId,
      ...body,
      createdBy: context.userId,
    });

    recordAudit(context, 'create', 'homework', created.id, { title: body.title });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
