import { and, eq, inArray, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { listSessionOccurrences } from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import { attendance, attendanceScanEvents, scannerSessions } from '@/models/Schema';

// CLOSING A SESSION IS WHAT CONSUMES ITS SCANS.
//
// A badge scan no longer writes a lesson mark (fix-plan-02). It stages: an
// accepted `attendance_scan_events` row whose `attendanceRecordId` is NULL. The
// teacher's "Valider l'appel" runs the ordinary roll-call submission, which is
// what writes the marks — this route then closes the session and points each
// staged scan at the mark it became, so the evidence chain survives and the
// Registers & historique screen can still tell a scanned mark from a typed one.
//
// Linking, never writing: this route creates no marks and changes no statuses.
// A scan whose student ends up absent still links, because the validation did
// consume it — the teacher saw the row and chose absent.
//
// Entrance sessions link nothing: they have no lesson, so there is no mark and
// no period to find one by. Their arrival record is the scan event itself.

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const [session] = await db
      .select()
      .from(scannerSessions)
      .where(and(eq(scannerSessions.id, id), eq(scannerSessions.tenantId, tenantId)))
      .limit(1);

    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session de scan introuvable.');
    }

    const [updated] = await db
      .update(scannerSessions)
      .set({ endedAt: new Date().toISOString(), status: 'closed' })
      .where(and(eq(scannerSessions.id, id), eq(scannerSessions.tenantId, tenantId)))
      .returning();

    const linked = await linkStagedScans({ tenantId, session });

    recordAudit(context, 'update', 'scanner_session', id, {
      linked,
      classScheduleSlotId: session.classScheduleSlotId,
    });

    return NextResponse.json({ success: true, data: updated, linked });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

type Session = typeof scannerSessions.$inferSelect;

/**
 * Points every unvalidated scan of a classroom session at the mark it became.
 *
 * The period comes from the session's own slot, resolved through the same
 * occurrence resolver the scan used, so the lookup key here is identical to the
 * key the submission wrote. If the slot no longer resolves (the timetable moved
 * under the session) nothing is guessed and nothing is linked.
 */
async function linkStagedScans({ tenantId, session }: { tenantId: string; session: Session }): Promise<number> {
  if (!session.classScheduleSlotId || !session.classSectionId || !session.date) {
    return 0;
  }

  const occurrences = await listSessionOccurrences({
    tenantId,
    date: session.date,
    classSectionId: session.classSectionId,
  });
  const occurrence = occurrences.find(o => o.slotId === session.classScheduleSlotId);
  if (!occurrence) {
    return 0;
  }

  const staged = await db
    .select({ id: attendanceScanEvents.id, studentId: attendanceScanEvents.studentId })
    .from(attendanceScanEvents)
    .where(and(
      eq(attendanceScanEvents.tenantId, tenantId),
      eq(attendanceScanEvents.sessionId, session.id),
      eq(attendanceScanEvents.resultStatus, 'accepted'),
      isNull(attendanceScanEvents.attendanceRecordId),
    ));

  if (staged.length === 0) {
    return 0;
  }

  // One read for the whole roster rather than one per scan.
  const marks = await db
    .select({ id: attendance.id, studentId: attendance.studentId })
    .from(attendance)
    .where(and(
      eq(attendance.tenantId, tenantId),
      eq(attendance.date, session.date),
      eq(attendance.period, occurrence.period),
      eq(attendance.classSectionId, session.classSectionId),
      eq(attendance.isVoided, false),
    ));

  const markByStudent = new Map(marks.map(m => [m.studentId, m.id]));

  const linkable = staged
    .map(scan => ({ scanId: scan.id, markId: scan.studentId ? markByStudent.get(scan.studentId) : undefined }))
    .filter((pair): pair is { scanId: string; markId: string } => Boolean(pair.markId));

  if (linkable.length === 0) {
    return 0;
  }

  // One update per distinct mark: scans sharing a mark are grouped, so this is a
  // handful of statements rather than one per student.
  const scansByMark = new Map<string, string[]>();
  for (const { scanId, markId } of linkable) {
    scansByMark.set(markId, [...(scansByMark.get(markId) ?? []), scanId]);
  }

  for (const [markId, scanIds] of scansByMark) {
    await db
      .update(attendanceScanEvents)
      .set({ attendanceRecordId: markId })
      .where(inArray(attendanceScanEvents.id, scanIds));
  }

  return linkable.length;
}
