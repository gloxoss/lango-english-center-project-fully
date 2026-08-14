import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { listPayslips } from '@/features/hr/services/payslips';

// GET /api/hr/payslips
// - Employee: sees only own payslips
// - hr.manage role: sees all payslips for the tenant

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);

    const isHrAdmin = ['school_admin', 'accountant'].includes(ctx.role);

    const rows = await listPayslips({ tenantId, userId: isHrAdmin ? undefined : ctx.userId });

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
