import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { assignments, assignmentSubmissions, guardianStudents, guardians } from '@/models/Schema';

const submitAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  studentId: z.string().min(1),
  fileExt: z.string().max(10).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, submitAssignmentSchema);

    // Verify parent/student security constraint
    if (context.role === 'student' && body.studentId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Un élève ne peut soumettre un devoir que pour lui-même.');
    }

    if (context.role === 'parent') {
      // Validate parent guardian link to studentId
      const [link] = await db
        .select({ guardianId: guardians.id })
        .from(guardians)
        .innerJoin(guardianStudents, eq(guardianStudents.guardianId, guardians.id))
        .where(
          and(
            eq(guardians.userId, context.userId),
            eq(guardianStudents.studentId, body.studentId)
          )
        )
        .limit(1);

      if (!link) {
        throw new ApiError(403, 'FORBIDDEN', 'Vous n\'êtes pas associé à cet élève.');
      }
    }

    const [assignment] = await db
      .select()
      .from(assignments)
      .where(and(eq(assignments.id, body.assignmentId), eq(assignments.tenantId, tenantId)))
      .limit(1);

    if (!assignment) {
      throw new ApiError(404, 'NOT_FOUND', 'Devoir introuvable.');
    }

    const submittedAt = new Date().toISOString();
    const isLate = new Date(submittedAt) > new Date(assignment.dueDate);
    const status = isLate ? 'late' : 'submitted';

    const [submission] = await db
      .insert(assignmentSubmissions)
      .values({
        tenantId,
        assignmentId: body.assignmentId,
        studentId: body.studentId,
        submittedAt,
        fileExt: body.fileExt || null,
        status,
      })
      .onConflictDoUpdate({
        target: [assignmentSubmissions.assignmentId, assignmentSubmissions.studentId],
        set: {
          submittedAt,
          fileExt: body.fileExt || null,
          status,
        },
      })
      .returning();

    await recordAudit(context, 'create', 'assignment_submission', submission!.id);

    return NextResponse.json({
      success: true,
      data: submission,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
