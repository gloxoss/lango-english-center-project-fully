import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// List roster + photo status - real GET of a specific student's image bytes
// is a separate ?id= branch below (binary response, not JSON).
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const [student] = await db
        .select({ photoUrl: user.photoUrl })
        .from(user)
        .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);
      if (!student?.photoUrl) {
        return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
      }
      const ext = student.photoUrl.split('.').pop() ?? 'jpg';
      try {
        const bytes = await readUploadedFile(tenantId, `${id}.${ext}`);
        return new NextResponse(new Uint8Array(bytes), { headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'private, max-age=3600' } });
      } catch {
        return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
      }
    }

    const rows = await db
      .select({ id: user.id, fullName: user.name, photoUrl: user.photoUrl })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
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
    const file = formData.get('file');

    if (typeof studentId !== 'string' || !studentId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'studentId requis.');
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

    const ext = await saveUploadedFile(tenantId, `${studentId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const photoUrl = `/api/students/photos?id=${studentId}`;
    await db.update(user).set({ photoUrl: `${studentId}.${ext}` }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: { studentId, photoUrl }, message: 'Photo enregistrée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
