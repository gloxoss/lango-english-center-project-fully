import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, smsTemplateCreateSchema, smsTemplateUpdateSchema } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { smsTemplates } from '@/models/Schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const rows = await db.select().from(smsTemplates).where(eq(smsTemplates.tenantId, tenantId));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, smsTemplateCreateSchema);

    const [inserted] = await db.insert(smsTemplates).values({ tenantId, name: body.name, body: body.body }).returning();

    recordAudit(context, 'create', 'sms_template', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Modèle créé avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const body = await parseJson(request, smsTemplateUpdateSchema);

    const [updated] = await db
      .update(smsTemplates)
      .set({ name: body.name, body: body.body, updatedAt: new Date().toISOString() })
      .where(and(eq(smsTemplates.id, body.id), eq(smsTemplates.tenantId, tenantId)))
      .returning();

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

    await db.delete(smsTemplates).where(and(eq(smsTemplates.id, id), eq(smsTemplates.tenantId, tenantId)));
    recordAudit(context, 'delete', 'sms_template', id);

    return NextResponse.json({ success: true, message: 'Modèle supprimé', id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
