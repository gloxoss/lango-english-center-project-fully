import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { attendanceRegisters } from '@/models/Schema';

function generateReference(classId: string, date: string, period: number) {
  return `REG-${date}-P${period}-${classId.slice(0, 8).toUpperCase()}`;
}

// Finds or creates the register for (classId, date, period) inside the given
// transaction, enforcing the lock. Returns the register row to attach to each
// attendance record written in this same submission.
export async function resolveRegisterForSubmission(
  tenantId: string,
  classId: string,
  date: string,
  period: number,
  submittedById: string,
  correctionNote: string | undefined,
  executor: any = db,
) {
  const [existing] = await executor
    .select()
    .from(attendanceRegisters)
    .where(and(
      eq(attendanceRegisters.tenantId, tenantId),
      eq(attendanceRegisters.classId, classId),
      eq(attendanceRegisters.date, date),
      eq(attendanceRegisters.period, period),
    ))
    .limit(1);

  if (!existing) {
    const [inserted] = await executor
      .insert(attendanceRegisters)
      .values({
        tenantId,
        classId,
        date,
        period,
        reference: generateReference(classId, date, period),
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
