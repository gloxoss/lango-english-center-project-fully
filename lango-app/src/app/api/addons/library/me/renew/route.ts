import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { recordAudit } from '@/libs/api/audit';
import { requireLibrarySelfContext } from '@/features/library/api/guard';
import { renewOwnLoan } from '@/features/library/services/library-service';

const schema = z.object({ loanId: z.uuid(), expectedRenewedCount: z.number().int().min(0).optional() }).strict();

export async function POST(r: Request) {
  try {
    const { tenantId, context } = await requireLibrarySelfContext(r);
    const b = await parseJson(r, schema);
    const data = await renewOwnLoan(tenantId, context.userId, b.loanId, b.expectedRenewedCount);
    recordAudit(context, 'update', 'library_loan', b.loanId, { action: 'renew', selfService: true });
    return NextResponse.json({ success: true, data });
  } catch (e) { return apiErrorResponse(e); }
}
