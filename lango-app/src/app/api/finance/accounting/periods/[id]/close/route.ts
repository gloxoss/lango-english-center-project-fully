import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { closePeriod } from '@/features/accounting/services/period-service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.period.close');
    const [{ id }, body] = await Promise.all([params, parseJson(req, z.object({ reason: z.string().trim().min(3).max(1000) }).strict())]);
    const { period, closingRun, alreadyClosed } = await closePeriod({ tenantId: ctx.tenantId!, userId: ctx.userId }, id, body.reason);
    recordAudit(ctx, 'update', 'fiscal_period', id, { action: 'close', reason: body.reason, closingRunId: closingRun?.id, alreadyClosed });
    return NextResponse.json({ success: true, data: { period, closingRun, alreadyClosed } });
  } catch (error) { return apiErrorResponse(error); }
}
