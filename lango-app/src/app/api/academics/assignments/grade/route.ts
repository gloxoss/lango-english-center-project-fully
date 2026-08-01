import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assignments, assignmentSubmissions } from '@/models/Schema';

const gradeAssignmentSchema = z.object({
  submissionId: z.string().uuid(),
  score: z.number().min(0),
  feedback: z.string().trim().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, gradeAssignmentSchema);

    const [sub] = await db
      .select({
        id: assignmentSubmissions.id,
        assignmentId: assignmentSubmissions.assignmentId,
      })
      .from(assignmentSubmissions)
      .where(and(eq(assignmentSubmissions.id, body.submissionId), eq(assignmentSubmissions.tenantId, tenantId)))
      .limit(1);

    if (!sub) {
      throw new ApiError(404, 'NOT_FOUND', 'Soumission introuvable.');
    }

    const [assignment] = await db
      .select({ maxScore: assignments.maxScore })
      .from(assignments)
      .where(eq(assignments.id, sub.assignmentId))
      .limit(1);

    if (assignment && body.score > Number(assignment.maxScore)) {
      throw new ApiError(422, 'VALIDATION_ERROR', `La note ne peut pas dépasser la note maximale (${assignment.maxScore}).`);
    }

    const [updated] = await db
      .update(assignmentSubmissions)
      .set({
        score: String(body.score),
        feedback: body.feedback || null,
        status: 'graded',
      })
      .where(and(eq(assignmentSubmissions.id, body.submissionId), eq(assignmentSubmissions.tenantId, tenantId)))
      .returning();

    await recordAudit(context, 'update', 'assignment_grading', body.submissionId);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
