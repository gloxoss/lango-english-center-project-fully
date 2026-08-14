import type { NextRequest } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { accountingPeriodReopenRequests, fiscalPeriods } from '@/models/Schema';

// Read the reopen-request queue for one period so the periods page can drive the
// two-step maker-checker reopen workflow (request, then decide).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.period.reopen');
    const { id } = await params;
    const [period] = await db.select().from(fiscalPeriods).where(and(
      eq(fiscalPeriods.tenantId, ctx.tenantId!),
      eq(fiscalPeriods.id, id),
    )).limit(1);
    if (!period) throw new ApiError(404, 'FISCAL_PERIOD_NOT_FOUND', 'Période introuvable.');
    const rows = await db.select().from(accountingPeriodReopenRequests)
      .where(and(
        eq(accountingPeriodReopenRequests.tenantId, ctx.tenantId!),
        eq(accountingPeriodReopenRequests.fiscalPeriodId, id),
      ))
      .orderBy(asc(accountingPeriodReopenRequests.createdAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) { return apiErrorResponse(error); }
}
