import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
} from '@/features/certificates/models/certificates-schema';
import { z } from 'zod';

const createSchema = z.object({
  // Full pdfme template ({ basePdf, schemas }) - split into the two stored
  // jsonb columns so the designer can keep using the shared document-studio shape.
  schemaJson: z.any().optional(),
  templateSchema: z.any().optional(),
  pdfmeBasePdf: z.any().optional(),
  fieldAllowlist: z.object({ allowedFields: z.array(z.string()) }).optional(),
  publish: z.boolean().optional().default(false),
}).strict();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const versions = await db.select().from(certificateDefinitionVersions)
      .where(and(
        eq(certificateDefinitionVersions.tenantId, tenantId),
        eq(certificateDefinitionVersions.definitionId, id),
      ))
      .orderBy(desc(certificateDefinitionVersions.versionNumber));

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

    const [definition] = await db.select().from(certificateDefinitions)
      .where(and(eq(certificateDefinitions.tenantId, tenantId), eq(certificateDefinitions.id, id)))
      .limit(1);
    if (!definition) {
      throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
    }

    // Accept either a composed schemaJson (designer) or split columns (API).
    let templateSchema = body.templateSchema;
    let pdfmeBasePdf = body.pdfmeBasePdf;
    if (body.schemaJson) {
      templateSchema = body.schemaJson.schemas ?? [];
      pdfmeBasePdf = body.schemaJson.basePdf ?? { width: 794, height: 1123 };
    }

    const [latest] = await db.select().from(certificateDefinitionVersions)
      .where(and(
        eq(certificateDefinitionVersions.tenantId, tenantId),
        eq(certificateDefinitionVersions.definitionId, id),
      ))
      .orderBy(desc(certificateDefinitionVersions.versionNumber))
      .limit(1);

    const nextVersion = latest ? latest.versionNumber + 1 : 1;
    const status = body.publish ? 'active' : 'draft';

    const [newVersion] = await db.insert(certificateDefinitionVersions).values({
      tenantId,
      definitionId: definition.id,
      versionNumber: nextVersion,
      fieldAllowlist: body.fieldAllowlist ?? { allowedFields: [] },
      templateSchema,
      pdfmeBasePdf,
      status,
      createdBy: context.userId,
    }).returning();
    if (!newVersion) {
      throw new ApiError(500, 'CREATE_FAILED', 'Erreur lors de la création de la version.');
    }

    if (body.publish) {
      await db.update(certificateDefinitions)
        .set({ status: 'active' })
        .where(eq(certificateDefinitions.id, definition.id));
    }

    recordAudit(context, 'create', 'certificate_definition_version', newVersion.id, {
      definitionId: definition.id,
      versionNumber: nextVersion,
      publish: body.publish,
    });

    return NextResponse.json({
      success: true,
      data: { ...newVersion, schemaJson: { basePdf: newVersion.pdfmeBasePdf, schemas: newVersion.templateSchema } },
      message: body.publish ? 'Version publiée avec succès' : 'Brouillon enregistré avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
