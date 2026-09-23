import { and, count, eq, inArray } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classSections, user } from '@/models/Schema';

/**
 * ONE CAPACITY TRUTH — `class_sections.maxStudents`.
 *
 * Every operational path (auto-placement, manual placement, admissions,
 * transfers, promotions, section UI) resolves capacity through this module.
 * `academic_class_offerings.capacity` is legacy/derived and must not be used
 * as an independent business rule.
 *
 * Missing capacity is always `CAPACITY_NOT_CONFIGURED` — never inferred from
 * another field and never replaced by a hardcoded 30/32/35.
 */

export const CAPACITY_NOT_CONFIGURED = 'CAPACITY_NOT_CONFIGURED';
export const CAPACITY_EXCEEDED = 'CAPACITY_EXCEEDED';
export const CAPACITY_BELOW_OCCUPANCY = 'CAPACITY_BELOW_OCCUPANCY';

export type SectionCapacity = {
  classSectionId: string;
  configured: boolean;
  maxStudents: number | null;
  occupancy: number;
  available: number | null;
};

/** Pure capacity rule shared by DB-backed and simulation paths. */
export function evaluateCapacity(maxStudents: number | null | undefined, occupancy: number): {
  configured: boolean;
  available: number | null;
  allowsOneMore: boolean;
} {
  if (maxStudents == null) {
    return { configured: false, available: null, allowsOneMore: false };
  }
  const available = Math.max(0, maxStudents - occupancy);
  return { configured: true, available, allowsOneMore: occupancy < maxStudents };
}

/** Occupancy strictly above the configured maximum (for simulation reports). */
export function exceedsCapacity(maxStudents: number | null | undefined, occupancy: number): boolean {
  return maxStudents != null && occupancy > maxStudents;
}

async function occupancyForSections(tenantId: string, classSectionIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (classSectionIds.length === 0) {
    return map;
  }
  const rows = await db
    .select({ classSectionId: user.classSectionId, n: count() })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      inArray(user.classSectionId, classSectionIds),
    ))
    .groupBy(user.classSectionId);
  for (const row of rows) {
    if (row.classSectionId) {
      map.set(row.classSectionId, Number(row.n ?? 0));
    }
  }
  return map;
}

/** Batched resolver for lists/boards — never N+1. */
export async function resolveSectionCapacities(
  tenantId: string,
  classSectionIds: string[],
): Promise<Map<string, SectionCapacity>> {
  const capacities = new Map<string, SectionCapacity>();
  if (classSectionIds.length === 0) {
    return capacities;
  }
  const [sections, occupancy] = await Promise.all([
    db
      .select({ id: classSections.id, maxStudents: classSections.maxStudents })
      .from(classSections)
      .where(and(eq(classSections.tenantId, tenantId), inArray(classSections.id, classSectionIds))),
    occupancyForSections(tenantId, classSectionIds),
  ]);
  for (const section of sections) {
    const occ = occupancy.get(section.id) ?? 0;
    const evaluated = evaluateCapacity(section.maxStudents, occ);
    capacities.set(section.id, {
      classSectionId: section.id,
      configured: evaluated.configured,
      maxStudents: section.maxStudents,
      occupancy: occ,
      available: evaluated.available,
    });
  }
  return capacities;
}

export async function resolveSectionCapacity(tenantId: string, classSectionId: string): Promise<SectionCapacity> {
  const resolved = await resolveSectionCapacities(tenantId, [classSectionId]);
  const capacity = resolved.get(classSectionId);
  if (!capacity) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La section de classe indiquée n\'existe pas pour cet établissement.');
  }
  return capacity;
}

/**
 * Guard a placement into a section.
 *
 * `excludeStudentIds` lets a same-section move keep its own seat without
 * double-counting; `additionalStudents` supports batch promotion commits.
 */
export async function assertSectionCapacity(
  tenantId: string,
  classSectionId: string,
  opts: { additionalStudents?: number; excludeStudentIds?: string[] } = {},
): Promise<SectionCapacity> {
  const capacity = await resolveSectionCapacity(tenantId, classSectionId);
  if (!capacity.configured) {
    throw new ApiError(
      422,
      CAPACITY_NOT_CONFIGURED,
      'La capacité de cette section n\'est pas configurée. Définissez la capacité maximale avant d\'y affecter des élèves.',
    );
  }
  let occupancy = capacity.occupancy;
  const exclude = opts.excludeStudentIds ?? [];
  if (exclude.length > 0) {
    const rows = await db
      .select({ n: count() })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.classSectionId, classSectionId),
        inArray(user.id, exclude),
      ));
    occupancy -= Number(rows[0]?.n ?? 0);
  }
  const additional = opts.additionalStudents ?? 1;
  if (occupancy + additional > (capacity.maxStudents ?? 0)) {
    throw new ApiError(
      409,
      CAPACITY_EXCEEDED,
      `Capacité dépassée pour cette section (${capacity.occupancy}/${capacity.maxStudents}). Libérez une place ou augmentez la capacité.`,
    );
  }
  return capacity;
}

/** Refuse shrinking capacity below the students already seated. */
export async function assertCapacityNotBelowOccupancy(
  tenantId: string,
  classSectionId: string,
  nextMaxStudents: number,
): Promise<void> {
  const capacity = await resolveSectionCapacity(tenantId, classSectionId);
  if (nextMaxStudents < capacity.occupancy) {
    throw new ApiError(
      409,
      CAPACITY_BELOW_OCCUPANCY,
      `La capacité (${nextMaxStudents}) ne peut pas être inférieure aux ${capacity.occupancy} élève(s) déjà affecté(s) à cette section.`,
    );
  }
}
