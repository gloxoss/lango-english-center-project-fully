import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { branches, classSections, user } from '@/models/Schema';

const transferSchema = z.object({
  branchId: z.string().uuid(),
  classSectionId: z.string().uuid().optional(),
}).strict();

// Real branch-to-branch student transfer. `user.branchId` is a real, already
// -active field (it scopes GET /api/students for branch-scoped staff) - this
// is the first route that actually changes it after admission. The old
// classSectionId belongs to the old branch, so it's cleared unless a real
// section in the new branch is provided in the same request.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');
    const { id: studentId } = await params;
    const body = await parseJson(request, transferSchema);

    const [student] = await db.select({ id: user.id, branchId: user.branchId }).from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Élève introuvable pour cet établissement.');
    }

    const [branch] = await db.select({ id: branches.id }).from(branches)
      .where(and(eq(branches.id, body.branchId), eq(branches.tenantId, tenantId)))
      .limit(1);
    if (!branch) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La branche indiquée n\'existe pas pour cet établissement.');
    }

    if (body.classSectionId) {
      const [section] = await db.select({ id: classSections.id }).from(classSections)
        .where(and(eq(classSections.id, body.classSectionId), eq(classSections.tenantId, tenantId)))
        .limit(1);
      if (!section) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'La classe indiquée n\'existe pas pour cet établissement.');
      }
    }

    if (student.branchId === body.branchId) {
      throw new ApiError(409, 'SAME_BRANCH', 'Cet élève est déjà affecté à cette branche.');
    }

    const [updated] = await db.update(user)
      .set({ branchId: body.branchId, classSectionId: body.classSectionId ?? null })
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'student_transfer', studentId, { fromBranchId: student.branchId, toBranchId: body.branchId });

    return NextResponse.json({ success: true, data: updated, message: 'Élève transféré avec succès.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
