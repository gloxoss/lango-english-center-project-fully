import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { studentLedgerReconciliation } from '@/features/accounting/services/student-accounting-adapter';

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'accounting.statement.read');
    const data = await studentLedgerReconciliation({ tenantId, userId: ctx.userId });
    // Read-only JSON the reconciliation page loads on every visit: not an export,
    // so no audit row (it wrote one per page view, audit S-23).
    return NextResponse.json({ success: true, data });
  } catch (error) { return apiErrorResponse(error); }
}
