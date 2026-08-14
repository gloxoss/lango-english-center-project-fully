import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parseJson } from '@/libs/api/validation';
import { receptionVerificationCreateSchema } from '@/features/reception/models/reception-validation';
import { recordVerification } from '@/features/reception/services/identity-service';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    // Verification pairs with lookup — the person must be found first.
    await requireCapability(context, 'reception.lookup');
    checkRateLimit(`reception:verification:${context.userId}`, 30, 60 * 1000);
    const body = await parseJson(request, receptionVerificationCreateSchema);
    const result = await recordVerification(context, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
