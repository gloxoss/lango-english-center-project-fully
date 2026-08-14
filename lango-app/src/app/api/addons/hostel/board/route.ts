import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { getBoard } from '@/features/hostel/services/inventory-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'hostel');
    await requireCapability(context, 'hostel.read');

    const url = new URL(request.url);
    const board = await getBoard(tenantId, {
      hostelId: url.searchParams.get('hostelId') ?? undefined,
    });
    return NextResponse.json({ success: true, data: board });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
