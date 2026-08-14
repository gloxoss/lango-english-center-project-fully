import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { unmatchStatementLine } from '@/features/accounting/services/reconciliation-service';

const schema = z.object({
  statementLineId: z.string().uuid(),
  journalLineId: z.string().uuid().optional(),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await unmatchStatementLine({ tenantId, userId: ctx.userId }, id, body.statementLineId, body.journalLineId);
    recordAudit(ctx, 'update', 'bank_reconciliation', id, { action: 'unmatch', ...result });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
