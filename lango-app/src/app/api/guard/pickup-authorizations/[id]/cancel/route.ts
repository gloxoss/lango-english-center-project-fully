import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { cancelPickupAuthorization } from '@/features/guard/services/release-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.pickup.release');
    const { id } = await params;
    await cancelPickupAuthorization(context, id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
