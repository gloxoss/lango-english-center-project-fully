import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['student', 'school_admin', 'super_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');

    // Self-service is strictly identity gated
    const studentData = await TransportService.getStudentTransportView(tenantId, context.userId);
    return NextResponse.json({ success: true, data: studentData });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
