import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getReconciliationDetail } from '@/features/accounting/services/reconciliation-service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'finance.read');
    const { id } = await params;
    const data = await getReconciliationDetail({ tenantId, userId: ctx.userId }, id);
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
