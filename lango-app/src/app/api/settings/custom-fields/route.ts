import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import {
  createCustomFieldDefinition,
  customFieldInputSchema,
  listCustomFieldDefinitions,
} from '@/features/settings/services/custom-fields-service';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const entityType = new URL(request.url).searchParams.get('entityType') ?? undefined;
    const rows = await listCustomFieldDefinitions(tenantId, entityType);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'settings.custom_field.manage');
    const body = await parseJson(request, customFieldInputSchema);
    const created = await createCustomFieldDefinition(context, body);
    recordAudit(context, 'create', 'setting_custom_field', created.id, { key: created.key });
    return NextResponse.json({ success: true, data: created, message: 'Champ personnalisé créé.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
