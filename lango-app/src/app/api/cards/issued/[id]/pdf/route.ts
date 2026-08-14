import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import { issuedDocuments, documentTemplateVersions } from '@/features/cards/models/cards-schema';
import { renderPdf } from '@/libs/document-studio/render';
import type { DocumentTemplateSchema } from '@/libs/document-studio/types';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'card-management');
    await requireCapability(context, 'cards.issue');

    const [doc] = await db.select().from(issuedDocuments)
      .where(and(eq(issuedDocuments.tenantId, tenantId), eq(issuedDocuments.id, id)))
      .limit(1);
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'Document émis introuvable.');

    const [version] = await db.select().from(documentTemplateVersions)
      .where(and(
        eq(documentTemplateVersions.tenantId, tenantId),
        eq(documentTemplateVersions.id, doc.templateVersionId),
      ))
      .limit(1);
    if (!version) throw new ApiError(404, 'NOT_FOUND', 'Version de modèle introuvable.');

    // Re-render from the stored snapshot: the issuance records the exact inputs
    // used, so a downloaded PDF matches the originally rendered card even if the
    // template has since been re-published.
    const pdf = await renderPdf({
      template: version.schemaJson as DocumentTemplateSchema,
      inputs: [doc.renderDataSnapshot as Record<string, string>],
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="carte-${doc.id}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
