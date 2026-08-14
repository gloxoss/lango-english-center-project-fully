import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { listPayslips } from '@/features/hr/services/payslips';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';

// GET /api/employee/me/payroll
// Own published payslips (immutable snapshots) + annual net summaries.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.self.read');
    await resolveEmployeeContext(tenantId, ctx.userId, { allowRetainedReadOnly: true });

    const payslips = await listPayslips({ tenantId, userId: ctx.userId });

    payslips.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.month ?? 0) - (a.month ?? 0));

    const byYear = new Map<number, { year: number; count: number; totalNet: number }>();
    for (const p of payslips) {
      const year = p.year ?? 0;
      const entry = byYear.get(year) ?? { year, count: 0, totalNet: 0 };
      entry.count += 1;
      entry.totalNet += Number(p.netSalary);
      byYear.set(year, entry);
    }

    return NextResponse.json({
      success: true,
      data: {
        payslips,
        annualSummaries: Array.from(byYear.values()).sort((a, b) => b.year - a.year),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
