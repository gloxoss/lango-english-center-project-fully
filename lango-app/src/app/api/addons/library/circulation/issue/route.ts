import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { issueCopy } from '@/features/library/services/library-service';

const schema = z.object({
  copyId: z.uuid(),
  memberId: z.uuid(),
  note: z.string().max(1000).nullable().optional(),
  idempotencyKey: z.string().max(120).nullable().optional(),
  override: z.boolean().optional(),
  overrideReason: z.string().max(500).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(request, 'library.circulation.operate');
    const body = await parseJson(request, schema);
    if (body.override) await requireCapability(context, 'library.circulation.override');
    const data = await issueCopy(tenantId, context.userId, body);
    recordAudit(context, 'create', 'library_loan', data.id, { copyId: body.copyId, memberId: body.memberId, override: body.override === true });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (e) { return apiErrorResponse(e); }
}
