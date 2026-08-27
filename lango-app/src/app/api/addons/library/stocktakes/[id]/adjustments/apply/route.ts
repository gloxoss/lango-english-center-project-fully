import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireLibraryContext } from '@/features/library/api/guard';
import { applyStocktakeAdjustments } from '@/features/library/services/library-operations-service';

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Approval-key gate: committing adjustments is the checker step, reserved
    // to school_admin — NOT the librarian-held stocktake.manage (W4 fix).
    const { tenantId, context } = await requireLibraryContext(r, 'library.stocktake.approve');
    const { id } = await params;
    const data = await applyStocktakeAdjustments(tenantId, context.userId, id);
    recordAudit(context, 'update', 'library_stocktake', id, { action: 'apply_adjustments', applied: data.length });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
