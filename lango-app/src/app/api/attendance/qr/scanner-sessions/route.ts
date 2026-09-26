import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { isCancelled, listSessionOccurrences } from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { classScheduleSlots, scannerDevices, scannerSessions } from '@/models/Schema';

// A SCANNER SESSION NAMES A LESSON, OR THE WHOLE SCHOOL (fix-plan-02).
//
// Scanning has two homes, and whether `slotId` is present is what picks between
// them — there is no third state and no class picker:
//
//   slotId set   -> CLASSROOM session, bound to one occurrence (slot x date).
//                   Only that lesson's section may badge in, and the marks stay
//                   provisional until the teacher validates the register.
//   slotId unset -> ENTRANCE (portique) session. Any student of the tenant may
//                   badge in; a scan records a campus arrival and nothing else.
//
// A session is no longer chosen by `classSectionId`. A section is not a lesson:
// a session that names only a section cannot tell a 14:00 badge from an 08:00
// one, which is the bug this replaces. The section is DERIVED from the slot.
//
// Both modes reuse an already-open session rather than opening a second one, so
// a page reload cannot split a terminal's counters in two. The partial unique
// indexes in migration 0168 back that up if two requests race.

const startSessionSchema = z.object({
  slotId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deviceId: z.string().uuid().optional().nullable(),
}).strict();

