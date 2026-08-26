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

    // Students only ever see their own audience-matched assignments.
    if (context.role === 'student') {
      const requestedStudentId = new URL(req.url).searchParams.get('studentId');
      if (requestedStudentId && requestedStudentId !== context.userId) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Vous ne disposez pas des autorisations nécessaires.' } }, { status: 403 });
      }
      const homeworkList = await HomeworkService.getHomeworkForStudent(tenantId, context.userId);
      return NextResponse.json({ success: true, data: homeworkList });
    }

    // Staff-only branch: matches the question-bank pattern - the whole-tenant
    // list (with class/subject labels and submission counts) is for
    // teachers/school_admin/super_admin only; parent/guardian/accountant get 403.
    if (context.role !== 'school_admin' && context.role !== 'super_admin' && context.role !== 'teacher') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Vous ne disposez pas des autorisations nécessaires.' } }, { status: 403 });
    }

    // Drill into one student's list via ?studentId=, otherwise the whole-tenant
    // teaching hub list.
    const requestedStudentId = new URL(req.url).searchParams.get('studentId');
    if (requestedStudentId) {
      const homeworkList = await HomeworkService.getHomeworkForStudent(tenantId, requestedStudentId);
      return NextResponse.json({ success: true, data: homeworkList });
    }

    const homeworkList = await HomeworkService.listHomeworkForTeacher(tenantId);
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
