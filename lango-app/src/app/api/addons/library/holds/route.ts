import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { listHolds, placeHold } from '@/features/library/services/library-operations-service';

const schema = z.object({ copyId: z.uuid(), memberId: z.uuid() }).strict();

export async function GET(r: Request) {
  try {
    const { tenantId } = await requireLibraryContext(r, 'library.hold.manage');
    return NextResponse.json({ success: true, data: await listHolds(tenantId) });
  } catch (e) { return apiErrorResponse(e); }
}

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(r, 'library.hold.manage');
    const b = await parseJson(r, schema);
    const data = await placeHold(tenantId, context.userId, b.copyId, b.memberId);
    recordAudit(context, 'create', 'library_hold', data.id, { copyId: b.copyId, memberId: b.memberId });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
