import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { attendanceScanEvents, scannerSessions, user } from '@/models/Schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.manage');

    const [session] = await db
      .select({ id: scannerSessions.id })
      .from(scannerSessions)
      .where(and(eq(scannerSessions.id, id), eq(scannerSessions.tenantId, tenantId)))
      .limit(1);
    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session de scan introuvable.');
    }

    const items = await db
      .select({
        id: attendanceScanEvents.id,
        scannedAt: attendanceScanEvents.scannedAt,
        resultStatus: attendanceScanEvents.resultStatus,
        rejectionReason: attendanceScanEvents.rejectionReason,
        stagedStatus: attendanceScanEvents.stagedStatus,
        studentId: attendanceScanEvents.studentId,
        studentName: user.name,
      })
      .from(attendanceScanEvents)
      .leftJoin(user, eq(attendanceScanEvents.studentId, user.id))
      .where(and(
        eq(attendanceScanEvents.tenantId, tenantId),
        eq(attendanceScanEvents.sessionId, id),
      ))
      .orderBy(desc(attendanceScanEvents.scannedAt))
      .limit(200);

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
