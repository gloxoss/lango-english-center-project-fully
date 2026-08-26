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

type Suggestion = {
  id: string;
  moveSlotId: string;
  kind: 'time' | 'room';
  label: string;
  from: { startTime: string; endTime: string; roomLabel: string | null };
  to: { startTime: string; endTime: string; roomLabel: string | null };
  detail: string;
};

function suggestionId(moveId: string, kind: 'time' | 'room', toStart: string, toEnd: string, toRoom: string | null): string {
  return `${moveId}:${kind}:${toStart}:${toEnd}:${toRoom ?? ''}`;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

type Placement = Pick<SlotRow, 'dayOfWeek' | 'teacherId' | 'roomLabel' | 'classSectionId' | 'startTime' | 'endTime'>;

function placementIsFree(others: SlotRow[], p: Placement): boolean {
  for (const s of others) {
    if (s.dayOfWeek !== p.dayOfWeek) continue;
    if (!(s.startTime < p.endTime && p.startTime < s.endTime)) continue;
    if (s.teacherId === p.teacherId) return false;
    if (s.classSectionId === p.classSectionId) return false;
    if (p.roomLabel && s.roomLabel && s.roomLabel === p.roomLabel) return false;
  }
  return true;
}

// Candidate time moves: periods (right after another slot on the same day
// ends) that free `move` from every overlap - teacher, room and class-section -
// including its conflict partner. Returns up to `limit` conflict-free options.
function suggestTimeMoves(move: SlotRow, slots: SlotRow[], limit = 3): Suggestion[] {
  const others = slots.filter(s => s.id !== move.id);
  const duration = toMinutes(move.endTime) - toMinutes(move.startTime);
  const startCandidates = [...new Set(others.filter(s => s.dayOfWeek === move.dayOfWeek).map(s => s.endTime))].sort();
  const out: Suggestion[] = [];

  for (const start of startCandidates) {
    if (out.length >= limit) break;
    const newStart = toMinutes(start);
    const newEnd = newStart + duration;
    if (newEnd > 24 * 60 - 1) continue;
    if (newEnd <= newStart) continue;
    const toStart = fromMinutes(newStart);
    const toEnd = fromMinutes(newEnd);
    if (placementIsFree(others, {
      dayOfWeek: move.dayOfWeek,
      teacherId: move.teacherId,
      roomLabel: move.roomLabel,
      classSectionId: move.classSectionId,
      startTime: toStart,
      endTime: toEnd,
    })) {
      out.push({
        id: suggestionId(move.id, 'time', toStart, toEnd, move.roomLabel),
        moveSlotId: move.id,
        kind: 'time',
        label: move.label,
        from: { startTime: move.startTime, endTime: move.endTime, roomLabel: move.roomLabel },
        to: { startTime: toStart, endTime: toEnd, roomLabel: move.roomLabel },
        detail: `Déplacer « ${move.label} » vers ${toStart}–${toEnd} (créneau libre).`,
      });
    }
  }
  return out;
}

// Candidate room moves: rooms free at `move`'s current time (or unassigning the
// room) clear the room double-booking while the time stays put. Only meaningful
// for room conflicts, so only attached to those.
function suggestRoomMoves(move: SlotRow, slots: SlotRow[], limit = 3): Suggestion[] {
  if (!move.roomLabel) return [];
  const others = slots.filter(s => s.id !== move.id);
  const rooms = [...new Set(others.map(s => s.roomLabel).filter((r): r is string => Boolean(r)))].sort();
  const placement = {
    dayOfWeek: move.dayOfWeek,
    teacherId: move.teacherId,
    classSectionId: move.classSectionId,
    startTime: move.startTime,
    endTime: move.endTime,
  };
  const out: Suggestion[] = [];
  for (const room of rooms) {
    if (out.length >= limit) break;
    if (room === move.roomLabel) continue;
    if (placementIsFree(others, { ...placement, roomLabel: room })) {
      out.push({
        id: suggestionId(move.id, 'room', move.startTime, move.endTime, room),
        moveSlotId: move.id,
        kind: 'room',
        label: move.label,
        from: { startTime: move.startTime, endTime: move.endTime, roomLabel: move.roomLabel },
        to: { startTime: move.startTime, endTime: move.endTime, roomLabel: room },
        detail: `Déplacer « ${move.label} » vers la salle « ${room} » (libre sur ce créneau).`,
      });
    }
  }
  if (placementIsFree(others, { ...placement, roomLabel: null })) {
    out.push({
      id: suggestionId(move.id, 'room', move.startTime, move.endTime, null),
      moveSlotId: move.id,
      kind: 'room',
      label: move.label,
      from: { startTime: move.startTime, endTime: move.endTime, roomLabel: move.roomLabel },
      to: { startTime: move.startTime, endTime: move.endTime, roomLabel: null },
      detail: `Retirer la salle « ${move.roomLabel} » de « ${move.label} » (créneau horaire inchangé).`,
    });
  }
  return out;
}

// Assembles up to 3 distinct, conflict-free fixes for a pair of overlapping
// slots. Time moves of the later slot (b) are preferred first, then room swaps
// for room clashes, then the same treatment on the earlier slot (a).
function buildSuggestions(a: SlotRow, b: SlotRow, slots: SlotRow[], type: 'teacher' | 'room' | 'class_section'): Suggestion[] {
  const candidates: Suggestion[] = [
    ...suggestTimeMoves(b, slots, 3),
    ...(type === 'room' ? suggestRoomMoves(b, slots, 3) : []),
    ...suggestTimeMoves(a, slots, 3),
    ...(type === 'room' ? suggestRoomMoves(a, slots, 3) : []),
  ];
  const seen = new Set<string>();
  const unique: Suggestion[] = [];
  for (const s of candidates) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    unique.push(s);
    if (unique.length >= 3) break;
  }
  return unique;
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
      suggestions: Suggestion[];
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
          conflicts.push({ type: 'teacher', dayOfWeek: a.dayOfWeek, slotA: toSummary(a), slotB: toSummary(b), detail: `${a.teacherName} est assigné à deux cours en même temps`, suggestions: buildSuggestions(a, b, slots, 'teacher') });
        }
        if (a.roomLabel && b.roomLabel && a.roomLabel === b.roomLabel) {
          conflicts.push({ type: 'room', dayOfWeek: a.dayOfWeek, slotA: toSummary(a), slotB: toSummary(b), detail: `Salle "${a.roomLabel}" réservée pour deux cours en même temps`, suggestions: buildSuggestions(a, b, slots, 'room') });
        }
        if (a.classSectionId === b.classSectionId) {
          conflicts.push({ type: 'class_section', dayOfWeek: a.dayOfWeek, slotA: toSummary(a), slotB: toSummary(b), detail: `La classe a deux cours en même temps`, suggestions: buildSuggestions(a, b, slots, 'class_section') });
        }
      }
    }

    return NextResponse.json({ success: true, data: conflicts, total: conflicts.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
