import { desc, eq, and, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { recordAudit } from '@/libs/api/audit';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { documentTemplates, documentTemplateVersions } from '@/features/cards/models/cards-schema';

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    const queryArgs = [eq(documentTemplates.tenantId, tenantId)];
    if (type) {
      queryArgs.push(eq(documentTemplates.type, type as any));
    }
    const templates = await db.select().from(documentTemplates)
      .where(and(...queryArgs))
      .orderBy(desc(documentTemplates.createdAt));

    // For a real library, we might also want to left join the latest version to get the thumbnail.
    // For now, this returns the base templates.

    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.templates.manage');

    const body = await request.json();
    const { name, type } = body;

    if (!name || !type) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Le nom et le type sont obligatoires.');
    }

    const [newTemplate] = await db.insert(documentTemplates).values({
      tenantId,
      name,
      type,
      status: 'draft',
      isDefault: false,
      createdBy: context.userId,
    }).returning();

    // Create an initial empty version
    const defaultSchemaJson = {
      basePdf: { width: 85.60, height: 53.98, padding: [0, 0, 0, 0] },
      schemas: [[]] // pdfme structure: one empty page
    };

    const [newVersion] = await db.insert(documentTemplateVersions).values({
      tenantId,
      templateId: newTemplate!.id,
      versionNumber: 1,
      pageWidthMm: 85,
      pageHeightMm: 54,
      orientation: 'landscape',
      schemaJson: defaultSchemaJson,
    }).returning();

    recordAudit(context, 'create', 'document_template', newTemplate!.id);

    return NextResponse.json({ 
      success: true, 
      data: { template: newTemplate, initialVersion: newVersion },
      message: 'Modèle créé avec succès'
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
