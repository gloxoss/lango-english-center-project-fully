import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getEventReports } from '@/features/events/services/event-operations-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'event-management');
    await requireCapability(context, 'events.report.read');

    const reports = await getEventReports(tenantId);
    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
