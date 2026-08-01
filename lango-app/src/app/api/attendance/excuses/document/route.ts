import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { attendanceExcuses } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Real document bytes for an excuse - documentUrl on the row just points back
// here (?excuseId=) once uploaded, matching the pattern already used for
// student photos/documents.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const excuseId = searchParams.get('excuseId');
    if (!excuseId) {
      return NextResponse.json({ success: false, message: 'excuseId requis.' }, { status: 400 });
    }

    const conditions = [eq(attendanceExcuses.id, excuseId), eq(attendanceExcuses.tenantId, tenantId)];
    if (context.role === 'student') {
      conditions.push(eq(attendanceExcuses.studentId, context.userId));
    }

    const [excuse] = await db
      .select({ documentFileExt: attendanceExcuses.documentFileExt })
      .from(attendanceExcuses)
      .where(and(...conditions))
      .limit(1);

    if (!excuse?.documentFileExt) {
      return NextResponse.json({ success: false, message: 'Document non trouvé' }, { status: 404 });
    }

    try {
      const bytes = await readUploadedFile(tenantId, `excuses/${excuseId}.${excuse.documentFileExt}`);
      return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': contentTypeFor(excuse.documentFileExt), 'Cache-Control': 'private, max-age=3600' } });
    } catch {
      return NextResponse.json({ success: false, message: 'Document non trouvé' }, { status: 404 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'student', 'parent']);
    const tenantId = requireTenant(context);

    const formData = await request.formData();
    const excuseId = formData.get('excuseId');
    const file = formData.get('file');

    if (typeof excuseId !== 'string' || !excuseId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'excuseId requis.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const conditions = [eq(attendanceExcuses.id, excuseId), eq(attendanceExcuses.tenantId, tenantId)];
    if (context.role === 'student') {
      conditions.push(eq(attendanceExcuses.studentId, context.userId));
    }
    const [excuse] = await db.select({ id: attendanceExcuses.id }).from(attendanceExcuses).where(and(...conditions)).limit(1);
    if (!excuse) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'Justification introuvable.');
    }

    const ext = await saveUploadedFile(tenantId, `excuses/${excuseId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    await db
      .update(attendanceExcuses)
      .set({ documentUrl: `/api/attendance/excuses/document?excuseId=${excuseId}`, documentFileExt: ext, updatedAt: new Date().toISOString() })
      .where(eq(attendanceExcuses.id, excuseId));

    return NextResponse.json({ success: true, data: { excuseId, documentUrl: `/api/attendance/excuses/document?excuseId=${excuseId}` }, message: 'Document enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
