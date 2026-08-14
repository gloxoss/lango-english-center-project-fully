import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  deleteCustomFieldValue,
  getCustomFieldValues,
  setCustomFieldValue,
} from '@/features/settings/services/custom-fields-service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/settings/custom-fields/[id]/values?entityId=xyz
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const entityId = new URL(request.url).searchParams.get('entityId');
    if (!entityId) {
      return NextResponse.json({ success: true, data: null });
    }
    const value = await getCustomFieldValues(context, id, entityId);
    return NextResponse.json({ success: true, data: value });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const valueSchema = z.object({
  entityId: z.string().trim().min(1).max(128),
  value: z.unknown(),
}).strict();

// PUT /api/settings/custom-fields/[id]/values — set or upsert a value.
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const body = await parseJson(request, valueSchema);
    const row = await setCustomFieldValue(context, id, body.entityId, body.value);
    recordAudit(context, 'update', 'setting_custom_field', id, { action: 'set_value', entityId: body.entityId });
    return NextResponse.json({ success: true, data: row, message: 'Valeur enregistrée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const deleteSchema = z.object({
  entityId: z.string().trim().min(1).max(128),
}).strict();

// DELETE /api/settings/custom-fields/[id]/values — clear a value.
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const body = await parseJson(request, deleteSchema);
    const result = await deleteCustomFieldValue(context, id, body.entityId);
    recordAudit(context, 'delete', 'setting_custom_field', id, { action: 'clear_value', entityId: body.entityId });
    return NextResponse.json({ success: true, data: result, message: 'Valeur supprimée.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
