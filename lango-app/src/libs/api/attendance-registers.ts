import { and, eq, isNull } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendanceRegisters } from '@/models/Schema';

function generateReference(classSectionId: string | null, classId: string, date: string, period: number) {
  const scope = (classSectionId ?? classId).slice(0, 8).toUpperCase();
  return `REG-${date}-P${period}-${scope}`;
}

/**
 * Finds or creates the register for a submission, enforcing the lock.
 *
 * SECTION SCOPE (migration 0147): when the submission belongs to an operating
 * class section, the register is keyed by that section — Section A can no
 * longer lock or be read as Section B. Legacy rows without a section keep the
 * old class-level key so historical registers stay reachable and unique.
 */
export async function resolveRegisterForSubmission(
  tenantId: string,
  classId: string,
  date: string,
  period: number,
  submittedById: string,
  correctionNote: string | undefined,
  executor: any = db,
  classSectionId: string | null = null,
  sessionYearId: string | null = null,
) {
  const [existing] = await executor
    .select()
    .from(attendanceRegisters)
    .where(and(
      eq(attendanceRegisters.tenantId, tenantId),
      eq(attendanceRegisters.classId, classId),
      eq(attendanceRegisters.date, date),
      eq(attendanceRegisters.period, period),
      classSectionId
        ? eq(attendanceRegisters.classSectionId, classSectionId)
        : isNull(attendanceRegisters.classSectionId),
    ))
    .limit(1);

  if (!existing) {
    // Race-safe creation: the partial unique indexes on
    // (tenant, section|class, date, period) guarantee a single register even
    // when two submissions arrive simultaneously; the loser re-reads the
    // winner's row and continues through the normal lock path below.
    const [inserted] = await executor
      .insert(attendanceRegisters)
      .values({
        tenantId,
        classId,
        classSectionId,
        sessionYearId,
        date,
        period,
        reference: generateReference(classSectionId, classId, date, period),
        status: 'LOCKED',
        submittedAt: new Date().toISOString(),
        submittedById,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      return inserted;
    }

    const [raced] = await executor
      .select()
      .from(attendanceRegisters)
      .where(and(
        eq(attendanceRegisters.tenantId, tenantId),
        eq(attendanceRegisters.classId, classId),
        eq(attendanceRegisters.date, date),
        eq(attendanceRegisters.period, period),
        classSectionId
          ? eq(attendanceRegisters.classSectionId, classSectionId)
          : isNull(attendanceRegisters.classSectionId),
      ))
      .limit(1);

    if (!raced) {
      throw new ApiError(500, 'REGISTER_RESOLVE_FAILED', 'Le registre n\'a pas pu être résolu.');
    }
    if (raced.status === 'LOCKED') {
      throw new ApiError(409, 'REGISTER_LOCKED', `Ce registre (${raced.reference}) a été soumis et verrouillé. Une réouverture par l'administration est requise pour le modifier.`);
    }
    return raced;
  }

  if (existing.status === 'LOCKED') {
    throw new ApiError(409, 'REGISTER_LOCKED', `Ce registre (${existing.reference}) a été soumis et verrouillé. Une réouverture par l'administration est requise pour le modifier.`);
  }

  // status === 'REOPENED' -> this is a correction resubmission, re-lock it.
  if (!correctionNote || !correctionNote.trim()) {
    throw new ApiError(400, 'CORRECTION_NOTE_REQUIRED', 'Ce registre a été rouvert pour correction : une note de correction est requise pour le soumettre à nouveau.');
  }

  const [updated] = await executor
    .update(attendanceRegisters)
    .set({
      status: 'LOCKED',
      submittedAt: new Date().toISOString(),
      submittedById,
      correctionNote: correctionNote.trim(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(attendanceRegisters.id, existing.id))
    .returning();
  return updated;
}
