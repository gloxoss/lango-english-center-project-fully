import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { generateMassarStudentRoster } from '@/features/academics/services/massar-sync-service';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(ctx);

    const { searchParams } = new URL(request.url);
    const classSectionId = searchParams.get('classSectionId') || undefined;
    const effectiveBranchId = ctx.branchId || searchParams.get('branchId') || undefined;
    const studentIdsParam = searchParams.get('studentIds');
    const studentIds = studentIdsParam ? studentIdsParam.split(',').filter(Boolean) : undefined;
    const onlyValid = searchParams.get('onlyValid') === 'true';

    const { buffer, filename } = await generateMassarStudentRoster(tenantId, {
      classSectionId,
      branchId: effectiveBranchId,
      ctx,
      studentIds,
      onlyValid,
    });

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
