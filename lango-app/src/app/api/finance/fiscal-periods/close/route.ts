import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { fiscalPeriods } from '@/models/Schema';

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req);
    await requireCapability(ctx, 'finance.close');

    const body = await req.json();
    const { periodId, name, startDate, endDate } = body;

    let targetPeriodId = periodId;

    if (!targetPeriodId) {
      if (!name || !startDate || !endDate) {
        throw new ApiError(400, 'BAD_REQUEST', 'Veuillez spécifier periodId ou (name, startDate, endDate).');
      }

      const [newPeriod] = await db
        .insert(fiscalPeriods)
        .values({
          tenantId: ctx.tenantId!,
          name,
          startDate,
          endDate,
          status: 'open',
        })
        .returning();

      if (!newPeriod) {
        throw new ApiError(500, 'INTERNAL_ERROR', 'Impossible de créer la période comptable.');
      }

      targetPeriodId = newPeriod.id;
    }

    const [closedPeriod] = await db
      .update(fiscalPeriods)
      .set({
        status: 'closed',
        closedAt: new Date().toISOString(),
        closedById: ctx.userId,
      })
      .where(and(eq(fiscalPeriods.tenantId, ctx.tenantId!), eq(fiscalPeriods.id, targetPeriodId)))
      .returning();

    if (!closedPeriod) {
      throw new ApiError(404, 'NOT_FOUND', 'Période comptable non trouvée.');
    }

    return NextResponse.json({
      success: true,
      message: `Période comptable '${closedPeriod.name}' clôturée avec succès.`,
      data: closedPeriod,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
