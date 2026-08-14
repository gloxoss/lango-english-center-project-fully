import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { listScanEvidence } from '@/features/guard/services/credential-adapter';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin']);
    requireTenant(context);
    await requireCapability(context, 'guard.evidence.read');
    const { searchParams } = new URL(request.url);
    const data = await listScanEvidence(context, {
      kioskSessionId: searchParams.get('kioskSessionId'),
      gateId: searchParams.get('gateId'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      resultStatus: searchParams.get('resultStatus'),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
