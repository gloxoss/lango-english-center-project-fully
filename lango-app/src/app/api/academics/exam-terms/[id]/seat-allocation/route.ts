import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { examTerms } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const seatAllocationSchema = z.object({
  studentIds: z.array(z.string()).min(1),
  examHallIds: z.array(z.string().uuid()).min(1),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'grading.manage');
    const body = await parseJson(request, seatAllocationSchema);

    const [term] = await db.select({ id: examTerms.id }).from(examTerms).where(and(eq(examTerms.id, id), eq(examTerms.tenantId, tenantId))).limit(1);
    if (!term) {
      throw new ApiError(404, 'NOT_FOUND', 'Session d\'examen introuvable.');
    }

    const validStudents = await db.select({ id: user.id }).from(user).where(and(inArray(user.id, body.studentIds), eq(user.tenantId, tenantId)));
    if (validStudents.length !== new Set(body.studentIds).size) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Un ou plusieurs élèves n\'appartiennent pas à cet établissement.');
    }

    const result = await ExamMasterService.generateSeatAllocations({
      tenantId,
      examTermId: id,
      studentIds: body.studentIds,
      examHallIds: body.examHallIds,
    });

    recordAudit(context, 'update', 'exam_seat_allocation', id, { allocatedCount: result.allocatedCount });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
