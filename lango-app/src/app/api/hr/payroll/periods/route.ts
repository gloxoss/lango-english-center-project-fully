import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines } from '@/models/Schema';

const createPeriodSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.read');
    const tenantId = requireTenant(ctx);

    const periods = await db
      .select()
      .from(payrollPeriods)
      .where(eq(payrollPeriods.tenantId, tenantId));

    return NextResponse.json({ success: true, data: periods });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, createPeriodSchema);

    // Check not already exists
    const [existing] = await db
      .select({ id: payrollPeriods.id, status: payrollPeriods.status })
      .from(payrollPeriods)
      .where(
        and(
          eq(payrollPeriods.tenantId, tenantId),
          eq(payrollPeriods.year, body.year),
          eq(payrollPeriods.month, body.month),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ApiError(409, 'ALREADY_EXISTS', `La période ${body.year}/${body.month} existe déjà (statut: ${existing.status}).`);
    }

    const [period] = await db
      .insert(payrollPeriods)
      .values({ tenantId, year: body.year, month: body.month, status: 'draft' })
      .returning();

    return NextResponse.json({ success: true, data: period }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
