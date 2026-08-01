import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { studentDocuments, user } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = ['photo', 'birth_certificate', 'school_certificate', 'guardian_cni', 'bulletin'] as const;

// Upload status per document type for one student - the admission wizard's
// step 3 checklist. GET ?studentId= lists which of the 5 kinds are on file.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ success: false, message: 'studentId requis.' }, { status: 400 });
    }

    const rows = await db
      .select({ documentType: studentDocuments.documentType, fileExt: studentDocuments.fileExt, uploadedAt: studentDocuments.uploadedAt })
      .from(studentDocuments)
      .where(and(eq(studentDocuments.tenantId, tenantId), eq(studentDocuments.studentId, studentId)));

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
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);

    const formData = await request.formData();
    const studentId = formData.get('studentId');
    const documentType = formData.get('documentType');
    const file = formData.get('file');

    if (typeof studentId !== 'string' || !studentId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'studentId requis.');
    }
    if (typeof documentType !== 'string' || !(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'documentType invalide.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const [student] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas pour cet établissement.');
    }

    const ext = await saveUploadedFile(tenantId, `documents/${studentId}/${documentType}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    await db
      .delete(studentDocuments)
      .where(and(eq(studentDocuments.tenantId, tenantId), eq(studentDocuments.studentId, studentId), eq(studentDocuments.documentType, documentType as typeof DOCUMENT_TYPES[number])));
    await db.insert(studentDocuments).values({ tenantId, studentId, documentType: documentType as typeof DOCUMENT_TYPES[number], fileExt: ext });

    recordAudit(context, 'create', 'student_document', studentId, { documentType });

    return NextResponse.json({ success: true, message: 'Document enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
