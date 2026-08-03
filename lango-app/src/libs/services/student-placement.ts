import { and, eq, sql } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classSections, sessionYears, studentPlacements, user } from '@/models/Schema';

export type RecordPlacementInput = {
  tenantId: string;
  studentId: string;
  sessionYearId: string;
  classSectionId: string;
  startDate?: string;
  status?: 'enrolled' | 'dropped' | 'graduated';
  promotedFromPlacementId?: string;
  notes?: string;
};

/** The only supported writer for placement history and its user projection. */
export async function recordStudentPlacement(input: RecordPlacementInput) {
  const { tenantId, studentId, sessionYearId, classSectionId, notes } = input;
  const effectiveStartDate = input.startDate ?? new Date().toISOString().slice(0, 10);
  const status = input.status ?? 'enrolled';

  return db.transaction(async (tx) => {
    // An advisory transaction lock also serializes concurrent first placements,
    // where SELECT FOR UPDATE would have no existing row to lock.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${studentId}`}, 0))`);

    const [studentRow] = await tx.select({ id: user.id }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.id, studentId), eq(user.role, 'student'))).limit(1);
    const [sessionYearRow] = await tx.select({ id: sessionYears.id }).from(sessionYears).where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.id, sessionYearId))).limit(1);
    const [classSectionRow] = await tx.select({ id: classSections.id }).from(classSections).where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, classSectionId))).limit(1);

    if (!studentRow) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève non trouvé dans cet établissement.');
    }
    if (!sessionYearRow) {
      throw new ApiError(404, 'SESSION_YEAR_NOT_FOUND', 'Année scolaire non trouvée dans cet établissement.');
    }
    if (!classSectionRow) {
      throw new ApiError(404, 'CLASS_SECTION_NOT_FOUND', 'Classe non trouvée dans cet établissement.');
    }

    const [currentPlacement] = await tx.select({
      id: studentPlacements.id,
      startDate: studentPlacements.startDate,
      sessionYearId: studentPlacements.sessionYearId,
      classSectionId: studentPlacements.classSectionId,
    }).from(studentPlacements).where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.studentId, studentId),
      eq(studentPlacements.isCurrent, true),
    )).limit(1);

    // Safe retry: return the already-created transition rather than duplicating it.
    if (currentPlacement?.startDate === effectiveStartDate
      && currentPlacement.sessionYearId === sessionYearId
      && currentPlacement.classSectionId === classSectionId) {
      return currentPlacement;
    }
    if (currentPlacement && effectiveStartDate <= currentPlacement.startDate) {
      throw new ApiError(409, 'PLACEMENT_DATE_CONFLICT', 'La date du nouveau placement doit être postérieure au placement actuel.');
    }

    let predecessorId = input.promotedFromPlacementId ?? currentPlacement?.id ?? null;
    if (input.promotedFromPlacementId) {
      const [predecessor] = await tx.select({ id: studentPlacements.id })
        .from(studentPlacements)
        .where(and(
          eq(studentPlacements.id, input.promotedFromPlacementId),
          eq(studentPlacements.tenantId, tenantId),
          eq(studentPlacements.studentId, studentId),
        ))
        .limit(1);
      if (!predecessor) {
        throw new ApiError(422, 'INVALID_PREDECESSOR', 'Le placement précédent ne fait pas partie de ce parcours étudiant.');
      }
      predecessorId = predecessor.id;
    }

    await tx.update(studentPlacements).set({
      isCurrent: false,
      endDate: effectiveStartDate,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.studentId, studentId),
      eq(studentPlacements.isCurrent, true),
    ));

    const [newPlacement] = await tx.insert(studentPlacements).values({
      tenantId,
      studentId,
      sessionYearId,
      classSectionId,
      status,
      startDate: effectiveStartDate,
      isCurrent: true,
      promotedFromPlacementId: predecessorId,
      notes: notes || null,
    }).returning();

    if (!newPlacement) {
      throw new ApiError(500, 'PLACEMENT_INSERT_FAILED', 'Le placement n’a pas pu être enregistré.');
    }

    await tx.update(user).set({ classSectionId, updatedAt: new Date().toISOString() }).where(and(eq(user.tenantId, tenantId), eq(user.id, studentId)));

    return newPlacement;
  });
}
