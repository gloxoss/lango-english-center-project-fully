import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assessmentDefinitions, examHalls, examSchedules, examTerms } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';

const createExamScheduleSchema = z.object({
  examTermId: z.string().uuid(),
  assessmentDefinitionId: z.string().uuid(),
  examHallId: z.string().uuid().optional(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  supervisorStaffIds: z.array(z.string()).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');

    const schedules = await db.select().from(examSchedules).where(eq(examSchedules.tenantId, tenantId)).orderBy(desc(examSchedules.startTime));
    return NextResponse.json({ success: true, data: schedules });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, createExamScheduleSchema);

    const [term] = await db.select({ id: examTerms.id }).from(examTerms).where(and(eq(examTerms.id, body.examTermId), eq(examTerms.tenantId, tenantId))).limit(1);
    if (!term) {
      throw new ApiError(404, 'NOT_FOUND', 'Session d\'examen introuvable.');
    }

    const [definition] = await db.select({ id: assessmentDefinitions.id }).from(assessmentDefinitions).where(and(eq(assessmentDefinitions.id, body.assessmentDefinitionId), eq(assessmentDefinitions.tenantId, tenantId))).limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Épreuve introuvable.');
    }

    if (body.examHallId) {
      const [hall] = await db.select({ id: examHalls.id }).from(examHalls).where(and(eq(examHalls.id, body.examHallId), eq(examHalls.tenantId, tenantId))).limit(1);
      if (!hall) {
        throw new ApiError(404, 'NOT_FOUND', 'Salle d\'examen introuvable.');
      }
    }

    let schedule;
    try {
      schedule = await ExamMasterService.createExamSchedule({ tenantId, ...body });
    } catch (serviceError) {
      // ExamMasterService throws a plain Error for a real hall-time conflict -
      // surface it as a proper 409, not a generic 500.
      const message = serviceError instanceof Error ? serviceError.message : 'Conflit de planification.';
      throw new ApiError(409, 'SCHEDULE_CONFLICT', message);
    }

    recordAudit(context, 'create', 'exam_schedule', schedule!.id, { examTermId: body.examTermId });

    return NextResponse.json({ success: true, data: schedule }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
