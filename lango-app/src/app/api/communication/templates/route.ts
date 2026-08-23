import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, smsTemplateCreateSchema, smsTemplateUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { communicationTemplates } from '@/models/Schema';
import {
  addTemplateVersion,
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  publishTemplateVersion,
} from '@/features/broadcast/services/templates-service';

// The SMS Communication template studio is now a thin view over the shared
// Broadcast `communication_templates` system (channel='sms'): a template authored
// here is usable from a Broadcast campaign and vice versa. The flat
// { id, name, body } shape is preserved for the existing studio UI, with `body`
// mapping to the latest published version's `bodyText`.

type FlatTemplate = { id: string; name: string; body: string };

function flat(t: { id: string; name: string; latestVersion?: { bodyText: string } | null }): FlatTemplate {
  return { id: t.id, name: t.name, body: t.latestVersion?.bodyText ?? '' };
}

async function findFlat(tenantId: string, id: string): Promise<FlatTemplate | undefined> {
  const rows = await listTemplates(tenantId, 'sms');
  const t = rows.find((r) => r.id === id);
  return t ? flat(t) : undefined;
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const data = await listTemplates(tenantId, 'sms');

    return NextResponse.json({ success: true, data: data.map(flat), total: data.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, smsTemplateCreateSchema);

    const { template, version } = await createTemplate(
      tenantId,
      { name: body.name, channel: 'sms', category: 'sms', initial: { bodyText: body.body } },
      context.userId,
    );
    await publishTemplateVersion(tenantId, template.id, version.id);

    recordAudit(context, 'create', 'sms_template', template.id);

    return NextResponse.json({ success: true, data: { id: template.id, name: body.name, body: body.body }, message: 'Modèle créé avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, smsTemplateUpdateSchema);

    await getTemplate(tenantId, body.id);

    if (body.name !== undefined) {
      await db
        .update(communicationTemplates)
        .set({ name: body.name, updatedAt: new Date().toISOString() })
        .where(and(eq(communicationTemplates.id, body.id), eq(communicationTemplates.tenantId, tenantId)));
    }

    if (body.body !== undefined) {
      const version = await addTemplateVersion(tenantId, body.id, { bodyText: body.body }, context.userId);
      await publishTemplateVersion(tenantId, body.id, version.id);
    }

    const updated = await findFlat(tenantId, body.id);
    if (!updated) {
      return NextResponse.json({ success: false, message: 'Modèle non trouvé' }, { status: 404 });
    }

    recordAudit(context, 'update', 'sms_template', body.id);

    return NextResponse.json({ success: true, data: updated, message: 'Modèle mis à jour' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID non fourni' }, { status: 400 });
    }

    await deleteTemplate(tenantId, id);
    recordAudit(context, 'delete', 'sms_template', id);

    return NextResponse.json({ success: true, message: 'Modèle supprimé', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
