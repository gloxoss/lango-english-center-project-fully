import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibraryContext } from '@/features/library/api/guard';
import { listActiveLoans } from '@/features/library/services/library-service';

export async function GET(request: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(request, 'library.circulation.operate');
    return NextResponse.json({ success: true, data: await listActiveLoans(tenantId, context) });
  } catch (e) { return apiErrorResponse(e); }
}
