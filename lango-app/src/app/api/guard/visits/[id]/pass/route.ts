import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { issueVisitorPass } from '@/features/guard/services/visitors-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'guard.visitors.manage');
    const { id } = await params;
    const data = await issueVisitorPass(context, id);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
