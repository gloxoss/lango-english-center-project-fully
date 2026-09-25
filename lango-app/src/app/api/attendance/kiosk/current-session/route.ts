import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { authenticateDevice } from '@/libs/attendance/device-auth';
import { currentOccurrence, listSessionOccurrences } from '@/libs/attendance/session-occurrence';
import { casablancaTodayIso } from '@/libs/finance/today';

/**
 * WHAT IS THIS TERMINAL SUPPOSED TO BE SCANNING? (phase 7)
 *
 * A fixed classroom kiosk should not be told which class it is looking at. It
 * knows its own campus and room, and the timetable knows what is scheduled
 * there now — so the session is derived, not chosen.
 *
 * The device proves itself first, and its branch is authoritative: a kiosk
 * cannot ask about another campus by changing a parameter it does not control.
 *
 * Returns null rather than an error when nothing is scheduled. "No lesson here
 * right now" is a normal state a kiosk must be able to display, not a failure.
 */
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('deviceSecret');

    if (!secret) {
      return NextResponse.json({ success: true, data: { bound: false, session: null } });
    }

    const device = await authenticateDevice(tenantId, secret);
    const today = casablancaTodayIso();

    const occurrences = await listSessionOccurrences({
      tenantId,
      date: today,
      branchId: device.branchId,
    });

    // Room-bound kiosks narrow to their own room; an unbound one sees the whole
    // campus, which is the honest answer for a device that was never given one.
    const inRoom = device.roomLabel
      ? occurrences.filter(o => (o.room ?? '').trim().toLowerCase() === device.roomLabel!.trim().toLowerCase())
      : occurrences;

    const now = new Date();
    const session = currentOccurrence(inRoom, today, now);

    return NextResponse.json({
      success: true,
      data: {
        bound: true,
        device: { label: device.label, branchId: device.branchId, roomLabel: device.roomLabel },
        session: session
          ? {
              slotId: session.slotId,
              classSectionId: session.classSectionId,
              startTime: session.startTime,
              endTime: session.endTime,
              subjectName: session.subjectName,
              className: session.className,
              sectionName: session.sectionName,
              room: session.room,
              teacherName: session.teacherName,
            }
          : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
