import { desc, eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { requireAddon } from '@/libs/api/entitlements';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { documentTemplates, documentTemplateVersions } from '@/features/cards/models/cards-schema';

const createDocumentTemplateVersionSchema = z.object({
  schemaJson: z.record(z.string(), z.unknown()),
  pageWidthMm: z.number().int().positive().optional(),
  pageHeightMm: z.number().int().positive().optional(),
  orientation: z.enum(['portrait', 'landscape']).optional(),
  publish: z.boolean().optional(),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    const versions = await db
      .select()
      .from(documentTemplateVersions)
      .where(and(
        eq(documentTemplateVersions.tenantId, tenantId),
        eq(documentTemplateVersions.templateId, id)
      ))
      .orderBy(desc(documentTemplateVersions.versionNumber));

    return NextResponse.json({ success: true, data: versions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    const body = await parseJson(request, createDocumentTemplateVersionSchema);
    const { schemaJson, pageWidthMm, pageHeightMm, orientation, publish } = body;

    const [template] = await db.select().from(documentTemplates)
      .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.id, id))).limit(1);

    if (!template) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle non trouvé');
    }

    // Find latest version number
    const [latestVersion] = await db.select().from(documentTemplateVersions)
      .where(and(
        eq(documentTemplateVersions.tenantId, tenantId),
        eq(documentTemplateVersions.templateId, id)
      ))
      .orderBy(desc(documentTemplateVersions.versionNumber))
      .limit(1);

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // We can either update the latest draft, or create a new version when publishing.
    // Given the editor auto-saves as a draft, we'll create a new version record.
    const [newVersion] = await db.insert(documentTemplateVersions).values({
      tenantId,
      templateId: template.id,
      versionNumber: nextVersionNumber,
      pageWidthMm: pageWidthMm || 85,
      pageHeightMm: pageHeightMm || 54,
      orientation: orientation || 'landscape',
      schemaJson,
      publishedById: publish ? context.userId : null,
      publishedAt: publish ? new Date().toISOString() : null,
    }).returning();

    if (publish && template.status === 'draft') {
      await db.update(documentTemplates)
        .set({ status: 'published' })
        .where(eq(documentTemplates.id, template.id));
    }

    recordAudit(context, 'create', 'document_template_version', newVersion!.id, { published: publish });

    return NextResponse.json({ 
      success: true, 
      data: newVersion,
      message: publish ? 'Modèle publié avec succès' : 'Brouillon enregistré avec succès'
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
