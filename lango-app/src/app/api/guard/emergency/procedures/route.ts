import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getActiveEmergency, listEmergencyProcedures } from '@/features/guard/services/emergency-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.portal.use');
    const [procedures, emergency] = await Promise.all([
      listEmergencyProcedures(context),
      getActiveEmergency(context),
    ]);
    return NextResponse.json({ success: true, data: { ...procedures, emergency } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
