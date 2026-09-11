import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { TransportService } from '@/features/transport/services/transport-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.driver.manage');

    // Role eligibility lives in TransportService, not here: this route used to
    // repeat the query with a hand-written role list that included 'driver', a
    // value the postgres `role` enum does not have. Postgres rejects the whole
    // IN list with 22P02, so the page 500'd before it read a single row.
    const safeDrivers = await TransportService.getDrivers(tenantId);

    return NextResponse.json({ success: true, data: safeDrivers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
