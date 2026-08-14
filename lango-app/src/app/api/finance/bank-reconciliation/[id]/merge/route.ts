import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { mergeStatementLines } from '@/features/accounting/services/reconciliation-service';

const schema = z.object({
  statementLineIds: z.array(z.string().uuid()).min(2).max(50),
  journalLineId: z.string().uuid(),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await mergeStatementLines({ tenantId, userId: ctx.userId }, id, body.statementLineIds, body.journalLineId);
    recordAudit(ctx, 'update', 'bank_reconciliation', id, { action: 'merge', ...result });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
