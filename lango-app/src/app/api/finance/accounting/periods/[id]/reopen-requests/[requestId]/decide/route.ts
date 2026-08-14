import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { decideReopen } from '@/features/accounting/services/period-service';

const decide = z.object({
  decision: z.enum(['approved', 'rejected']),
  note: z.string().trim().min(3).max(1000).optional(),
}).strict();

// Decide a pending reopen request. Approval (by a different actor than the
// requester, both holding the exceptional accounting.period.reopen capability)
// reopens the period and supersedes its active closing run; rejection keeps the
// period closed. Either way an immutable audit event is appended.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.period.reopen');
    const [{ requestId }, body] = await Promise.all([params, parseJson(req, decide)]);
    const result = await decideReopen({ tenantId: ctx.tenantId!, userId: ctx.userId }, requestId, body.decision, body.note);
    recordAudit(ctx, 'update', 'accounting_period_reopen_request', requestId, { decision: body.decision, note: body.note });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
