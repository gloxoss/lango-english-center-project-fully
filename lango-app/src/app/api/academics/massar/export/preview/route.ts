import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { validateMassarStudentRoster } from '@/features/academics/services/massar-sync-service';

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(ctx);

    const body = await request.json().catch(() => ({}));
    const effectiveBranchId = ctx.branchId || body.branchId || undefined;

    const report = await validateMassarStudentRoster(tenantId, {
      classSectionId: body.classSectionId,
      branchId: effectiveBranchId,
      ctx,
      studentIds: body.studentIds,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
