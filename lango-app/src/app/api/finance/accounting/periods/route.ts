import type { NextRequest } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { fiscalPeriods } from '@/models/Schema';

const schema = z.object({ name: z.string().trim().min(1).max(100), startDate: z.string().date(), endDate: z.string().date() }).strict().refine(value => value.endDate >= value.startDate, { message: 'La date de fin doit suivre la date de début.' });
export async function GET(req: NextRequest) {
  try { const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.statement.read'); const rows = await db.select().from(fiscalPeriods).where(eq(fiscalPeriods.tenantId, ctx.tenantId!)).orderBy(asc(fiscalPeriods.startDate)); return NextResponse.json({ success: true, data: rows }); }
  catch (error) { return apiErrorResponse(error); }
}
export async function POST(req: NextRequest) {
  try { const ctx = await requireRequestContext(req); await requireCapability(ctx, 'accounting.period.close'); const body = await parseJson(req, schema); const [row] = await db.insert(fiscalPeriods).values({ tenantId: ctx.tenantId!, ...body, status: 'open' }).returning(); return NextResponse.json({ success: true, data: row }, { status: 201 }); }
  catch (error) { return apiErrorResponse(error); }
}
