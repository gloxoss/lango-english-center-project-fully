import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { classSessionExceptions, classScheduleSlots } from '@/models/Schema';

/**
 * A dated deviation from the weekly timetable (phase 6).
 *
 * One exception per occurrence: writing a second one for the same lesson and day
 * replaces the first rather than accumulating contradictory rows, which is what
 * the unique index enforces. The base timetable is never touched — cancelling a
 * lesson for a day must not rewrite the school's weekly schedule.
 *
 * Every exception requires a reason: an unexplained cancellation is
 * indistinguishable from an oversight, and the reason is the history.
 */

const createExceptionSchema = z.object({
  classScheduleSlotId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD attendu'),
  type: z.enum(['CANCELLED', 'SUBSTITUTE', 'ROOM_CHANGE', 'RESCHEDULE']),
  reason: z.string().trim().min(3).max(500),
  substituteTeacherId: z.string().min(1).nullable().optional(),
  roomLabel: z.string().trim().min(1).max(100).nullable().optional(),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
}).strict();

const TIME_RE = /^\d{1,2}:\d{2}$/;

function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const body = await parseJson(request, createExceptionSchema);

    // Each type changes exactly one thing; requiring its field stops a
    // ROOM_CHANGE being saved with no room, which would silently do nothing.
    if (body.type === 'SUBSTITUTE' && !body.substituteTeacherId) {
      throw new ApiError(422, 'SUBSTITUTE_REQUIRED', 'Un remplaçant est requis pour une substitution.');
    }
    if (body.type === 'ROOM_CHANGE' && !body.roomLabel) {
      throw new ApiError(422, 'ROOM_REQUIRED', 'Une salle est requise pour un changement de salle.');
    }
    if (body.type === 'RESCHEDULE') {
      if (!body.startTime || !body.endTime) {
        throw new ApiError(422, 'TIME_REQUIRED', 'Une heure de début et de fin sont requises pour un déplacement.');
      }
      if (!TIME_RE.test(body.startTime) || !TIME_RE.test(body.endTime) || minutesOf(body.endTime) <= minutesOf(body.startTime)) {
        throw new ApiError(422, 'TIME_INVALID', "L'heure de fin doit être postérieure à l'heure de début.");
      }
    }

    const [slot] = await db
      .select({ id: classScheduleSlots.id })
      .from(classScheduleSlots)
      .where(and(eq(classScheduleSlots.id, body.classScheduleSlotId), eq(classScheduleSlots.tenantId, tenantId)))
      .limit(1);

    if (!slot) {
      throw new ApiError(404, 'NOT_FOUND', 'Créneau introuvable');
    }

    // Only the field the type is about is stored, so a room change cannot carry
    // a stale substitute forward.
    const values = {
      tenantId,
      classScheduleSlotId: body.classScheduleSlotId,
      date: body.date,
      type: body.type,
      reason: body.reason,
      substituteTeacherId: body.type === 'SUBSTITUTE' ? body.substituteTeacherId ?? null : null,
      roomLabel: body.type === 'ROOM_CHANGE' ? body.roomLabel ?? null : null,
      startTime: body.type === 'RESCHEDULE' ? body.startTime ?? null : null,
      endTime: body.type === 'RESCHEDULE' ? body.endTime ?? null : null,
      createdById: context.userId,
      updatedAt: new Date().toISOString(),
    };

    const [exception] = await db
      .insert(classSessionExceptions)
      .values(values)
      .onConflictDoUpdate({
        target: [classSessionExceptions.tenantId, classSessionExceptions.classScheduleSlotId, classSessionExceptions.date],
        set: {
          type: values.type,
          reason: values.reason,
          substituteTeacherId: values.substituteTeacherId,
          roomLabel: values.roomLabel,
          startTime: values.startTime,
          endTime: values.endTime,
          createdById: values.createdById,
          updatedAt: values.updatedAt,
        },
      })
      .returning();

    recordAudit(context, 'create', 'class_session_exception', exception!.id, {
      type: body.type,
      date: body.date,
      slotId: body.classScheduleSlotId,
      reason: body.reason,
    });

    return NextResponse.json({ success: true, data: exception, message: 'Exception enregistrée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('classScheduleSlotId');
    const date = searchParams.get('date');

    if (!slotId || !date) {
      throw new ApiError(422, 'MISSING_SCOPE', 'Le créneau et la date sont requis.');
    }

    const deleted = await db
      .delete(classSessionExceptions)
      .where(and(
        eq(classSessionExceptions.tenantId, tenantId),
        eq(classSessionExceptions.classScheduleSlotId, slotId),
        eq(classSessionExceptions.date, date),
      ))
      .returning({ id: classSessionExceptions.id });

    if (deleted.length === 0) {
      throw new ApiError(404, 'NOT_FOUND', 'Aucune exception à retirer pour cette séance.');
    }

    recordAudit(context, 'delete', 'class_session_exception', deleted[0]!.id, { date, slotId });

    return NextResponse.json({ success: true, message: 'Exception retirée : la séance reprend l’emploi du temps.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
