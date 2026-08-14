import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireAddon } from '@/libs/api/entitlements';
import { requireCapability } from '@/libs/api/permissions';
import { apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { transportVehicles, transportRoutes, transportStops } from '@/features/transport/models/transport-schema';
import { recordAudit } from '@/libs/api/audit';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'transport');
    await requireCapability(context, 'transport.export');

    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'vehicles';

    let csvContent = '';
    let filename = `transport-${type}.csv`;

    if (type === 'vehicles') {
      const vehicles = await db
        .select()
        .from(transportVehicles)
        .where(eq(transportVehicles.tenantId, tenantId));

      csvContent = 'Code,Registration,Capacity,Type,Status,InsuranceExpiry,InspectionExpiry\n';
      csvContent += vehicles
        .map(v => `${v.vehicleCode},${v.registrationNumber},${v.capacity},${v.vehicleType},${v.status},${v.insuranceExpiry || ''},${v.inspectionExpiry || ''}`)
        .join('\n');
    } else if (type === 'stops') {
      const stops = await db
        .select()
        .from(transportStops)
        .where(eq(transportStops.tenantId, tenantId));

      csvContent = 'Code,Name,Address,Latitude,Longitude,Status\n';
      csvContent += stops
        .map(s => `${s.stopCode},"${s.stopName}","${s.address || ''}",${s.latitude || ''},${s.longitude || ''},${s.status}`)
        .join('\n');
    } else if (type === 'routes') {
      const routes = await db
        .select()
        .from(transportRoutes)
        .where(eq(transportRoutes.tenantId, tenantId));

      csvContent = 'Code,Name,Direction,Status\n';
      csvContent += routes
        .map(r => `${r.routeCode},"${r.routeName}",${r.serviceDirection},${r.status}`)
        .join('\n');
    }

    recordAudit(context, 'export', 'transport_report', type, { filename });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
