import { and, count, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { resolveSectionCapacities } from '@/libs/services/section-capacity';
import { academicClassOfferings, classes, classSections, sections } from '@/models/Schema';

// Capacity pre-check for promotions.
//
// ONE CAPACITY TRUTH: class_sections.maxStudents (never the legacy
// academic_class_offerings.capacity). The legacy value is returned alongside
// as `legacyOfferingCapacity` so drift is visible, but it never decides.

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
    const assignments = body.assignments || [];

    const offeringIds = assignments.map(a => a.offeringId).filter((id): id is string => Boolean(id));

    const offerings = offeringIds.length > 0
      ? await db
          .select({
            id: academicClassOfferings.id,
            classId: academicClassOfferings.classId,
            sectionId: academicClassOfferings.sectionId,
            capacity: academicClassOfferings.capacity,
            className: classes.name,
            sectionName: sections.name,
          })
          .from(academicClassOfferings)
          .innerJoin(classes, eq(academicClassOfferings.classId, classes.id))
          .innerJoin(sections, eq(academicClassOfferings.sectionId, sections.id))
          .where(and(eq(academicClassOfferings.tenantId, tenantId), inArray(academicClassOfferings.id, offeringIds)))
      : [];

    // Resolve offering-only items to operating class sections (batched).
    const offeringPairs = offerings.map(o => ({ classId: o.classId, sectionId: o.sectionId }));
    const classSectionsByPair = new Map<string, string>();
    if (offeringPairs.length > 0) {
      const sectionRows = await db
        .select({ id: classSections.id, classId: classSections.classId, sectionId: classSections.sectionId })
        .from(classSections)
        .where(and(
          eq(classSections.tenantId, tenantId),
          inArray(classSections.classId, offeringPairs.map(p => p.classId)),
        ));
      for (const row of sectionRows) {
        classSectionsByPair.set(`${row.classId}|${row.sectionId}`, row.id);
      }
    }

    const resolvedSectionIds = assignments
      .map(item => {
        const offering = offerings.find(o => o.id === item.offeringId);
        if (item.classSectionId) {
          return item.classSectionId;
        }
        return offering ? classSectionsByPair.get(`${offering.classId}|${offering.sectionId}`) ?? null : null;
      })
      .filter((id): id is string => Boolean(id));

    const capacities = await resolveSectionCapacities(tenantId, [...new Set(resolvedSectionIds)]);

    const breakdown = assignments.map(item => {
      const offering = offerings.find(o => o.id === item.offeringId);
      const targetSectionId = item.classSectionId
        || (offering ? classSectionsByPair.get(`${offering.classId}|${offering.sectionId}`) ?? null : null);
      const capacity = targetSectionId ? capacities.get(targetSectionId) ?? null : null;
      const proposed = item.studentCount ?? 0;
      const totalAfterPromotion = (capacity?.occupancy ?? 0) + proposed;
      const configured = capacity?.configured ?? false;
      const headroom = configured && capacity?.maxStudents != null ? capacity.maxStudents - totalAfterPromotion : null;

      return {
        offeringId: item.offeringId ?? null,
        classSectionId: targetSectionId,
        className: offering?.className ?? 'Classe',
        sectionName: offering?.sectionName ?? 'Section',
        // Canonical capacity (class_sections.maxStudents).
        capacity: capacity?.maxStudents ?? null,
        capacityConfigured: configured,
        currentStudentsCount: capacity?.occupancy ?? 0,
        proposedStudentsCount: proposed,
        headroom,
        isExceeded: configured && headroom != null ? headroom < 0 : false,
        unknownCapacity: !configured,
        // Drift visibility only — never used for the decision.
        legacyOfferingCapacity: offering?.capacity ?? null,
      };
    });

    const hasCapacityExceeded = breakdown.some(b => b.isExceeded);
    const hasUnknownCapacity = breakdown.some(b => b.unknownCapacity);

    return NextResponse.json({
      success: true,
      data: {
        targetSessionYearId: body.targetSessionYearId ?? null,
        hasCapacityExceeded,
        hasUnknownCapacity,
        breakdown,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
