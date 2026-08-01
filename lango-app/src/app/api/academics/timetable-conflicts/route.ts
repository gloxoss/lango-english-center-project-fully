import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classes, classScheduleSlots, classSections, classSubjects, sections, subjects, user } from '@/models/Schema';

type SlotRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  classSectionId: string;
  teacherId: string;
  roomLabel: string | null;
  label: string;
  teacherName: string;
  roomDisplay: string;
};

function overlaps(a: SlotRow, b: SlotRow): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime;
}

// Real double-booking detection: for every pair of slots on the same day
// with overlapping times, flag it if they share a teacher, a room label, or
// a class-section (a class can't be in two places, a teacher can't teach
// two classes, a room can't host two classes at once).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);

    const rows = await db
      .select({
        id: classScheduleSlots.id,
        dayOfWeek: classScheduleSlots.dayOfWeek,
        startTime: classScheduleSlots.startTime,
        endTime: classScheduleSlots.endTime,
        classSectionId: classScheduleSlots.classSectionId,
        teacherId: classScheduleSlots.teacherId,
        roomLabel: classScheduleSlots.roomLabel,
        className: classes.name,
        sectionName: sections.name,
        subjectName: subjects.name,
        teacherName: user.name,
      })
      .from(classScheduleSlots)
      .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .innerJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .innerJoin(user, eq(classScheduleSlots.teacherId, user.id))
      .where(eq(classScheduleSlots.tenantId, tenantId));

    const slots: SlotRow[] = rows.map(r => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      classSectionId: r.classSectionId,
      teacherId: r.teacherId,
      roomLabel: r.roomLabel,
      label: `${r.className} ${r.sectionName} - ${r.subjectName}`.trim(),
      teacherName: r.teacherName,
      roomDisplay: r.roomLabel ?? '—',
    }));

    const conflicts: {
      type: 'teacher' | 'room' | 'class_section';
      dayOfWeek: string;
      slotA: { id: string; label: string; startTime: string; endTime: string };
      slotB: { id: string; label: string; startTime: string; endTime: string };
      detail: string;
    }[] = [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        if (!overlaps(a, b)) {
          continue;
        }
        const toSummary = (s: SlotRow) => ({ id: s.id, label: s.label, startTime: s.startTime, endTime: s.endTime });
        if (a.teacherId === b.teacherId) {
          conflicts.push({ type: 'teacher', dayOfWeek: a.dayOfWeek, slotA: toSummary(a), slotB: toSummary(b), detail: `${a.teacherName} est assigné à deux cours en même temps` });
        }
        if (a.roomLabel && b.roomLabel && a.roomLabel === b.roomLabel) {
          conflicts.push({ type: 'room', dayOfWeek: a.dayOfWeek, slotA: toSummary(a), slotB: toSummary(b), detail: `Salle "${a.roomLabel}" réservée pour deux cours en même temps` });
        }
        if (a.classSectionId === b.classSectionId) {
          conflicts.push({ type: 'class_section', dayOfWeek: a.dayOfWeek, slotA: toSummary(a), slotB: toSummary(b), detail: `La classe a deux cours en même temps` });
        }
      }
    }

    return NextResponse.json({ success: true, data: conflicts, total: conflicts.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
