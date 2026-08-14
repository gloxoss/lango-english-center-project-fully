import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { cancelHold } from '@/features/library/services/library-operations-service';

const schema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

export async function POST(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.hold.manage');
    const { id } = await params;
    const { reason } = await parseJson(r, schema);
    const data = await cancelHold(tenantId, context.userId, id, reason);
    recordAudit(context, 'update', 'library_hold', data.id, { action: 'cancel', reason });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
