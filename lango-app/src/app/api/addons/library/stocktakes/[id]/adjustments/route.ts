import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibraryContext } from '@/features/library/api/guard';
import { listStocktakeAdjustments } from '@/features/library/services/library-operations-service';

export async function GET(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.stocktake.manage');
    const { id } = await params;
    return NextResponse.json({ success: true, data: await listStocktakeAdjustments(tenantId, id) });
  } catch (e) { return apiErrorResponse(e); }
}