export async function POST(request: Request) {
  try {
    // The gate terminal is run by reception or the guard on duty, not only by
    // teaching staff, so the scanning capability is what admits them here. It is
    // deliberately narrower than attendance.manage: scanning must not carry the
    // registers, justifications or alert management with it.
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.scan');
    const body = await parseJson(request, startSessionSchema);

    const date = body.date ?? casablancaTodayIso();

    if (body.deviceId) {
      const [device] = await db
        .select({ id: scannerDevices.id, isDisabled: scannerDevices.isDisabled })
        .from(scannerDevices)
        .where(and(eq(scannerDevices.id, body.deviceId), eq(scannerDevices.tenantId, tenantId)))
        .limit(1);
      if (!device) {
        throw new ApiError(422, 'INVALID_DEVICE', 'Le dispositif de scan indiqué n\'existe pas pour cet établissement.');
      }
      if (device.isDisabled) {
        throw new ApiError(409, 'DEVICE_DISABLED', 'Ce dispositif de scan est désactivé.');
      }
    }

    if (body.slotId) {
      return await openClassroomSession(context, tenantId, body.slotId, date, body.deviceId ?? null);
    }

    return await openEntranceSession(context, tenantId, date, body.deviceId ?? null);
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Whether this lesson is already being scanned.
 *
 * The register asks before offering to activate scanning, so reloading the page
 * mid-lesson reattaches to the open session instead of opening a second one, and
 * the arrivals already collected stay visible.
 */
export async function GET(request: Request) {
  try {
    // The gate terminal is run by reception or the guard on duty, not only by
    // teaching staff, so the scanning capability is what admits them here. It is
    // deliberately narrower than attendance.manage: scanning must not carry the
    // registers, justifications or alert management with it.
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.scan');

    const url = new URL(request.url);
    const slotId = url.searchParams.get('slotId');
    const date = url.searchParams.get('date') ?? casablancaTodayIso();

    if (!slotId) {
      throw new ApiError(422, 'SLOT_REQUIRED', 'Une séance est requise pour interroger la session de scan.');
    }

    const session = await findOpenSession(tenantId, slotId, date);

    return NextResponse.json({ success: true, data: session, mode: session ? 'classroom' : null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * A lesson is only scannable if it is really on today's timetable and not
 * cancelled, and only its own teacher (including a replacement named by a
 * session exception) or an admin may open it. The occurrence resolver is what
 * answers all three, so the rules cannot drift from Appel du jour.
 */
async function openClassroomSession(
  context: Awaited<ReturnType<typeof requireRequestContext>>,
  tenantId: string,
  slotId: string,
  date: string,
  deviceId: string | null,
) {
  const [slot] = await db
    .select({ id: classScheduleSlots.id, classSectionId: classScheduleSlots.classSectionId })
    .from(classScheduleSlots)
    .where(and(eq(classScheduleSlots.id, slotId), eq(classScheduleSlots.tenantId, tenantId)))
    .limit(1);

  if (!slot) {
    throw new ApiError(422, 'INVALID_SLOT', 'Cette séance n\'existe pas pour cet établissement.');
  }

  const occurrences = await listSessionOccurrences({
    tenantId,
    date,
    classSectionId: slot.classSectionId,
  });
  const occurrence = occurrences.find(o => o.slotId === slotId);

  if (!occurrence) {
    throw new ApiError(422, 'LESSON_NOT_SCHEDULED', 'Cette séance n\'est pas programmée pour cette classe ce jour-là.');
  }

  // A lesson that is not happening cannot be scanned into. The exception is
  // already applied to `occurrence`, so a rescheduled lesson passes here.
  if (isCancelled(occurrence)) {
    throw new ApiError(422, 'LESSON_CANCELLED', 'Ce cours est annulé, le scan ne peut pas être activé.');
  }

  // A platform admin may open any lesson's session; a teacher only their own.
  // Reception and the guard reach this route for the ENTRANCE session and hit
  // this refusal if they try to open a classroom one, which is the intent.
  const isPlatformAdmin = context.role === 'school_admin' || context.role === 'super_admin';
  if (!isPlatformAdmin && occurrence.teacherId !== context.userId) {
    throw new ApiError(403, 'NOT_YOUR_LESSON', 'Vous n\'enseignez pas ce cours.');
  }

  const existing = await findOpenSession(tenantId, slotId, date);
  if (existing) {
    return NextResponse.json({ success: true, data: existing, mode: 'classroom', reused: true });
  }

  const [session] = await db
    .insert(scannerSessions)
    .values({
      tenantId,
      deviceId,
      operatorId: context.userId,
      classSectionId: slot.classSectionId,
      classScheduleSlotId: slotId,
      date,
      startedAt: new Date().toISOString(),
      status: 'active',
    })
    .returning();

  recordAudit(context, 'create', 'scanner_session', session!.id, {
    mode: 'classroom',
    classSectionId: slot.classSectionId,
    classScheduleSlotId: slotId,
    date,
    deviceId,
  });

  return NextResponse.json({ success: true, data: session, mode: 'classroom', reused: false }, { status: 201 });
}

/**
 * The gate terminal. No lesson, no section: any student of the tenant badges in
 * and the scan records an arrival. Reused for the whole day so the terminal's
 * counters mean "here, today".
 */
async function openEntranceSession(
  context: Awaited<ReturnType<typeof requireRequestContext>>,
  tenantId: string,
  date: string,
  deviceId: string | null,
) {
  const [existing] = await db
    .select()
    .from(scannerSessions)
    .where(and(
      eq(scannerSessions.tenantId, tenantId),
      eq(scannerSessions.status, 'active'),
      isNull(scannerSessions.classScheduleSlotId),
      eq(scannerSessions.date, date),
      deviceId
        ? eq(scannerSessions.deviceId, deviceId)
        : eq(scannerSessions.operatorId, context.userId),
    ))
    .limit(1);

  if (existing) {
    return NextResponse.json({ success: true, data: existing, mode: 'entrance', reused: true });
  }

  const [session] = await db
    .insert(scannerSessions)
    .values({
      tenantId,
      deviceId,
      operatorId: context.userId,
      classSectionId: null,
      classScheduleSlotId: null,
      date,
      startedAt: new Date().toISOString(),
      status: 'active',
    })
    .returning();

  recordAudit(context, 'create', 'scanner_session', session!.id, {
    mode: 'entrance',
    date,
    deviceId,
  });

  return NextResponse.json({ success: true, data: session, mode: 'entrance', reused: false }, { status: 201 });
}

async function findOpenSession(tenantId: string, slotId: string, date: string) {
  const [existing] = await db
    .select()
    .from(scannerSessions)
    .where(and(
      eq(scannerSessions.tenantId, tenantId),
      eq(scannerSessions.classScheduleSlotId, slotId),
      eq(scannerSessions.date, date),
      eq(scannerSessions.status, 'active'),
    ))
    .limit(1);
  return existing ?? null;
}
