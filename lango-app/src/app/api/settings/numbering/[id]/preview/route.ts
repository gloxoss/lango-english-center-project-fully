import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { previewNextNumber } from '@/features/settings/services/numbering-service';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/settings/numbering/[id]/preview — next number WITHOUT consuming.
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const preview = await previewNextNumber(context, id);
    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
