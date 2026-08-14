import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  certificateTemplates,
  certificateTemplateVersions,
} from '@/features/certificates/models/certificates-schema';

const createSchema = z.object({
  schemaJson: z.any().optional(),
  templateSchema: z.any().optional(),
  pdfmeBasePdf: z.any().optional(),
  publish: z.boolean().optional().default(false),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const versions = await db.select().from(certificateTemplateVersions)
      .where(and(
        eq(certificateTemplateVersions.tenantId, tenantId),
        eq(certificateTemplateVersions.templateId, id),
      ))
      .orderBy(desc(certificateTemplateVersions.versionNumber));

    const data = versions.map(v => ({
      ...v,
      schemaJson: { basePdf: v.pdfmeBasePdf, schemas: v.templateSchema },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.templates.manage');

    const body = await parseJson(request, createSchema);

    const [template] = await db.select().from(certificateTemplates)
      .where(and(eq(certificateTemplates.tenantId, tenantId), eq(certificateTemplates.id, id)))
      .limit(1);
    if (!template) {
      throw new ApiError(404, 'NOT_FOUND', 'Modèle de certificat introuvable pour cet établissement.');
    }

    let templateSchema = body.templateSchema;
    let pdfmeBasePdf = body.pdfmeBasePdf;
    if (body.schemaJson) {
      templateSchema = body.schemaJson.schemas ?? [];
      pdfmeBasePdf = body.schemaJson.basePdf ?? { width: 794, height: 1123 };
    }

    const [latest] = await db.select().from(certificateTemplateVersions)
      .where(and(
        eq(certificateTemplateVersions.tenantId, tenantId),
        eq(certificateTemplateVersions.templateId, id),
      ))
      .orderBy(desc(certificateTemplateVersions.versionNumber))
      .limit(1);

    const nextVersion = latest ? latest.versionNumber + 1 : 1;
    const status = body.publish ? 'active' : 'draft';

    const [newVersion] = await db.insert(certificateTemplateVersions).values({
      tenantId,
      templateId: template.id,
      versionNumber: nextVersion,
      templateSchema,
      pdfmeBasePdf,
      status,
      createdBy: context.userId,
    }).returning();
    if (!newVersion) {
      throw new ApiError(500, 'CREATE_FAILED', 'Erreur lors de la création de la version du modèle.');
    }

    if (body.publish) {
      await db.update(certificateTemplates)
        .set({ status: 'active' })
        .where(eq(certificateTemplates.id, template.id));
    }

    recordAudit(context, 'create', 'certificate_template_version', newVersion.id, {
      templateId: template.id,
      versionNumber: nextVersion,
      publish: body.publish,
    });

    return NextResponse.json({
      success: true,
      data: { ...newVersion, schemaJson: { basePdf: newVersion.pdfmeBasePdf, schemas: newVersion.templateSchema } },
      message: body.publish ? 'Modèle publié avec succès' : 'Brouillon enregistré avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
