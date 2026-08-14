import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { rejectInvitation } from '@/features/guard/services/visitors-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist', 'guard']);
    requireTenant(context);
    await requireCapability(context, 'guard.visitors.approve');
    const { id } = await params;
    const invitation = await rejectInvitation(context, id);
    return NextResponse.json({ success: true, data: invitation });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
