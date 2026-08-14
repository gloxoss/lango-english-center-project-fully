import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardIncidentUpdateSchema } from '@/features/guard/models/guard-validation';
import { updateIncident } from '@/features/guard/services/incidents-service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.incidents.manage');
    const { id } = await params;
    const body = await parseJson(request, guardIncidentUpdateSchema);
    const result = await updateIncident(context, id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
