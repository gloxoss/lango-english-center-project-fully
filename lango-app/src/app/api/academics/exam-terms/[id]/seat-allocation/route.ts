import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { requireExamTermStage } from '@/features/assessment/services/exam-term-guard';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope, branchWhere } from '@/libs/api/portal-scope';
import { examHalls } from '@/models/Schema';
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
    // Checked before the body is parsed: an operation the term's stage forbids
    // is refused outright, rather than first reporting which field was malformed
    // in a request that was never going to be allowed.
    //
    // Seating may only be (re)generated while the term is being scheduled:
    // regenerating deletes and rebuilds every allocation, so allowing it later
    // would move a candidate to a different desk mid-exam.
    await requireExamTermStage(tenantId, id, 'allocate_seats');

    const body = await parseJson(request, seatAllocationSchema);

    const validStudents = await db.select({ id: user.id }).from(user).where(and(inArray(user.id, body.studentIds), eq(user.tenantId, tenantId), branchWhere(context, user.branchId)));
    if (validStudents.length !== new Set(body.studentIds).size) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Un ou plusieurs élèves n\'appartiennent pas à cet établissement ou à votre campus.');
    }

    // Halls are branch-owned (exam_halls.branchId): a locked caller may only
    // seat candidates into their own campus halls.
    const halls = await db
      .select({ id: examHalls.id, branchId: examHalls.branchId })
      .from(examHalls)
      .where(and(inArray(examHalls.id, body.examHallIds), eq(examHalls.tenantId, tenantId)));
    if (halls.length !== new Set(body.examHallIds).size) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Une ou plusieurs salles sont introuvables.');
    }
    for (const hall of halls) {
      assertBranchScope(context, hall.branchId);
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
