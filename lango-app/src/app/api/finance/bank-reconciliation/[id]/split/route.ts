import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { splitStatementLine } from '@/features/accounting/services/reconciliation-service';

const schema = z.object({
  statementLineId: z.string().uuid(),
  parts: z.array(z.object({
    journalLineId: z.string().uuid(),
    amount: z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/),
  })).min(2).max(50),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await splitStatementLine({ tenantId, userId: ctx.userId }, id, body.statementLineId, body.parts);
    recordAudit(ctx, 'update', 'bank_reconciliation', id, { action: 'split', ...result });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
