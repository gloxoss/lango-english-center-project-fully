import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getMyGate } from '@/features/guard/services/kiosk-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    await requireCapability(context, 'guard.portal.use');
    const data = await getMyGate(context);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
