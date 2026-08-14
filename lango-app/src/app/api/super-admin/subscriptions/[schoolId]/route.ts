import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { getSubscriptionDetail } from '@/features/subscriptions/services/subscription-service';

type Params = { params: Promise<{ schoolId: string }> };

// GET /api/super-admin/subscriptions/:schoolId - one school's license,
// payment history and addon grants (the super-admin management drawer).
export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { schoolId } = await params;
    const data = await getSubscriptionDetail(schoolId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
