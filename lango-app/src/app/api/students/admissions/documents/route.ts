import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { applicantDocuments, applicants } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = ['photo', 'birth_certificate', 'school_certificate', 'guardian_cni', 'bulletin'] as const;

// Mirrors src/app/api/students/documents/route.ts exactly, but for the
// admission wizard's Step 3 upload - happens before a real student `user`
// row exists, only an `applicants` row (see future-implementation/
// admission-and-student-model). Copied forward into studentDocuments at
// approval, see PUT /api/students/admissions.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const applicantId = searchParams.get('applicantId');

    if (!applicantId) {
      return NextResponse.json({ success: false, message: 'applicantId requis.' }, { status: 400 });
    }

    const rows = await db
      .select({ documentType: applicantDocuments.documentType, fileExt: applicantDocuments.fileExt, uploadedAt: applicantDocuments.uploadedAt })
      .from(applicantDocuments)
      .where(and(eq(applicantDocuments.tenantId, tenantId), eq(applicantDocuments.applicantId, applicantId)));

    const byType = new Map(rows.map(r => [r.documentType, r]));
    const data = DOCUMENT_TYPES.map(type => ({
      documentType: type,
      uploaded: byType.has(type),
      uploadedAt: byType.get(type)?.uploadedAt ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const formData = await request.formData();
    const applicantId = formData.get('applicantId');
    const documentType = formData.get('documentType');
    const file = formData.get('file');

    if (typeof applicantId !== 'string' || !applicantId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'applicantId requis.');
    }
    if (typeof documentType !== 'string' || !(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'documentType invalide.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const [applicant] = await db
      .select({ id: applicants.id })
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);
    if (!applicant) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'La demande d\'admission indiquée n\'existe pas pour cet établissement.');
    }

    const ext = await saveUploadedFile(tenantId, `applicant-documents/${applicantId}/${documentType}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    await db
      .delete(applicantDocuments)
      .where(and(eq(applicantDocuments.tenantId, tenantId), eq(applicantDocuments.applicantId, applicantId), eq(applicantDocuments.documentType, documentType as typeof DOCUMENT_TYPES[number])));
    await db.insert(applicantDocuments).values({ tenantId, applicantId, documentType: documentType as typeof DOCUMENT_TYPES[number], fileExt: ext });

    recordAudit(context, 'create', 'applicant_document', applicantId, { documentType });

    return NextResponse.json({ success: true, message: 'Document enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
