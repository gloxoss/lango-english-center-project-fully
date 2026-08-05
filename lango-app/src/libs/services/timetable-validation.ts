import { and, eq, ne } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classScheduleSlots, classSections, classSubjects, subjectTeachers } from '@/models/Schema';

export type SlotCandidate = {
  classSectionId: string;
  classSubjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel?: string | null;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Single validation path shared by create and update: the class-subject must
 * belong to the section's own class, the teacher must actually be assigned
 * (via subjectTeachers) to teach that subject in that section, the time
 * range must be valid, and the slot must not double-book a teacher, room, or
 * class-section against any other slot already on the timetable. Blocks by
 * default - no override path (ponytail: not requested, add if a school
 * policy actually needs one).
 */
export async function assertSlotIsValid(tenantId: string, candidate: SlotCandidate, excludeSlotId?: string): Promise<void> {
  if (!(candidate.startTime < candidate.endTime)) {
    throw new ApiError(422, 'INVALID_TIME_RANGE', 'L\'heure de fin doit être après l\'heure de début.');
  }

  const [section] = await db.select({ classId: classSections.classId }).from(classSections)
    .where(and(eq(classSections.id, candidate.classSectionId), eq(classSections.tenantId, tenantId))).limit(1);
  if (!section) {
    throw new ApiError(422, 'INVALID_REFERENCE', 'La classe/section indiquée n\'existe pas pour cet établissement.');
  }

  const [classSubject] = await db.select({ id: classSubjects.id }).from(classSubjects)
    .where(and(eq(classSubjects.id, candidate.classSubjectId), eq(classSubjects.tenantId, tenantId), eq(classSubjects.classId, section.classId))).limit(1);
  if (!classSubject) {
    throw new ApiError(422, 'SUBJECT_NOT_IN_CLASS', 'Cette matière n\'est pas assignée à la classe de cette section.');
  }

  const [eligibleTeacher] = await db.select({ id: subjectTeachers.id }).from(subjectTeachers)
    .where(and(
      eq(subjectTeachers.tenantId, tenantId),
      eq(subjectTeachers.classSectionId, candidate.classSectionId),
      eq(subjectTeachers.classSubjectId, candidate.classSubjectId),
      eq(subjectTeachers.teacherId, candidate.teacherId),
    )).limit(1);
  if (!eligibleTeacher) {
    throw new ApiError(422, 'TEACHER_NOT_ASSIGNED', 'Cet enseignant n\'est pas assigné à cette matière pour cette section.');
  }

  const filters = [eq(classScheduleSlots.tenantId, tenantId), eq(classScheduleSlots.dayOfWeek, candidate.dayOfWeek as typeof classScheduleSlots.$inferSelect.dayOfWeek)];
  if (excludeSlotId) {
    filters.push(ne(classScheduleSlots.id, excludeSlotId));
  }
  const sameDaySlots = await db.select({
    id: classScheduleSlots.id,
    classSectionId: classScheduleSlots.classSectionId,
    teacherId: classScheduleSlots.teacherId,
    roomLabel: classScheduleSlots.roomLabel,
    startTime: classScheduleSlots.startTime,
    endTime: classScheduleSlots.endTime,
  }).from(classScheduleSlots).where(and(...filters));

  for (const slot of sameDaySlots) {
    if (!overlaps(candidate.startTime, candidate.endTime, slot.startTime, slot.endTime)) {
      continue;
    }
    if (slot.teacherId === candidate.teacherId) {
      throw new ApiError(409, 'TEACHER_CONFLICT', 'Cet enseignant a déjà un cours sur ce créneau.');
    }
    if (slot.classSectionId === candidate.classSectionId) {
      throw new ApiError(409, 'CLASS_SECTION_CONFLICT', 'Cette classe a déjà un cours sur ce créneau.');
    }
    if (candidate.roomLabel && slot.roomLabel && slot.roomLabel === candidate.roomLabel) {
      throw new ApiError(409, 'ROOM_CONFLICT', `La salle "${candidate.roomLabel}" est déjà réservée sur ce créneau.`);
    }
  }
}
