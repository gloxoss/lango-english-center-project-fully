import { and, eq, max } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { academicRooms, classScheduleSlots, classSections, classSubjects, sessionYears, subjectTeachers, timetableVersions } from '@/models/Schema';

const generateSchema = z.object({
  sessionYearId: z.string().uuid({ message: 'L\'identifiant de la session est requis.' }),
}).strict();

// Canonical weekly grid: 6 teaching days x 7 one-hour periods. Rooms are
// optional in classScheduleSlots (roomLabel is nullable), so a scarce room
// stock degrades to unassigned rooms rather than blocking placement.
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const PERIODS = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
] as const;

type Requirement = {
  classSectionId: string;
  classSubjectId: string;
  offeringId: string | null;
  teachers: string[];
};

type Occupancy = Map<string, { teachers: Set<string>; sections: Set<string>; rooms: Set<string> }>;

function occupancyKey(day: string, start: string): string {
  return `${day}|${start}`;
}

function getCell(map: Occupancy, day: string, start: string) {
  const key = occupancyKey(day, start);
  let cell = map.get(key);
  if (!cell) {
    cell = { teachers: new Set(), sections: new Set(), rooms: new Set() };
    map.set(key, cell);
  }
  return cell;
}

// Greedy constraint solver: places every required weekly period into the first
// conflict-free (day, period, teacher, room) slot it finds, honouring the same
// three no-overlap rules enforced by assertSlotIsValid - a teacher, class
// section, or room can never be double-booked. Requirements with the fewest
// eligible teachers are scheduled first so scarce teachers get placed early.
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'academics.manage');

    const body = await parseJson(request, generateSchema);

    const [session] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(eq(sessionYears.id, body.sessionYearId), eq(sessionYears.tenantId, tenantId)))
      .limit(1);

    if (!session) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La session académique est introuvable.');
    }

    const [sections, classSubjectsRows, subjectTeacherRows, roomRows] = await Promise.all([
      db
        .select({ id: classSections.id, classId: classSections.classId })
        .from(classSections)
        .where(eq(classSections.tenantId, tenantId)),
      db
        .select({ id: classSubjects.id, classId: classSubjects.classId, offeringId: classSubjects.offeringId, weeklyMinutes: classSubjects.weeklyMinutes })
        .from(classSubjects)
        .where(and(eq(classSubjects.tenantId, tenantId), eq(classSubjects.isActive, true))),
      db
        .select({ classSectionId: subjectTeachers.classSectionId, classSubjectId: subjectTeachers.classSubjectId, teacherId: subjectTeachers.teacherId })
        .from(subjectTeachers)
        .where(eq(subjectTeachers.tenantId, tenantId)),
      db
        .select({ name: academicRooms.name })
        .from(academicRooms)
        .where(and(eq(academicRooms.tenantId, tenantId), eq(academicRooms.isActive, true))),
    ]);

    const roomNames = roomRows.map(r => r.name).sort();

    // Map: classSubjectId -> teachers eligible for it (across all sections),
    // and per-section lookups so a subject is only taught to a section by a
    // teacher actually assigned to that (section, subject) pair.
    const teachersByPair = new Map<string, string[]>();
    for (const st of subjectTeacherRows) {
      const key = `${st.classSectionId}|${st.classSubjectId}`;
      const existing = teachersByPair.get(key) ?? [];
      if (!existing.includes(st.teacherId)) {
        existing.push(st.teacherId);
      }
      teachersByPair.set(key, existing);
    }

    const classSubjectsByClass = new Map<string, typeof classSubjectsRows>();
    for (const cs of classSubjectsRows) {
      const existing = classSubjectsByClass.get(cs.classId) ?? [];
      existing.push(cs);
      classSubjectsByClass.set(cs.classId, existing);
    }

    // Assemble requirements: each (section, class-subject) pair that has at
    // least one assigned teacher contributes N weekly periods, where N derives
    // from the subject's weekly minutes (default 60min -> 1 period, capped at 7).
    const requirements: Requirement[] = [];
    let skippedNoTeacher = 0;

    for (const section of sections) {
      const subjects = classSubjectsByClass.get(section.classId) ?? [];
      for (const cs of subjects) {
        const teachers = teachersByPair.get(`${section.id}|${cs.id}`) ?? [];
        if (teachers.length === 0) {
          skippedNoTeacher++;
          continue;
        }
        const minutes = cs.weeklyMinutes ?? 60;
        const periods = Math.min(7, Math.max(1, Math.round(minutes / 60)));
        for (let p = 0; p < periods; p++) {
          requirements.push({
            classSectionId: section.id,
            classSubjectId: cs.id,
            offeringId: cs.offeringId,
            teachers,
          });
        }
      }
    }

    // Most-constrained-first ordering improves placement success.
    requirements.sort((a, b) => a.teachers.length - b.teachers.length);

    const occupancy: Occupancy = new Map();
    const placed: Array<{
      classSectionId: string;
      classSubjectId: string;
      teacherId: string;
      dayOfWeek: (typeof DAYS)[number];
      startTime: string;
      endTime: string;
      roomLabel: string | null;
      offeringId: string | null;
    }> = [];
    let unplaced = 0;

    for (const req of requirements) {
      let assigned = false;
      outer: for (const day of DAYS) {
        for (const period of PERIODS) {
          const cell = getCell(occupancy, day, period.start);
          if (cell.sections.has(req.classSectionId)) continue;
          for (const teacherId of req.teachers) {
            if (cell.teachers.has(teacherId)) continue;
            const room = roomNames.find(r => !cell.rooms.has(r)) ?? null;
            cell.teachers.add(teacherId);
            cell.sections.add(req.classSectionId);
            if (room) cell.rooms.add(room);
            placed.push({
              classSectionId: req.classSectionId,
              classSubjectId: req.classSubjectId,
              teacherId,
              dayOfWeek: day,
              startTime: period.start,
              endTime: period.end,
              roomLabel: room,
              offeringId: req.offeringId,
            });
            assigned = true;
            break outer;
          }
        }
      }
      if (!assigned) {
        unplaced++;
      }
    }

    if (placed.length === 0) {
      throw new ApiError(422, 'NOTHING_TO_GENERATE', 'Aucun créneau n\'a pu être généré : vérifiez les matières assignées et les enseignants affectés.');
    }

    const [maxVersion] = await db
      .select({ maxNum: max(timetableVersions.versionNumber) })
      .from(timetableVersions)
      .where(and(eq(timetableVersions.tenantId, tenantId), eq(timetableVersions.sessionYearId, body.sessionYearId)));

    const nextVersionNumber = (maxVersion?.maxNum ?? 0) + 1;

    const result = await db.transaction(async (tx) => {
      const [version] = await tx
        .insert(timetableVersions)
        .values({
          tenantId,
          sessionYearId: body.sessionYearId,
          status: 'draft',
          versionNumber: nextVersionNumber,
          createdBy: ctx.userId,
        })
        .returning();

      if (!version) {
        throw new ApiError(500, 'INSERT_FAILED', 'La version brouillon n\'a pas pu être créée.');
      }

      for (const slot of placed) {
        await tx.insert(classScheduleSlots).values({
          tenantId,
          versionId: version.id,
          classSectionId: slot.classSectionId,
          classSubjectId: slot.classSubjectId,
          teacherId: slot.teacherId,
          dayOfWeek: slot.dayOfWeek as (typeof DAYS)[number],
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomLabel: slot.roomLabel,
          offeringId: slot.offeringId,
        });
      }

      return version;
    });

    recordAudit(ctx, 'create', 'timetable_version', result.id, {
      generatedSlots: placed.length,
      skippedNoTeacher,
      unplaced,
    });

    return NextResponse.json({
      success: true,
      data: {
        version: result,
        slotsCreated: placed.length,
        requirements: requirements.length,
        skippedNoTeacher,
        unplaced,
      },
      message: `${placed.length} créneau(x) généré(s) dans la version brouillon v${result.versionNumber}.`,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
