import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkPromotionCapacities } from '@/features/students/services/promotion-service';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';

export const capacityCheckSchema = z.object({
  targetSessionYearId: z.string().uuid({ message: 'L\'identifiant de la session cible est requis.' }).optional().nullable(),
  assignments: z.array(
    z.object({
      offeringId: z.string().uuid().optional().nullable(),
      classSectionId: z.string().uuid().optional().nullable(),
      studentCount: z.number().int().nonnegative().optional().default(0),
    }),
  ).optional().default([]),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, capacityCheckSchema);
    const assignments = (body.assignments || [])
      .map(a => ({
        classSectionId: a.classSectionId || a.offeringId || '',
        studentCount: a.studentCount ?? 0,
      }))
      .filter(a => Boolean(a.classSectionId));

    const result = await checkPromotionCapacities(tenantId, assignments);

    return NextResponse.json({
      success: true,
      data: {
        targetSessionYearId: body.targetSessionYearId ?? null,
        hasCapacityExceeded: result.hasCapacityExceeded,
        hasCapacityUnconfigured: result.hasCapacityUnconfigured,
        breakdown: result.breakdown,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
