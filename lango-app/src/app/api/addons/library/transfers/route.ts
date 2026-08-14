import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { createTransfer, listTransfers } from '@/features/library/services/library-operations-service';

const schema = z.object({ copyId: z.uuid(), toBranchId: z.uuid(), note: z.string().max(1000).nullable().optional() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.copy.manage');
    return NextResponse.json({ success: true, data: await listTransfers(tenantId) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const b = await parseJson(r, schema);
    const data = await createTransfer(tenantId, context.userId, b);
    recordAudit(context, 'create', 'library_transfer', data.id, { copyId: b.copyId, toBranchId: b.toBranchId });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
