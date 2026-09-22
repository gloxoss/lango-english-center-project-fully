import { readFile, unlink } from 'node:fs/promises';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, resolveTenantPath, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { studentDocuments, user } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_TYPES = ['photo', 'birth_certificate', 'school_certificate', 'guardian_cni', 'bulletin'] as const;

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const documentType = searchParams.get('documentType');
    const isView = searchParams.get('view') === '1' || searchParams.get('download') === '1';

    if (!studentId) {
      return NextResponse.json({ success: false, message: 'studentId requis.' }, { status: 400 });
    }

    // Branch authorization check
    const [student] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
      .limit(1);

    if (!student) {
      return NextResponse.json({ success: false, message: 'Élève introuvable.' }, { status: 404 });
    }

    if (context.branchId && student.branchId && student.branchId !== context.branchId) {
      return NextResponse.json({ success: false, message: 'Accès interdit à cette succursale.' }, { status: 403 });
    }

    // Serve file content if requested
    if (isView && documentType) {
      const [doc] = await db
        .select({ fileExt: studentDocuments.fileExt })
        .from(studentDocuments)
        .where(and(
          eq(studentDocuments.tenantId, tenantId),
          eq(studentDocuments.studentId, studentId),
          eq(studentDocuments.documentType, documentType as typeof DOCUMENT_TYPES[number]),
        ))
        .limit(1);

      if (!doc) {
        return NextResponse.json({ success: false, message: 'Document introuvable.' }, { status: 404 });
      }

      const filePath = resolveTenantPath(tenantId, `documents/${studentId}/${documentType}.${doc.fileExt}`);
      try {
        const fileBytes = await readFile(filePath);
        return new NextResponse(fileBytes, {
          status: 200,
          headers: {
            'Content-Type': contentTypeFor(doc.fileExt),
            'Content-Disposition': searchParams.get('download') === '1'
              ? `attachment; filename="${documentType}.${doc.fileExt}"`
              : 'inline',
          },
        });
      } catch {
        return NextResponse.json({ success: false, message: 'Fichier physique introuvable sur le disque.' }, { status: 404 });
      }
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
      fileExt: byType.get(type)?.fileExt ?? null,
      url: byType.has(type) ? `/api/students/documents?studentId=${studentId}&documentType=${type}&view=1` : null,
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
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
      .limit(1);
    if (!student) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'élève indiqué n\'existe pas pour cet établissement.');
    }
    if (context.branchId && student.branchId && student.branchId !== context.branchId) {
      throw new ApiError(403, 'FORBIDDEN', 'Accès non autorisé pour cette succursale.');
    }

    const ext = await saveUploadedFile(tenantId, `documents/${studentId}/${documentType}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    await db
      .delete(studentDocuments)
      .where(and(eq(studentDocuments.tenantId, tenantId), eq(studentDocuments.studentId, studentId), eq(studentDocuments.documentType, documentType as typeof DOCUMENT_TYPES[number])));
    await db.insert(studentDocuments).values({ tenantId, studentId, documentType: documentType as typeof DOCUMENT_TYPES[number], fileExt: ext });

    recordAudit(context, 'create', 'student_document', studentId, { documentType });

    return NextResponse.json({
      success: true,
      message: 'Document enregistré avec succès',
      data: {
        documentType,
        uploaded: true,
        fileExt: ext,
        url: `/api/students/documents?studentId=${studentId}&documentType=${documentType}&view=1`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const documentType = searchParams.get('documentType');

    if (!studentId || !documentType) {
      return NextResponse.json({ success: false, message: 'studentId et documentType requis.' }, { status: 400 });
    }

    // Branch authorization check
    const [student] = await db
      .select({ id: user.id, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), inArray(user.role, ['student', 'alumni'])))
      .limit(1);
    if (!student) {
      return NextResponse.json({ success: false, message: 'Élève introuvable.' }, { status: 404 });
    }
    if (context.branchId && student.branchId && student.branchId !== context.branchId) {
      return NextResponse.json({ success: false, message: 'Accès non autorisé pour cette succursale.' }, { status: 403 });
    }

    const [existing] = await db
      .select({ fileExt: studentDocuments.fileExt })
      .from(studentDocuments)
      .where(and(
        eq(studentDocuments.tenantId, tenantId),
        eq(studentDocuments.studentId, studentId),
        eq(studentDocuments.documentType, documentType as typeof DOCUMENT_TYPES[number]),
      ))
      .limit(1);

    if (existing) {
      // Try to remove physical file
      try {
        const filePath = resolveTenantPath(tenantId, `documents/${studentId}/${documentType}.${existing.fileExt}`);
        await unlink(filePath);
      } catch {
        // file might not exist on disk, ignore
      }

      await db
        .delete(studentDocuments)
        .where(and(
          eq(studentDocuments.tenantId, tenantId),
          eq(studentDocuments.studentId, studentId),
          eq(studentDocuments.documentType, documentType as typeof DOCUMENT_TYPES[number]),
        ));

      recordAudit(context, 'delete', 'student_document', studentId, { documentType });
    }

    return NextResponse.json({ success: true, message: 'Document supprimé avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
