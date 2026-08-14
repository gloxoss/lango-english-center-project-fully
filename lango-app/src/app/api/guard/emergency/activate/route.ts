import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardEmergencyActivateSchema } from '@/features/guard/models/guard-validation';
import { activateEmergency } from '@/features/guard/services/emergency-service';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.emergency.activate');
    const body = await parseJson(request, guardEmergencyActivateSchema);
    const result = await activateEmergency(context, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
