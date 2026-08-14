import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  getNumberingSeries,
  numberingSeriesInputSchema,
  updateNumberingSeries,
} from '@/features/settings/services/numbering-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const series = await getNumberingSeries(context, id);
    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const body = await parseJson(request, numberingSeriesInputSchema.partial());
    const updated = await updateNumberingSeries(context, id, body);
    recordAudit(context, 'update', 'setting_numbering', id, { key: updated.key });
    return NextResponse.json({ success: true, data: updated, message: 'Série mise à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
