import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  createNumberingSeries,
  listNumberingSeries,
  numberingSeriesInputSchema,
} from '@/features/settings/services/numbering-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const rows = await listNumberingSeries(tenantId);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const body = await parseJson(request, numberingSeriesInputSchema);
    const created = await createNumberingSeries(context, body);
    recordAudit(context, 'create', 'setting_numbering', created.id, { key: created.key });
    return NextResponse.json({ success: true, data: created, message: 'Série de numérotation créée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
