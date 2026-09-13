import type { SolverConstraints, SolverSlot } from '@/libs/services/timetable-solver';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  applyMoves,
  detectConflicts,

  solveTimetable,
} from '@/libs/services/timetable-solver';
import {
  academicRooms,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  sections,
  subjects,
  teacherAvailability,
  user,
} from '@/models/Schema';

const resolveSchema = z.object({
  /**
   * Without this the endpoint is a dry run. Rewriting a school's week is not
   * something to do as a side effect of asking whether it could be done.
   */
  apply: z.boolean().optional().default(false),
  /** Honour declared teacher availability. On by default. */
  respectTeacherAvailability: z.boolean().optional().default(true),
  /** Refuse rooms too small for the class. On by default. */
  respectRoomCapacity: z.boolean().optional().default(true),
}).strict();

/**
 * Reads the schedule through whichever executor is passed.
 *
 * The transaction handle has to be threadable: re-verifying through `db` inside a
 * transaction reads a snapshot that cannot see the uncommitted moves, so the
 * check would pass on the old timetable and prove nothing.
 */
type Executor = Pick<typeof db, 'select'>;

async function loadSlots(tenantId: string, exec: Executor = db): Promise<(SolverSlot & { label: string })[]> {
  const rows = await exec
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
    })
    .from(classScheduleSlots)
    .innerJoin(classSections, eq(classScheduleSlots.classSectionId, classSections.id))
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .innerJoin(sections, eq(classSections.sectionId, sections.id))
    .innerJoin(classSubjects, eq(classScheduleSlots.classSubjectId, classSubjects.id))
    .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
    .where(eq(classScheduleSlots.tenantId, tenantId));

  return rows.map(r => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    classSectionId: r.classSectionId,
    teacherId: r.teacherId,
    roomLabel: r.roomLabel,
    label: `${r.className}-${r.sectionName} (${r.subjectName})`,
  }));
}

async function loadConstraints(
  tenantId: string,
  opts: { availability: boolean; capacity: boolean },
): Promise<SolverConstraints> {
  const constraints: SolverConstraints = {};

  if (opts.availability) {
    const rows = await db
      .select({
        teacherId: teacherAvailability.teacherId,
        dayOfWeek: teacherAvailability.dayOfWeek,
        startTime: teacherAvailability.startTime,
        endTime: teacherAvailability.endTime,
      })
      .from(teacherAvailability)
      .where(eq(teacherAvailability.tenantId, tenantId));

    // Positive windows, exactly as stored. A teacher with no rows is absent from
    // the map and therefore unconstrained.
    const byTeacher = new Map<string, { dayOfWeek: string; startTime: string; endTime: string }[]>();
    for (const row of rows) {
      const list = byTeacher.get(row.teacherId);
      const window = { dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime };
      if (list) {
        list.push(window);
      } else {
        byTeacher.set(row.teacherId, [window]);
      }
    }
    constraints.teacherAvailable = byTeacher;
  }

  if (opts.capacity) {
    const rooms = await db
      .select({ name: academicRooms.name, code: academicRooms.code, capacity: academicRooms.capacity })
      .from(academicRooms)
      .where(eq(academicRooms.tenantId, tenantId));

    // Slots reference a room by free-text label, which may be either the room's
    // name or its code, so both keys are registered.
    const capacity = new Map<string, number>();
    for (const room of rooms) {
      if (room.capacity === null) {
        continue;
      }
      capacity.set(room.name, room.capacity);
      if (room.code) {
        capacity.set(room.code, room.capacity);
      }
    }
    constraints.roomCapacity = capacity;

    const sizes = await db
      .select({ classSectionId: user.classSectionId })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

    const sectionSize = new Map<string, number>();
    for (const row of sizes) {
      if (!row.classSectionId) {
        continue;
      }
      sectionSize.set(row.classSectionId, (sectionSize.get(row.classSectionId) ?? 0) + 1);
    }
    constraints.sectionSize = sectionSize;
  }

  return constraints;
}

/**
 * Resolves every timetable clash at once.
 *
 * The existing conflicts endpoint offers fixes one pair at a time, each computed
 * against the current schedule — so applying two in sequence can reintroduce a
 * clash neither knew about. This runs a real search over the combination of moves
 * instead, and reports honestly when it cannot clear everything.
 *
 * Defaults to a dry run. With `apply: true` the plan is written in one
 * transaction and re-verified inside it: a partially applied plan is worse than
 * the conflicts it set out to fix.
 */
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'academics.manage');

    const body = await parseJson(request, resolveSchema);

    const slots = await loadSlots(tenantId);
    const before = detectConflicts(slots);

    if (before.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          applied: false,
          solved: true,
          conflictsBefore: 0,
          conflictsAfter: 0,
          moves: [],
          unresolved: [],
          message: 'Aucun conflit détecté dans l\'emploi du temps.',
        },
      });
    }

    const constraints = await loadConstraints(tenantId, {
      availability: body.respectTeacherAvailability,
      capacity: body.respectRoomCapacity,
    });

    const result = solveTimetable(slots, constraints);

    if (!body.apply) {
      return NextResponse.json({
        success: true,
        data: {
          applied: false,
          solved: result.solved,
          conflictsBefore: before.length,
          conflictsAfter: result.unresolved.length,
          moves: result.moves,
          unresolved: result.unresolved,
          exhaustedBudget: result.exhaustedBudget,
        },
      });
    }

    if (result.moves.length === 0) {
      throw new ApiError(409, 'NO_RESOLUTION', 'Aucun déplacement ne permet de résoudre ces conflits.');
    }

    await db.transaction(async (tx) => {
      for (const move of result.moves) {
        const [updated] = await tx
          .update(classScheduleSlots)
          .set({
            dayOfWeek: move.to.dayOfWeek as typeof classScheduleSlots.$inferInsert['dayOfWeek'],
            startTime: move.to.startTime,
            endTime: move.to.endTime,
            roomLabel: move.to.roomLabel,
            updatedAt: new Date().toISOString(),
          })
          .where(and(
            eq(classScheduleSlots.id, move.slotId),
            eq(classScheduleSlots.tenantId, tenantId),
          ))
          .returning({ id: classScheduleSlots.id });

        if (!updated) {
          // A slot that vanished mid-plan means the timetable changed under us;
          // the rest of the plan was computed against a schedule that no longer
          // exists, so none of it may stand.
          throw new ApiError(409, 'SCHEDULE_CHANGED', 'L\'emploi du temps a changé pendant le calcul. Relancez la résolution.');
        }
      }

      // Re-verified from the rows actually written, inside the transaction, so a
      // plan that looked right in memory cannot leave the timetable worse.
      const after = detectConflicts(await loadSlots(tenantId, tx));
      if (after.length > before.length) {
        throw new ApiError(409, 'RESOLUTION_REGRESSED', 'La résolution aurait augmenté le nombre de conflits; aucune modification n\'a été appliquée.');
      }
    });

    const verified = detectConflicts(applyMoves(slots, result.moves));

    recordAudit(context, 'update', 'timetable_resolution', tenantId, {
      moveCount: result.moves.length,
      conflictsBefore: before.length,
      conflictsAfter: verified.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        applied: true,
        solved: verified.length === 0,
        conflictsBefore: before.length,
        conflictsAfter: verified.length,
        moves: result.moves,
        unresolved: verified,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
