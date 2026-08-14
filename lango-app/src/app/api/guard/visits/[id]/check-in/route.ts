import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardVisitCheckInSchema } from '@/features/guard/models/guard-validation';
import { checkInVisit } from '@/features/guard/services/visitors-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'guard.visitors.manage');
    const { id } = await params;
    const body = await parseJson(request, guardVisitCheckInSchema);
    const result = await checkInVisit(context, id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
