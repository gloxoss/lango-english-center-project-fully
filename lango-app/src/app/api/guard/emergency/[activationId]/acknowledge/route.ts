import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardEmergencyAckSchema } from '@/features/guard/models/guard-validation';
import { acknowledgeEmergency } from '@/features/guard/services/emergency-service';

export async function POST(request: Request, { params }: { params: Promise<{ activationId: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.portal.use');
    const { activationId } = await params;
    const body = await parseJson(request, guardEmergencyAckSchema);
    const result = await acknowledgeEmergency(context, activationId, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
