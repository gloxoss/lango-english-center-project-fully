import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { checkRateLimit } from '@/libs/api/rate-limit';
import { searchStudents } from '@/features/guard/services/release-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    // Pickup release requires an explicit effective authorization. The default
    // receptionist role does NOT carry this capability — a 403 here is the
    // expected default. Only an explicitly-granted override opens the path.
    await requireCapability(context, 'reception.pickup.release');
    checkRateLimit(`reception:pickup:students:${context.userId}`, 30, 60 * 1000);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') ?? '').trim();
    if (q.length < 3) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Recherche invalide (3 caractères minimum).' } },
        { status: 422 },
      );
    }
    const data = await searchStudents(context, q);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
