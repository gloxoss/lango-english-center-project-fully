import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardReleaseSchema } from '@/features/guard/models/guard-validation';
import { releaseStudent } from '@/features/guard/services/release-service';

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    // Default-deny: the receptionist role does NOT carry reception.pickup.release.
    // A release requires an explicit effective authorization; the capability
    // grant is the explicit consent boundary.
    await requireCapability(context, 'reception.pickup.release');
    const body = await parseJson(request, guardReleaseSchema);
    const result = await releaseStudent(context, body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
