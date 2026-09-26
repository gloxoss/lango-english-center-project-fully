import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { assertBranchScope } from '@/libs/api/portal-scope';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { contentTypeFor, resolveTenantPath } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { applicantDocuments, applicants } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string; docType: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.view');

    const { id: applicantId, docType } = await params;
    const { searchParams } = new URL(req.url);
    const isDownload = searchParams.get('download') === '1';

    // 1. Verify Applicant belongs to tenant & authorized branch
    const [applicant] = await db
      .select({ id: applicants.id, branchId: applicants.branchId })
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    assertBranchScope(context, applicant.branchId);

    // 2. Fetch Document record
    const [doc] = await db
      .select({
        fileExt: applicantDocuments.fileExt,
        documentType: applicantDocuments.documentType,
      })
      .from(applicantDocuments)
      .where(
        and(
          eq(applicantDocuments.tenantId, tenantId),
          eq(applicantDocuments.applicantId, applicantId),
          eq(applicantDocuments.documentType, docType as any),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document introuvable.');
    }

    // 3. Resolve physical file path and stream
    const filePath = resolveTenantPath(tenantId, `applicant-documents/${applicantId}/${doc.documentType}.${doc.fileExt}`);
    try {
      const fileBytes = await readFile(filePath);
      return new NextResponse(fileBytes, {
        status: 200,
        headers: {
          'Content-Type': contentTypeFor(doc.fileExt),
          'Content-Disposition': isDownload
            ? `attachment; filename="${doc.documentType}.${doc.fileExt}"`
            : 'inline',
        },
      });
    } catch {
      throw new ApiError(404, 'FILE_NOT_FOUND_ON_DISK', 'Le fichier physique est introuvable sur le disque.');
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}
