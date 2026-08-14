import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { transitionTransfer } from '@/features/library/services/library-operations-service';

const schema = z.object({ action: z.enum(['dispatch', 'receive', 'cancel', 'report_discrepancy']) }).strict();

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.copy.manage');
    const { id } = await params;
    const { action } = await parseJson(r, schema);
    const data = await transitionTransfer(tenantId, context.userId, id, action);
    recordAudit(context, 'update', 'library_transfer', data.id, { action });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
