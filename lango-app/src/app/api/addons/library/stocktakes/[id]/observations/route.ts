import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { observeCopy } from '@/features/library/services/library-operations-service';

const schema = z.object({ copyId: z.uuid(), found: z.boolean(), note: z.string().max(1000).nullable().optional() }).strict();

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.stocktake.manage');
    const { id } = await params;
    const b = await parseJson(r, schema);
    const data = await observeCopy(tenantId, context.userId, id, b.copyId, b.found, b.note);
    recordAudit(context, 'update', 'library_stocktake_observation', data.id, { stocktakeId: id, copyId: b.copyId, found: b.found });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
