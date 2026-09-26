import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { hasCapability, requireCapability } from '@/libs/api/permissions';
import { queryScanEvents } from '@/libs/attendance/qr-events';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'receptionist', 'guard']);
    const tenantId = requireTenant(context);
    const allowed = context.role === 'super_admin'
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.read'))
      || (await hasCapability(context.userId, tenantId, context.role, 'attendance.scan'));
    if (!allowed) {
      throw new ApiError(403, 'PERMISSION_DENIED', 'Droit attendance.read ou attendance.scan requis.');
    }

    const { searchParams } = new URL(request.url);

    const result = await queryScanEvents(tenantId, {
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      classSectionId: searchParams.get('classSectionId') || undefined,
      studentName: searchParams.get('studentName') || undefined,
      deviceId: searchParams.get('deviceId') || undefined,
      operatorId: searchParams.get('operatorId') || undefined,
      resultStatus: searchParams.get('resultStatus') || undefined,
      rejectionReason: searchParams.get('rejectionReason') || undefined,
    }, {
      // A campus-limited admin reads only their campus; a teacher only their
      // own sections. Never taken from the query string.
      branchId: context.branchId,
      teacherUserId: context.role === 'teacher' ? context.userId : null,
    });

    return NextResponse.json({
      success: true,
      data: result.events,
      aggregates: result.aggregates,
      pairedDeviceCount: result.pairedDeviceCount,
      options: result.options,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
