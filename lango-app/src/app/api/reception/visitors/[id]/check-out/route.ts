import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { receptionVisitorGateActionSchema } from '@/features/reception/models/reception-validation';
import { checkOutVisit } from '@/features/guard/services/visitors-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.visitor.manage');
    const { id } = await params;
    const body = await parseJson(request, receptionVisitorGateActionSchema);
    // Replay-safe: a second check-out returns { replayed: true }, never a
    // double transition.
    const result = await checkOutVisit(context, id, { gateId: body.gateId, idempotencyKey: body.idempotencyKey ?? null });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
