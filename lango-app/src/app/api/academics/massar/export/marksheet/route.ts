import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { generateMassarMarksheet } from '@/features/academics/services/massar-sync-service';

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(ctx);

    const { searchParams } = new URL(request.url);
    const assessmentDefId = searchParams.get('assessmentDefId');

    if (!assessmentDefId) {
      return NextResponse.json({ success: false, message: 'assessmentDefId requis.' }, { status: 400 });
    }

    const { buffer, filename } = await generateMassarMarksheet(tenantId, assessmentDefId);

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
