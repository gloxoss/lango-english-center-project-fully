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
    const [inserted] = await executor
      .insert(attendanceRegisters)
      .values({
        tenantId,
        classId,
        classSectionId,
        date,
        period,
        reference: generateReference(classSectionId, classId, date, period),
        status: 'LOCKED',
        submittedAt: new Date().toISOString(),
        submittedById,
      })
      .returning();
    return inserted;
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
