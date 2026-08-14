import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  customFieldInputSchema,
  deleteCustomFieldDefinition,
  getCustomFieldDefinition,
  updateCustomFieldDefinition,
} from '@/features/settings/services/custom-fields-service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const def = await getCustomFieldDefinition(context, id);
    return NextResponse.json({ success: true, data: def });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const body = await parseJson(request, customFieldInputSchema.partial());
    const updated = await updateCustomFieldDefinition(context, id, body);
    recordAudit(context, 'update', 'setting_custom_field', id, { key: updated.key });
    return NextResponse.json({ success: true, data: updated, message: 'Champ mis à jour.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const result = await deleteCustomFieldDefinition(context, id);
    recordAudit(context, 'delete', 'setting_custom_field', id, { deactivated: true });
    return NextResponse.json({ success: true, data: result, message: 'Champ désactivé.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
