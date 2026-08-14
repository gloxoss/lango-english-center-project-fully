import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { queryScanEvents } from '@/libs/attendance/qr-events';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'attendance.read');

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
