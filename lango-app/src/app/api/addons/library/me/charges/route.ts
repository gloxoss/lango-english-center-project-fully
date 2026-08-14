import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibrarySelfContext } from '@/features/library/api/guard';
import { listOwnCharges } from '@/features/library/services/library-service';

export async function GET(request: Request) {
  try {
    const { tenantId, context } = await requireLibrarySelfContext(request);
    return NextResponse.json({ success: true, data: await listOwnCharges(tenantId, context.userId) });
  } catch (e) { return apiErrorResponse(e); }
}
