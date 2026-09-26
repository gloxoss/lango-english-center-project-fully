import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { getNamingSeries, raiseNamingSeries } from '@/features/settings/services/naming-series';

/**
 * One real counter. `id` is the series PREFIX (URL-encoded), because the prefix
 * is the primary key of `naming_series` — there is no separate id.
 *
 * The definitions endpoints that used to live under `[id]` are retired from the
 * UI, not deleted: `[id]/next` and `[id]/preview` still resolve, and the
 * definitions table and service are untouched.
 */
type RouteParams = { params: Promise<{ id: string }> };

const raiseSchema = z.object({
  currentVal: z.number().int().min(0),
  reason: z.string().max(500).optional(),
}).strict();

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const series = await getNamingSeries(tenantId, decodeURIComponent(id));
    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

/**
 * Raise the counter. Lowering is refused with 409 (see raiseNamingSeries):
 * a lower value is a request to re-issue numbers already printed on documents.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.numbering.manage');
    const prefix = decodeURIComponent(id);
    const body = await parseJson(request, raiseSchema);

    const result = await raiseNamingSeries(tenantId, prefix, body.currentVal);

    // Only a real change is audited; a no-op raise would add a row that says
    // nothing happened.
    if (result.before !== result.after) {
      recordAudit(context, 'update', 'setting_numbering', prefix, {
        prefix,
        changed: { currentVal: { before: result.before, after: result.after } },
        reason: body.reason ?? null,
      });
    }

    return NextResponse.json({
      success: true,
      data: result.row,
      message: 'Série mise à jour.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
