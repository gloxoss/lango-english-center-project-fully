import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { returnLoan } from '@/features/library/services/library-service';

const schema = z.object({
  loanId: z.uuid(),
  condition: z.enum(['good', 'damaged', 'lost']),
  note: z.string().max(1000).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(request, 'library.circulation.operate');
    const body = await parseJson(request, schema);
    const data = await returnLoan(tenantId, context.userId, body);
    recordAudit(context, 'update', 'library_loan', data.id, { action: 'return', condition: body.condition });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
