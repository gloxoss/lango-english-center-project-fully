import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { db } from '@/libs/DB';
import {
  certificateDefinitionVersions,
  certificateEvents,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';
import { renderPdf } from '@/libs/document-studio/render';
import type { DocumentTemplateSchema } from '@/libs/document-studio/types';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [certificate] = await db.select().from(issuedCertificates)
      .where(and(eq(issuedCertificates.tenantId, tenantId), eq(issuedCertificates.id, id)))
      .limit(1);
    if (!certificate) {
      throw new ApiError(404, 'NOT_FOUND', 'Certificat émis introuvable pour cet établissement.');
    }

    // The render snapshot is preserved in the issuance event's metadata (the
    // issued_certificates schema stores no render-snapshot column).
    const [issuedEvent] = await db.select().from(certificateEvents)
      .where(and(
        eq(certificateEvents.tenantId, tenantId),
        eq(certificateEvents.issuedCertificateId, id),
        eq(certificateEvents.eventKind, 'issued'),
      ))
      .orderBy(desc(certificateEvents.createdAt))
      .limit(1);

    const [version] = await db.select().from(certificateDefinitionVersions)
      .where(and(
        eq(certificateDefinitionVersions.tenantId, tenantId),
        eq(certificateDefinitionVersions.id, certificate.versionId),
      ))
      .limit(1);

    if (!version || !issuedEvent) {
      throw new ApiError(404, 'NOT_FOUND', 'Impossible de reconstruire le PDF du certificat.');
    }

    const render = (issuedEvent.metadata as Record<string, unknown> | null)?.render as Record<string, string> | undefined;
    if (!render) {
      throw new ApiError(404, 'NOT_FOUND', 'Aucun instantané de rendu disponible pour ce certificat.');
    }

    const pdf = await renderPdf({
      template: { basePdf: version.pdfmeBasePdf, schemas: version.templateSchema } as DocumentTemplateSchema,
      inputs: [render],
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificat-${certificate.serialNumber}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
