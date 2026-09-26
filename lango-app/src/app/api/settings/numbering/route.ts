import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  createNumberingSeries,
  numberingSeriesInputSchema,
} from '@/features/settings/services/numbering-service';
import { listNamingSeries } from '@/features/settings/services/naming-series';

// GET /api/settings/numbering — the tenant's REAL counters (OD3).
//
// This used to list `numbering_series_definitions`, a store nothing consumed:
// the page let a director renumber documents and the next invoice ignored it.
// The rows below are the ones `reserveMatricule` and `consumeDocumentNumber`
// actually increment, so the page and the documents finally agree.
//
// `kind` rather than a French label: the API does not know the UI language, and
// the label is UI text (translated in fr/en/ar like every other one).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const rows = await listNamingSeries(tenantId);
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
