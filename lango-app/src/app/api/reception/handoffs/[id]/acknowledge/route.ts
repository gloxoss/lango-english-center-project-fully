import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { receptionHandoffTransitionSchema } from '@/features/reception/models/reception-validation';
import { transitionHandoff } from '@/features/reception/services/handoffs-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.handoff.manage');
    const { id } = await params;
    const body = await parseJson(request, receptionHandoffTransitionSchema);
    const result = await transitionHandoff(context, id, 'acknowledged', { reason: body.reason });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
