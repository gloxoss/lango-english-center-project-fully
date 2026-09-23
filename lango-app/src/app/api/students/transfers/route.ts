import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { executeStudentTransfer } from '@/features/students/services/transfer-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { branches, classes, classSections, user } from '@/models/Schema';

const studentTransferSchema = z.object({
  studentId: z.string().min(1),
  targetClassSectionId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  sessionYearId: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional(),
  effectiveDate: z.string().optional(),
  transferType: z.enum(['Changement de classe', 'Changement de campus', 'Sortie définitive']).optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.read');

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get('classSectionId');

    const whereClause = and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      ...(classSectionId ? [eq(user.classSectionId, classSectionId)] : []),
    );

    const studentsList = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        classSectionId: user.classSectionId,
        matricule: user.matricule,
      })
      .from(user)
      .where(whereClause);

    return NextResponse.json({
      success: true,
      data: studentsList,
      total: studentsList.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    // Allow either students.placements.manage or students.update for unified compatibility
    await requireCapability(context, 'students.update');
    const body = await parseJson(request, studentTransferSchema);

    // Resolve target branch id
    let resolvedBranchId = body.branchId;

    if (!resolvedBranchId && body.targetClassSectionId) {
      const [sec] = await db
        .select({ branchId: classes.branchId })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .where(and(eq(classSections.id, body.targetClassSectionId), eq(classSections.tenantId, tenantId)))
        .limit(1);

      resolvedBranchId = sec?.branchId || undefined;
    }

    if (!resolvedBranchId) {
      // Fall back to student's current branch or default branch
      const [stu] = await db
        .select({ branchId: user.branchId })
        .from(user)
        .where(and(eq(user.id, body.studentId), eq(user.tenantId, tenantId)))
        .limit(1);

      resolvedBranchId = stu?.branchId || undefined;
    }

    if (!resolvedBranchId) {
      const [defBranch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)))
        .limit(1);

      resolvedBranchId = defBranch?.id;
    }

    if (!resolvedBranchId) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Aucun campus valide n\'a pu être déterminé pour cette mutation.');
    }

    const result = await executeStudentTransfer({
      tenantId,
      studentId: body.studentId,
      targetBranchId: resolvedBranchId,
      targetClassSectionId: body.targetClassSectionId,
      reason: body.reason || body.transferType || 'Mutation administrative',
      effectiveDate: body.effectiveDate,
      actor: {
        userId: context.userId,
        branchId: context.branchId,
        role: context.role,
        name: context.name,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
      warnings: result.warnings,
      message: result.message,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
