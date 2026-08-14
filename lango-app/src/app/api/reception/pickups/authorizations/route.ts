import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { guardPickupAuthorizationCreateSchema } from '@/features/guard/models/guard-validation';
import {
  createPickupAuthorization,
  listPickupAuthorizations,
} from '@/features/guard/services/release-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.pickup.release');
    const { searchParams } = new URL(request.url);
    const data = await listPickupAuthorizations(context, {
      studentId: searchParams.get('studentId'),
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['receptionist', 'school_admin', 'super_admin']);
    requireTenant(context);
    await requireCapability(context, 'reception.pickup.release');
    const body = await parseJson(request, guardPickupAuthorizationCreateSchema);
    const auth = await createPickupAuthorization(context, body);
    return NextResponse.json({ success: true, data: auth }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
