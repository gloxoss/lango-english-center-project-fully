import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { cndpFilings } from '@/models/Schema';

const cndpFilingSchema = z.object({
  filingReference: z.string().trim().max(100).optional(),
  filedAt: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved']).default('draft'),
  notes: z.string().trim().optional(),
}).strict();

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.security.manage');

    const [filing] = await db
      .select()
      .from(cndpFilings)
      .where(eq(cndpFilings.tenantId, tenantId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: filing ?? null,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.security.manage');
    const body = await parseJson(request, cndpFilingSchema);

    const [updated] = await db
      .insert(cndpFilings)
      .values({
        tenantId,
        filingReference: body.filingReference || null,
        filedAt: body.filedAt || null,
        status: body.status,
        notes: body.notes || null,
      })
      .onConflictDoUpdate({
        target: cndpFilings.tenantId,
        set: {
          filingReference: body.filingReference || null,
          filedAt: body.filedAt || null,
          status: body.status,
          notes: body.notes || null,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();

    if (updated) {
      await recordAudit(context, 'update', 'cndp_filing', updated.id);
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
