import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin', 'teacher', 'guard']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.trip.manage');

    const { id } = await params;
    const trip = await TransportService.completeTrip(tenantId, id);

    recordAudit(context, 'update', 'transport_trip', id, { action: 'complete_trip' });

    return NextResponse.json({ success: true, data: trip });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
