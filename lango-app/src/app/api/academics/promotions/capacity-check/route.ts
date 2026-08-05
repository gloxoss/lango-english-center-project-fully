import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { academicClassOfferings, classes, sections, user } from '@/models/Schema';

export const capacityCheckSchema = z.object({
  targetSessionYearId: z.string().uuid({ message: 'L\'identifiant de la session cible est requis.' }).optional().nullable(),
  assignments: z.array(
    z.object({
      offeringId: z.string().uuid().optional().nullable(),
      classSectionId: z.string().uuid().optional().nullable(),
      studentCount: z.number().int().nonnegative().optional().default(0),
    })
  ).optional().default([]),
}).strict();

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    await requireCapability(context, 'academics.manage');
    const tenantId = requireTenant(context);

    const body = await parseJson(request, capacityCheckSchema);
    const assignments = body.assignments || [];

    // Extract non-null offeringIds and classSectionIds
    const offeringIds = assignments.map((a) => a.offeringId).filter((id): id is string => Boolean(id));

    const offerings = offeringIds.length > 0
      ? await db
          .select({
            id: academicClassOfferings.id,
            capacity: academicClassOfferings.capacity,
            classSectionId: academicClassOfferings.sectionId,
            className: classes.name,
            sectionName: sections.name,
          })
          .from(academicClassOfferings)
          .innerJoin(classes, eq(academicClassOfferings.classId, classes.id))
          .innerJoin(sections, eq(academicClassOfferings.sectionId, sections.id))
          .where(and(eq(academicClassOfferings.tenantId, tenantId), inArray(academicClassOfferings.id, offeringIds)))
      : [];

    const breakdown = await Promise.all(
      assignments.map(async (item) => {
        const offering = offerings.find((o) => o.id === item.offeringId);
        const capacity = offering?.capacity ?? null; // null represents unlimited capacity

        let currentStudentsCount = 0;
        const targetSectionId = item.classSectionId || offering?.classSectionId;

        if (targetSectionId) {
          const [countResult] = await db
            .select({ count: count() })
            .from(user)
            .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.classSectionId, targetSectionId)));
          currentStudentsCount = countResult?.count ?? 0;
        }

        const proposed = item.studentCount ?? 0;
        const totalAfterPromotion = currentStudentsCount + proposed;
        const headroom = capacity != null ? capacity - totalAfterPromotion : null;
        const isExceeded = capacity != null ? headroom! < 0 : false;

        return {
          offeringId: item.offeringId ?? null,
          classSectionId: targetSectionId ?? null,
          className: offering?.className ?? 'Classe',
          sectionName: offering?.sectionName ?? 'Section',
          capacity,
          currentStudentsCount,
          proposedStudentsCount: proposed,
          headroom,
          isExceeded,
        };
      })
    );

    const hasCapacityExceeded = breakdown.some((b) => b.isExceeded);

    return NextResponse.json({
      success: true,
      data: {
        targetSessionYearId: body.targetSessionYearId ?? null,
        hasCapacityExceeded,
        breakdown,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
