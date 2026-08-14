import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardIncidentCreateSchema } from '@/features/guard/models/guard-validation';
import { createIncident, listIncidents } from '@/features/guard/services/incidents-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.incidents.manage');
    const { searchParams } = new URL(request.url);
    const data = await listIncidents(context, {
      branchId: searchParams.get('branchId'),
      gateId: searchParams.get('gateId'),
      status: searchParams.get('status'),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.incidents.manage');
    const body = await parseJson(request, guardIncidentCreateSchema);
    const result = await createIncident(context, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
