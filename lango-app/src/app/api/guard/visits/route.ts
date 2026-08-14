import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardVisitCreateSchema } from '@/features/guard/models/guard-validation';
import { createVisit, listVisits } from '@/features/guard/services/visitors-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'guard.visitors.manage');
    const { searchParams } = new URL(request.url);
    const data = await listVisits(context, {
      q: searchParams.get('q'),
      status: searchParams.get('status'),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'guard.visitors.manage');
    const body = await parseJson(request, guardVisitCreateSchema);
    const visit = await createVisit(context, body);
    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
