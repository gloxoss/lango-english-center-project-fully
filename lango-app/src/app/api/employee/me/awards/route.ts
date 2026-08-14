import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { employeeAwards } from '@/models/Schema';
import { resolveEmployeeContext } from '@/features/hr/services/employee-context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';

// GET /api/employee/me/awards — Own awards & recognition
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);
    await requireWorkforceAddon(tenantId);
    await requireCapability(ctx, 'payroll.self.read');
    await resolveEmployeeContext(tenantId, ctx.userId);

    const rows = await db
      .select({
        id: employeeAwards.id,
        title: employeeAwards.title,
        category: employeeAwards.category,
        monetaryReward: employeeAwards.monetaryReward,
        giftDescription: employeeAwards.giftDescription,
        awardDate: employeeAwards.awardDate,
        summary: employeeAwards.summary,
        presentedBy: employeeAwards.presentedBy,
        status: employeeAwards.status,
        createdAt: employeeAwards.createdAt,
      })
      .from(employeeAwards)
      .where(and(eq(employeeAwards.tenantId, tenantId), eq(employeeAwards.userId, ctx.userId)))
      .orderBy(desc(employeeAwards.awardDate));

    const formatted = rows.map(r => ({
      ...r,
      monetaryReward: Number(r.monetaryReward),
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
