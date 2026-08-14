import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibraryContext } from '@/features/library/api/guard';
import { renewLoan } from '@/features/library/services/library-service';

const schema = z.object({
  loanId: z.uuid(),
  expectedRenewedCount: z.number().int().min(0).optional(),
}).strict();

export async function POST(request: Request) {
  try {
    const { tenantId, context } = await requireLibraryContext(request, 'library.circulation.operate');
    const { loanId, expectedRenewedCount } = await parseJson(request, schema);
    const data = await renewLoan(tenantId, context.userId, loanId, expectedRenewedCount);
    recordAudit(context, 'update', 'library_loan', data.id, { action: 'renew', expectedRenewedCount });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
