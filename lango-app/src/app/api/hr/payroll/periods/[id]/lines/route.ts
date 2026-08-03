import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines } from '@/models/Schema';

// GET /api/hr/payroll/periods/[id]/lines
// Returns calculated run lines for a given period (for review before lock).

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.read');
    const tenantId = requireTenant(ctx);
    const { id: periodId } = await params;

    // Verify period belongs to tenant
    const [period] = await db
      .select({ id: payrollPeriods.id, status: payrollPeriods.status, year: payrollPeriods.year, month: payrollPeriods.month })
      .from(payrollPeriods)
      .where(and(eq(payrollPeriods.id, periodId), eq(payrollPeriods.tenantId, tenantId)))
      .limit(1);

    if (!period) {
      throw new ApiError(404, 'NOT_FOUND', 'Période de paie introuvable.');
    }

    const lines = await db
      .select()
      .from(payrollRunLines)
      .where(and(eq(payrollRunLines.periodId, periodId), eq(payrollRunLines.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: { period, lines } });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
