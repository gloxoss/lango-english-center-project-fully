import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { parsePagination } from '@/libs/api/pagination';
import { receptionLookupSchema } from '@/features/reception/models/reception-validation';
import { lookupPeople } from '@/features/reception/services/lookup-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.lookup');
    // Enumeration resistance: tight per-user sliding window + min search length
    // (min 3 / min 6 phone, enforced in the service) + 20-result cap.
    checkRateLimit(`reception:lookup:${context.userId}`, 20, 60 * 1000);

    const { searchParams } = new URL(request.url);
    const parsed = receptionLookupSchema.safeParse({ q: searchParams.get('q') ?? '' });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Recherche invalide (3 caractères minimum).' } },
        { status: 422 },
      );
    }
    const pagination = parsePagination(searchParams);
    const data = await lookupPeople(context, parsed.data.q);
    return NextResponse.json({
      success: true,
      data: data.slice(0, pagination.pageSize),
      total: data.length,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
