import { and, eq, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { documentTemplateVersions, issuedDocuments } from '@/features/cards/models/cards-schema';
import { renderPdf } from '@/libs/document-studio/render';
import type { DocumentTemplateSchema } from '@/libs/document-studio/types';
import { requireStudentContext } from '@/features/student/api/guard';

// GET /api/student/me/report-cards/[id]/pdf — download an issued bulletin PDF.
// Scoped by session student and tenant. Returns 404 if not found, not active,
// revoked, or owned by a different student. Renders directly from the stored
// renderDataSnapshot using the canonical document system renderPdf.

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const ctx = await requireStudentContext(request);
    const tenantId = ctx.tenantId as string;
    const studentId = ctx.userId;
    const { id } = await params;

    const [doc] = await db
      .select()
      .from(issuedDocuments)
      .where(
        and(
          eq(issuedDocuments.tenantId, tenantId),
          eq(issuedDocuments.id, id),
          eq(issuedDocuments.type, 'report_card'),
          eq(issuedDocuments.subjectId, studentId),
          eq(issuedDocuments.status, 'active'),
          isNull(issuedDocuments.revokedAt),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Bulletin introuvable.');
    }

    const [version] = await db
      .select()
      .from(documentTemplateVersions)
      .where(
        and(
          eq(documentTemplateVersions.tenantId, tenantId),
          eq(documentTemplateVersions.id, doc.templateVersionId),
        ),
      )
      .limit(1);

    if (!version) {
      throw new ApiError(404, 'NOT_FOUND', 'Version de modèle introuvable.');
    }

    const pdf = await renderPdf({
      template: version.schemaJson as DocumentTemplateSchema,
      inputs: [doc.renderDataSnapshot as Record<string, string>],
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="bulletin-${doc.id}.pdf"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
