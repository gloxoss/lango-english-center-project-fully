import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardInvitationCreateSchema } from '@/features/guard/models/guard-validation';
import { createInvitation, listInvitations } from '@/features/guard/services/visitors-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'guard.visitors.manage');
    const { searchParams } = new URL(request.url);
    const data = await listInvitations(context, {
      status: searchParams.get('status'),
      q: searchParams.get('q'),
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
    const body = await parseJson(request, guardInvitationCreateSchema);
    const invitation = await createInvitation(context, body);
    return NextResponse.json({ success: true, data: invitation }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
