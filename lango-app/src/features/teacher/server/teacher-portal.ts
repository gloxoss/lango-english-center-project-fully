import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { weekdayNameFor } from '@/libs/api/school-day';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  sections,
  sessionYears,
  subjects,
  subjectTeachers,
  timetableVersions,
  user,
} from '@/models/Schema';

/**
 * Teacher-portal data source.
 *
 * The portal's "today" and "timetable" tabs originally read `timetable_slots`,
 * the legacy table the product never writes (it is seed-only; the teacher
 * detail screen itself counts it as `legacy_timetable_slots`). The canonical
 * published timetable is `class_schedule_slots` — the table the timetable
 * generator, conflicts solver, room registry and the purpose-built
 * "Emploi du temps enseignant" page all use. A teacher's portal must agree with
 * the timetable the school actually published, so both endpoints read it here.
 */

export type TeacherSession = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  group: string;
  room: string;
};

/** "H:MM" and "HH:MM" both occur (legacy seeds are not zero-padded). */
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Chronological order: lexicographic compare puts "10:00" before "8:00". */
export function sortByStartTime<T extends { startTime: string; endTime: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => minutesOf(a.startTime) - minutesOf(b.startTime) || minutesOf(a.endTime) - minutesOf(b.endTime));
}

/** The published timetable of the tenant's default session, when one exists. */
async function resolvePublishedVersionId(tenantId: string): Promise<string | null> {
  const [defaultSession] = await db
    .select({ id: sessionYears.id })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);

  if (!defaultSession) {
    return null;
  }

  const [published] = await db
    .select({ id: timetableVersions.id })
    .from(timetableVersions)
    .where(and(
      eq(timetableVersions.tenantId, tenantId),
      eq(timetableVersions.sessionYearId, defaultSession.id),
      eq(timetableVersions.status, 'published'),
    ))
    .limit(1);

  return published?.id ?? null;
}

export async function listTeacherSessions(
  tenantId: string,
  teacherId: string,
  dayOfWeek?: string,
): Promise<TeacherSession[]> {
  const versionId = await resolvePublishedVersionId(tenantId);

  const filters = [
    eq(classScheduleSlots.tenantId, tenantId),
    eq(classScheduleSlots.teacherId, teacherId),
  ];
  if (versionId) {
    filters.push(eq(classScheduleSlots.versionId, versionId));
  }
  if (dayOfWeek) {
    filters.push(eq(classScheduleSlots.dayOfWeek, dayOfWeek as typeof classScheduleSlots.dayOfWeek.enumValues[number]));
  }

  const rows = await db
    .select({
      dayOfWeek: classScheduleSlots.dayOfWeek,
      startTime: classScheduleSlots.startTime,
      endTime: classScheduleSlots.endTime,
      roomLabel: classScheduleSlots.roomLabel,
      className: classes.name,
      sectionName: sections.name,
      subjectName: subjects.name,
    })
    .from(classScheduleSlots)
    .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .innerJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(and(...filters));

  return sortByStartTime(rows.map(row => ({
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    group: `${row.className} ${row.sectionName}`.trim(),
    room: row.roomLabel ?? '',
  })));
}

type TeacherSectionBase = {
  classSectionId: string;
  name: string;
  subjects: string[];
};

/**
 * The sections a teacher currently teaches — homeroom and subject assignments
 * alike — with their subject list.
 *
 * The previous implementation only read `class_teachers`, so a subject-only
 * teacher (the common case) saw zero classes while their timetable showed a
 * full week. `getTeacherClassSectionIds` is the canonical current-assignment
 * scope used by grade entry.
 */
async function loadTeacherSections(tenantId: string, teacherId: string): Promise<TeacherSectionBase[]> {
  const sectionIds = await getTeacherClassSectionIds(tenantId, teacherId);
  if (sectionIds.length === 0) {
    return [];
  }

  const today = casablancaTodayIso();

  const [sectionRows, subjectRows] = await Promise.all([
    db
      .select({
        classSectionId: classSections.id,
        className: classes.name,
        sectionName: sections.name,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(classSections.tenantId, tenantId), inArray(classSections.id, sectionIds))),
    db
      .select({
        classSectionId: subjectTeachers.classSectionId,
        subjectName: subjects.name,
      })
      .from(subjectTeachers)
      .innerJoin(subjects, eq(subjectTeachers.subjectId, subjects.id))
      .where(and(
        eq(subjectTeachers.tenantId, tenantId),
        eq(subjectTeachers.teacherId, teacherId),
        eq(subjectTeachers.status, 'active'),
        or(isNull(subjectTeachers.endsOn), gte(subjectTeachers.endsOn, today))!,
        inArray(subjectTeachers.classSectionId, sectionIds),
      )),
  ]);

  const subjectsBySection = new Map<string, string[]>();
  for (const row of subjectRows) {
    const list = subjectsBySection.get(row.classSectionId) ?? [];
    if (!list.includes(row.subjectName)) {
      list.push(row.subjectName);
    }
    subjectsBySection.set(row.classSectionId, list);
  }

  return sectionRows
    .map(row => ({
      classSectionId: row.classSectionId,
      name: `${row.className} ${row.sectionName}`.trim(),
      subjects: subjectsBySection.get(row.classSectionId) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type TeacherClass = TeacherSectionBase & { students: number };

/** The teacher's sections with their live student count. */
export async function listTeacherClasses(tenantId: string, teacherId: string): Promise<TeacherClass[]> {
  const sections = await loadTeacherSections(tenantId, teacherId);
  if (sections.length === 0) {
    return [];
  }

  const sectionIds = sections.map(section => section.classSectionId);
  const studentCountRows = await db
    .select({ classSectionId: user.classSectionId, n: sql<number>`count(*)::int` })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      inArray(user.classSectionId, sectionIds),
    ))
    .groupBy(user.classSectionId);

  const studentsBySection = new Map<string, number>();
  for (const row of studentCountRows) {
    if (row.classSectionId) {
      studentsBySection.set(row.classSectionId, Number(row.n ?? 0));
    }
  }

  return sections.map(section => ({
    ...section,
    students: studentsBySection.get(section.classSectionId) ?? 0,
  }));
}

export type TeacherRoster = TeacherSectionBase & { students: string[] };

/** Same sections as listTeacherClasses, with the live roster names. */
export async function listTeacherRosters(tenantId: string, teacherId: string): Promise<TeacherRoster[]> {
  const sections = await loadTeacherSections(tenantId, teacherId);
  if (sections.length === 0) {
    return [];
  }

  const sectionIds = sections.map(section => section.classSectionId);
  const studentRows = await db
    .select({ classSectionId: user.classSectionId, name: user.name })
    .from(user)
    .where(and(
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
      inArray(user.classSectionId, sectionIds),
    ))
    .orderBy(user.name);

  const rosterBySection = new Map<string, string[]>();
  for (const row of studentRows) {
    if (!row.classSectionId) {
      continue;
    }
    const list = rosterBySection.get(row.classSectionId) ?? [];
    list.push(row.name);
    rosterBySection.set(row.classSectionId, list);
  }

  return sections.map(section => ({
    ...section,
    students: rosterBySection.get(section.classSectionId) ?? [],
  }));
}

/** The school's calendar day in Casablanca, not the server's UTC day. */
export function teacherTodayIso(now: Date = new Date()): string {
  return casablancaTodayIso(now);
}

export function teacherTodayWeekday(now: Date = new Date()): string {
  return weekdayNameFor(casablancaTodayIso(now));
}
