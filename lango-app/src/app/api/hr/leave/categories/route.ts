import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { leaveCategories } from '@/models/Schema';

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  daysPerYear: z.number().int().min(1).max(365).nullable().optional(),
  isPaid: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    const tenantId = requireTenant(ctx);

    const categories = await db
      .select()
      .from(leaveCategories)
      .where(eq(leaveCategories.tenantId, tenantId));

    return NextResponse.json({ success: true, data: categories });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'hr.manage');
    const tenantId = requireTenant(ctx);
    const body = await parseJson(request, createCategorySchema);

    const [category] = await db
      .insert(leaveCategories)
      .values({ tenantId, name: body.name, daysPerYear: body.daysPerYear ?? null, isPaid: body.isPaid })
      .returning();

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
