import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { receptionVisitorCreateSchema } from '@/features/reception/models/reception-validation';
import { createVisit, listVisits } from '@/features/guard/services/visitors-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.visitor.manage');
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
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.visitor.manage');
    checkRateLimit(`reception:visitor:create:${context.userId}`, 15, 60 * 1000);
    const body = await parseJson(request, receptionVisitorCreateSchema);
    // The front-desk sign-in is the approval: pass issuance is immediate.
    const visit = await createVisit(context, {
      visitorFirstName: body.visitorFirstName,
      visitorLastName: body.visitorLastName,
      visitorPhone: body.visitorPhone ?? null,
      visitorEmail: body.visitorEmail ?? null,
      purpose: body.purpose,
      hostId: body.hostId ?? null,
      invitationId: null,
      approved: true,
    });
    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
