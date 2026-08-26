import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { documentTemplates } from '@/features/cards/models/cards-schema';

const updateDocumentTemplateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  isDefault: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    const [template] = await db
      .select()
      .from(documentTemplates)
      .where(and(
        eq(documentTemplates.tenantId, tenantId),
        eq(documentTemplates.id, id)
      ))
      .limit(1);

    if (!template) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle non trouvé');
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    const body = await parseJson(request, updateDocumentTemplateSchema);
    const { name, isDefault, status } = body;

    const [updated] = await db.update(documentTemplates)
      .set({
        ...(name !== undefined && { name }),
        ...(isDefault !== undefined && { isDefault }),
        ...(status !== undefined && { status }),
      })
      .where(and(
        eq(documentTemplates.tenantId, tenantId),
        eq(documentTemplates.id, id)
      ))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle non trouvé');
    }

    recordAudit(context, 'update', 'document_template', updated.id);

    return NextResponse.json({ success: true, data: updated, message: 'Modèle mis à jour avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    // Soft delete or check if it's published.
    // The spec says: "Published/in-use versions cannot be mutated or hard-deleted."
    // We can archive the template instead.
    const [template] = await db.select().from(documentTemplates)
      .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.id, id))).limit(1);

    if (!template) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle non trouvé');
    }

    if (template.status === 'published') {
      // Archive instead of delete
      await db.update(documentTemplates)
        .set({ status: 'archived' })
        .where(eq(documentTemplates.id, template.id));
      
      recordAudit(context, 'update', 'document_template', template.id, { archived: true });
      return NextResponse.json({ success: true, message: 'Modèle archivé avec succès (les modèles publiés ne peuvent pas être supprimés)' });
    }

    await db.delete(documentTemplates).where(eq(documentTemplates.id, template.id));
    recordAudit(context, 'delete', 'document_template', template.id);

    return NextResponse.json({ success: true, message: 'Modèle supprimé avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
