import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { listStocktakes, startStocktake } from '@/features/library/services/library-operations-service';

const schema = z.object({ branchId: z.uuid() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.stocktake.manage');
    return NextResponse.json({ success: true, data: await listStocktakes(tenantId) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.stocktake.manage');
    const { branchId } = await parseJson(r, schema);
    const data = await startStocktake(tenantId, context.userId, branchId);
    recordAudit(context, 'create', 'library_stocktake', data.id, { branchId });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
