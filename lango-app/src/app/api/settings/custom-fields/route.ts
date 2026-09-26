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

// GET is readable by anyone who can see a student (students.read): the
// student detail page shows the active definitions as a read-only card for
// non-admins (SCF-08-02). Writing stays school_admin + settings.custom_field.manage.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.read');
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
