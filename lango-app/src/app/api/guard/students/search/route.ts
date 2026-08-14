import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { requireCapability } from '@/libs/api/permissions';
import { searchStudents } from '@/features/guard/services/release-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['guard', 'school_admin', 'receptionist']);
    requireTenant(context);
    await requireCapability(context, 'guard.pickup.release');
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    // §7.3: narrow identifiers only — name needs min 3 chars, phone min 6,
    // or an exact matricule. No empty/broad queries.
    if (q.length < 3) {
      throw new ApiError(422, 'SEARCH_TOO_SHORT', 'Recherche trop courte (3 caractères minimum).');
    }
    const data = await searchStudents(context, q);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
