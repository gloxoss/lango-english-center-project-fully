import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibrarySelfContext } from '@/features/library/api/guard';
import { cancelOwnHold, listOwnHolds } from '@/features/library/services/library-service';

const schema = z.object({ holdId: z.uuid(), reason: z.string().trim().min(3).max(500) }).strict();

export async function GET(request: Request) {
  try {
    const { tenantId, context } = await requireLibrarySelfContext(request);
    return NextResponse.json({ success: true, data: await listOwnHolds(tenantId, context.userId) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(request: Request) {
  try {
    const { tenantId, context } = await requireLibrarySelfContext(request);
    const b = await parseJson(request, schema);
    const data = await cancelOwnHold(tenantId, context.userId, b.holdId, b.reason);
    recordAudit(context, 'update', 'library_hold', data.id, { action: 'cancel', selfService: true, reason: b.reason });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
