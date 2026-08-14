import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { consumeNextNumber } from '@/features/settings/services/numbering-service';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/settings/numbering/[id]/next — consume the next number (serialized).
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const consumed = await consumeNextNumber(context, id);
    recordAudit(context, 'update', 'setting_numbering', id, { action: 'consume_next', nextValue: consumed.numericValue });
    return NextResponse.json({ success: true, data: consumed, message: `Numéro attribué : ${consumed.nextValue}` });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
