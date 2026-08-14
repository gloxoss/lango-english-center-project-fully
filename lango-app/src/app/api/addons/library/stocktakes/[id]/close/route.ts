import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibraryContext } from '@/features/library/api/guard';
import { closeStocktake } from '@/features/library/services/library-operations-service';

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.stocktake.manage');
    const { id } = await params;
    const data = await closeStocktake(tenantId, context.userId, id);
    recordAudit(context, 'update', 'library_stocktake', data.id, { action: 'close', adjustmentsCreated: data.adjustmentsCreated, uncounted: data.uncounted });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
