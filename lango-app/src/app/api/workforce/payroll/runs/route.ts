import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireWorkforceAddon } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines } from '@/models/Schema';
import { createRun } from '@/features/workforce/services/payroll-runs';

const createSchema = z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) });

async function context(request: Request, capability: 'payroll.review' | 'payroll.calculate') {
  const ctx = await requireRequestContext(request);
  const tenantId = requireTenant(ctx);
  await requireWorkforceAddon(tenantId);
  await requireCapability(ctx, capability);
  return { ctx, tenantId };
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await context(request, 'payroll.review');
    const runs = await db.select().from(payrollPeriods).where(eq(payrollPeriods.tenantId, tenantId)).orderBy(desc(payrollPeriods.year), desc(payrollPeriods.month));
    const totals = await db.select().from(payrollRunLines).where(eq(payrollRunLines.tenantId, tenantId));
    const byRun = new Map<string, { employees: number; gross: number; net: number; employerCost: number }>();
    for (const line of totals) {
      const current = byRun.get(line.periodId) ?? { employees: 0, gross: 0, net: 0, employerCost: 0 };
      current.employees += 1;
      current.gross += Number(line.grossSalary);
      current.net += Number(line.netPayable ?? line.netSalary);
      current.employerCost += Number(line.totalEmployerCost);
      byRun.set(line.periodId, current);
    }
    return NextResponse.json({ success: true, data: runs.map(run => ({ ...run, totals: byRun.get(run.id) ?? { employees: 0, gross: 0, net: 0, employerCost: 0 } })) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await context(request, 'payroll.calculate');
    const body = await parseJson(request, createSchema);
    const run = await createRun(tenantId, body.year, body.month);
    return NextResponse.json({ success: true, data: run }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
