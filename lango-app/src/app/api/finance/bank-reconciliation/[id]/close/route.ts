import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { closeReconciliation } from '@/features/accounting/services/reconciliation-service';

const schema = z.object({
  varianceReason: z.string().trim().min(3).max(1000).optional(),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.reconcile');
    const [{ id }, body] = await Promise.all([params, parseJson(req, schema)]);
    const result = await closeReconciliation({ tenantId, userId: ctx.userId }, id, body.varianceReason);
    recordAudit(ctx, 'update', 'bank_reconciliation', id, {
      action: 'close', varianceReason: body.varianceReason, alreadyClosed: result.alreadyClosed,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) { return apiErrorResponse(error); }
}
