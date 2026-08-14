import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibrarySelfContext } from '@/features/library/api/guard';
import { listAccessibleChildren } from '@/features/library/services/library-service';

export async function GET(request: Request) {
  try {
    const { tenantId, context } = await requireLibrarySelfContext(request);
    return NextResponse.json({ success: true, data: await listAccessibleChildren(tenantId, context.userId) });
  } catch (e) { return apiErrorResponse(e); }
}
