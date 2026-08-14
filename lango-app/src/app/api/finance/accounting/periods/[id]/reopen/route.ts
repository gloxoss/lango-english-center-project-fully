import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { requestReopen } from '@/features/accounting/services/period-service';

// Exceptional reopen is now a two-step maker-checker flow: this endpoint only
// RECORDS the request (with a mandatory reason). A different actor holding the same
// exceptional capability must approve it at
// /api/finance/accounting/periods/[id]/reopen-requests/[requestId]/decide.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.period.reopen');
    const [{ id }, body] = await Promise.all([params, parseJson(req, z.object({ reason: z.string().trim().min(10).max(1000) }).strict())]);
    const request = await requestReopen({ tenantId: ctx.tenantId!, userId: ctx.userId }, id, body.reason);
    recordAudit(ctx, 'create', 'accounting_period_reopen_request', request.id, { action: 'reopen_request', reason: body.reason });
    return NextResponse.json({ success: true, data: request }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
