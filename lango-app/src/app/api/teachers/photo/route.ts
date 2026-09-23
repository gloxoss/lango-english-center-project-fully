import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { findScopedTeacher } from '@/features/teachers/server/teacher-service';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Teacher photos.
//
// Security rules:
//   - a teacher may read and mutate ONLY their own photo;
//   - a school_admin may read any teacher in their branch scope, and mutate
//     only with the teachers.update capability (branch-scoped);
//   - every mutation is audited.

async function resolvePhotoTarget(context: Awaited<ReturnType<typeof requireRequestContext>>, tenantId: string, teacherId: string) {
  if (context.role === 'teacher') {
    if (teacherId !== context.userId) {
      throw new ApiError(403, 'FORBIDDEN', 'Un enseignant ne peut gérer que sa propre photo.');
    }
    const [teacher] = await db
      .select({ id: user.id, photoUrl: user.photoUrl })
      .from(user)
      .where(and(eq(user.id, teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .limit(1);
    return teacher ?? null;
  }

  // school_admin (or super_admin with a resolved tenant): authoritative branch scope.
  return findScopedTeacher(context, tenantId, teacherId);
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'id requis.' }, { status: 400 });
    }

    const teacher = await resolvePhotoTarget(context, tenantId, id);
    if (!teacher?.photoUrl) {
      return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
    }

    const ext = teacher.photoUrl.split('.').pop() ?? 'jpg';
    try {
      const bytes = await readUploadedFile(tenantId, `teachers/${id}.${ext}`);
      return new NextResponse(new Uint8Array(bytes), {
        headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'private, max-age=3600' },
      });
    } catch {
      return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);

    const formData = await request.formData();
    const teacherId = formData.get('teacherId');
    const file = formData.get('file');

    if (typeof teacherId !== 'string' || !teacherId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'teacherId requis.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    if (context.role !== 'teacher') {
      await requireCapability(context, 'teachers.update');
    }

    const teacher = await resolvePhotoTarget(context, tenantId, teacherId);
    if (!teacher) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    const ext = await saveUploadedFile(tenantId, `teachers/${teacherId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const photoUrl = `/api/teachers/photo?id=${teacherId}`;
    await db
      .update(user)
      .set({ photoUrl: `teachers/${teacherId}.${ext}` })
      .where(and(eq(user.id, teacherId), eq(user.tenantId, tenantId)));

    recordAudit(context, 'update', 'teacher_photo', teacherId, { ext });

    return NextResponse.json({ success: true, data: { teacherId, photoUrl }, message: 'Photo enregistrée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
