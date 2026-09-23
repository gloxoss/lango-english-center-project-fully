import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  admissionInterviews,
  applicants,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  sections,
  subjects,
} from '@/models/Schema';

export type RoomOccupancy = 'Occupied' | 'Available' | 'Maintenance';

export type RoomScheduleEntry = {
  /** Display range, e.g. "08:00 - 10:00". */
  time: string;
  /** Display label, e.g. "2BAC-A (Mathématiques)". */
  course: string;
  startTime: string;
  endTime: string;
};

export type RoomRow = {
  id: string;
  name: string;
  code: string | null;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  roomType: string | null;
  equipment: string[];
  status: 'available' | 'maintenance';
  isActive: boolean;
};

export type RoomWithOccupancy = RoomRow & {
  occupancyStatus: RoomOccupancy;
  currentClass: string | null;
  schedule: RoomScheduleEntry[];
};

/**
 * class_schedule_slots.day_of_week is a pg enum keyed by English weekday name;
 * Date#getDay() is 0=Sunday. This maps one onto the other.
 */
export const WEEKDAY_BY_INDEX = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type Weekday = (typeof WEEKDAY_BY_INDEX)[number];

export function weekdayOf(date: Date): Weekday {
  return WEEKDAY_BY_INDEX[date.getDay()]!;
}

/** "HH:MM", the same shape class_schedule_slots stores. */
export function clockOf(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Half-open interval: a class ending at 10:00 frees the room at 10:00, so a
 * slot starting at 10:00 is the one that owns it. Times are zero-padded "HH:MM",
 * so lexical comparison is chronological.
 */
export function slotCovers(slot: { startTime: string; endTime: string }, nowHHMM: string): boolean {
  return slot.startTime <= nowHHMM && nowHHMM < slot.endTime;
}

/**
 * Occupancy is derived, never stored, so it cannot drift from the timetable.
 *
 * Maintenance outranks a scheduled class on purpose: if a room is out of
 * service, reporting "Occupied" would tell an admin the opposite of the thing
 * they need to act on (relocate that class).
 */
export function deriveOccupancy(
  room: Pick<RoomRow, 'status'>,
  scheduleToday: RoomScheduleEntry[],
  nowHHMM: string,
): { occupancyStatus: RoomOccupancy; currentClass: string | null } {
  if (room.status === 'maintenance') {
    return { occupancyStatus: 'Maintenance', currentClass: null };
  }

  const current = scheduleToday.find(entry => slotCovers(entry, nowHHMM));
  if (current) {
    return { occupancyStatus: 'Occupied', currentClass: current.course };
  }

  return { occupancyStatus: 'Available', currentClass: null };
}

/**
 * Timetable slots reference a room by free-text `room_label`, not by FK, so a
 * room matches a slot when the label equals its name or its code, compared
 * case- and whitespace-insensitively.
 */
export function normalizeLabel(label: string | null | undefined): string {
  return (label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function roomLabelKeys(room: Pick<RoomRow, 'name' | 'code'>): string[] {
  // Deduped: a room whose code equals its name must not collect its slots twice.
  return [...new Set([normalizeLabel(room.name), normalizeLabel(room.code)])].filter(Boolean);
}

/**
 * Every timetable slot for the tenant on `weekday`, keyed by normalized room
 * label. One query for the whole page: a tenant's daily slot count is in the
 * hundreds, so filtering in memory beats N per-room queries.
 */
export async function fetchScheduleByRoomLabel(
  tenantId: string,
  weekday: Weekday,
): Promise<Map<string, RoomScheduleEntry[]>> {
  const rows = await db
    .select({
      roomLabel: classScheduleSlots.roomLabel,
      startTime: classScheduleSlots.startTime,
      endTime: classScheduleSlots.endTime,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
    })
    .from(classScheduleSlots)
    .innerJoin(classSections, eq(classSections.id, classScheduleSlots.classSectionId))
    .innerJoin(classes, eq(classes.id, classSections.classId))
    .innerJoin(sections, eq(sections.id, classSections.sectionId))
    .innerJoin(classSubjects, eq(classSubjects.id, classScheduleSlots.classSubjectId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .where(and(
      eq(classScheduleSlots.tenantId, tenantId),
      eq(classScheduleSlots.dayOfWeek, weekday),
    ))
    .orderBy(classScheduleSlots.startTime);

  const byLabel = new Map<string, RoomScheduleEntry[]>();

  for (const row of rows) {
    const key = normalizeLabel(row.roomLabel);
    if (!key) {
      continue;
    }

    const entry: RoomScheduleEntry = {
      time: `${row.startTime} - ${row.endTime}`,
      course: `${row.className}-${row.sectionName} (${row.subjectName})`,
      startTime: row.startTime,
      endTime: row.endTime,
    };

    const existing = byLabel.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      byLabel.set(key, [entry]);
    }
  }

  // Also integrate active scheduled admission interviews for room reservation
  try {
    const interviewRows = await db
      .select({
        location: admissionInterviews.location,
        scheduledAt: admissionInterviews.scheduledAt,
        applicantFirstName: applicants.firstName,
        applicantLastName: applicants.lastName,
      })
      .from(admissionInterviews)
      .innerJoin(applicants, eq(applicants.id, admissionInterviews.applicantId))
      .where(
        and(
          eq(admissionInterviews.tenantId, tenantId),
          eq(admissionInterviews.status, 'scheduled'),
        ),
      );

    const nowIsoDay = new Date().toISOString().slice(0, 10);

    for (const interview of interviewRows) {
      if (!interview.location || !interview.scheduledAt) continue;
      const key = normalizeLabel(interview.location);
      if (!key) continue;

      const interviewDate = new Date(interview.scheduledAt);
      if (isNaN(interviewDate.getTime())) continue;

      const interviewDay = interviewDate.toISOString().slice(0, 10);
      const isToday = interviewDay === nowIsoDay;
      const matchesWeekday = weekdayOf(interviewDate) === weekday;

      if (!isToday && !matchesWeekday) continue;

      const startH = String(interviewDate.getHours()).padStart(2, '0');
      const startM = String(interviewDate.getMinutes()).padStart(2, '0');
      const endH = String(Math.min(23, interviewDate.getHours() + 1)).padStart(2, '0');
      const startTime = `${startH}:${startM}`;
      const endTime = `${endH}:${startM}`;

      const entry: RoomScheduleEntry = {
        time: `${startTime} - ${endTime}`,
        course: `Entretien : ${interview.applicantFirstName} ${interview.applicantLastName}`,
        startTime,
        endTime,
      };

      const existing = byLabel.get(key);
      if (existing) {
        existing.push(entry);
      } else {
        byLabel.set(key, [entry]);
      }
    }
  } catch (err) {
    console.error('Failed to attach admission interview schedule to rooms', err);
  }

  return byLabel;
}

/** Attaches today's schedule and the derived occupancy to each room row. */
export function attachOccupancy(
  rooms: RoomRow[],
  scheduleByLabel: Map<string, RoomScheduleEntry[]>,
  now: Date,
): RoomWithOccupancy[] {
  const nowHHMM = clockOf(now);

  return rooms.map((room) => {
    const schedule = roomLabelKeys(room).flatMap(key => scheduleByLabel.get(key) ?? []);
    schedule.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { ...room, schedule, ...deriveOccupancy(room, schedule, nowHHMM) };
  });
}
