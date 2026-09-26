import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { db } from '@/libs/DB';
import { attendanceScanEvents, classSections, classes, scannerSessions, user } from '@/models/Schema';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard']);
    const tenantId = requireTenant(context);
    const allowed = context.role === 'super_admin'
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.manage'))
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.scan'))
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.read'));
    if (!allowed) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Droit attendance.scan ou attendance.manage requis.');
    }

    const [session] = await db
      .select({ id: scannerSessions.id, classSectionId: scannerSessions.classSectionId, operatorId: scannerSessions.operatorId })
      .from(scannerSessions)
      .where(and(eq(scannerSessions.id, id), eq(scannerSessions.tenantId, tenantId)))
      .limit(1);
    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session de scan introuvable.');
    }

    // SCOPE: the scan feed is as visible as the session is manageable — staff
    // read their campus only, a teacher a session that is theirs (operator or a
    // current assignment of the section).
    if (session.classSectionId) {
      if (context.role === 'teacher') {
        const mine = session.operatorId === context.userId
          || (await getTeacherClassSectionIds(tenantId, context.userId)).includes(session.classSectionId);
        if (!mine) {
          throw new ApiError(403, 'NOT_YOUR_SESSION', 'Cette session de scan ne vous appartient pas.');
        }
      } else {
        const [scope] = await db
          .select({ branchId: classes.branchId })
          .from(classSections)
          .innerJoin(classes, eq(classSections.classId, classes.id))
          .where(and(eq(classSections.tenantId, tenantId), eq(classSections.id, session.classSectionId)))
          .limit(1);
        assertBranchScope(context, scope?.branchId ?? null);
      }
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
