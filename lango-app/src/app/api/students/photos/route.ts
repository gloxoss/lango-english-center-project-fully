import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { studentPhotos, user } from '@/models/Schema';

const setProfilePhotoSchema = z.object({
  studentId: z.string().trim().min(1, 'studentId requis.'),
  photoId: z.string().trim().min(1, 'photoId requis.'),
}).strict();

const ALLOWED_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function photoBinary(bytes: Buffer, url: string) {
  const ext = url.split('.').pop() ?? 'jpg';
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'private, max-age=3600' },
  });
}

// Query-param branches: ?photoId= serves a gallery photo, ?id= serves the
// profile photo, ?gallery= lists a student's gallery, default lists the roster.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const photoId = searchParams.get('photoId');
    const galleryStudentId = searchParams.get('gallery');

    if (photoId) {
      const [photo] = await db
        .select({ url: studentPhotos.url })
        .from(studentPhotos)
        .where(and(eq(studentPhotos.id, photoId), eq(studentPhotos.tenantId, tenantId)))
        .limit(1);
      if (!photo) {
        return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
      }
      try {
        const bytes = await readUploadedFile(tenantId, photo.url);
        return photoBinary(bytes, photo.url);
      } catch {
        return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
      }
    }

    if (id) {
      const [student] = await db
        .select({ photoUrl: user.photoUrl })
        .from(user)
        .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);
      if (!student?.photoUrl) {
        return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
      }
      try {
        const bytes = await readUploadedFile(tenantId, student.photoUrl);
        return photoBinary(bytes, student.photoUrl);
      } catch {
        return NextResponse.json({ success: false, message: 'Photo non trouvée' }, { status: 404 });
      }
    }

    if (galleryStudentId) {
      const [student] = await db
        .select({ photoUrl: user.photoUrl })
        .from(user)
        .where(and(eq(user.id, galleryStudentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);
      if (!student) {
        throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable pour cet établissement.');
      }
      const photos = await db
        .select()
        .from(studentPhotos)
        .where(and(eq(studentPhotos.tenantId, tenantId), eq(studentPhotos.studentId, galleryStudentId)))
        .orderBy(studentPhotos.uploadedAt);
      return NextResponse.json({
        success: true,
        data: photos.map(p => ({
          id: p.id,
          src: `/api/students/photos?photoId=${p.id}`,
          uploadedAt: p.uploadedAt,
          isProfile: p.url === student.photoUrl,
        })),
      });
    }

    const rows = await db
      .select({
        id: user.id,
        fullName: user.name,
        matricule: user.matricule,
        photoUrl: user.photoUrl,
      })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

    return NextResponse.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// Save a gallery photo + promote it to the profile photo (most-recent wins).
async function storePhoto(tenantId: string, studentId: string, file: File, uploadedBy: string | undefined) {
  const photoId = randomUUID();
  const ext = await saveUploadedFile(tenantId, `${studentId}/${photoId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);
  const url = `${studentId}/${photoId}.${ext}`;
  await db.insert(studentPhotos).values({ tenantId, studentId, url, uploadedBy });
  await db.update(user).set({ photoUrl: url }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));
  return url;
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);

    const formData = await request.formData();
    const studentId = formData.get('studentId');
    const singleFile = formData.get('file');
    const batchFiles = formData.getAll('files');

    // Case 1: Batch multi-photo upload (§2.7)
    if (batchFiles.length > 0 && !(singleFile instanceof File && studentId)) {
      const allStudents = await db
        .select({ id: user.id, name: user.name, matricule: user.matricule })
        .from(user)
        .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

      const matriculeMap = new Map<string, string>();
      const nameMap = new Map<string, string>();
      const idMap = new Set<string>();

      for (const s of allStudents) {
        idMap.add(s.id);
        if (s.matricule) matriculeMap.set(s.matricule.trim().toLowerCase(), s.id);
        if (s.name) nameMap.set(s.name.trim().toLowerCase().replace(/\s+/g, '_'), s.id);
      }

      const matched: Array<{ filename: string; studentId: string; studentName: string }> = [];
      const unmatched: string[] = [];

      for (const item of batchFiles) {
        if (!(item instanceof File)) continue;
        const filename = item.name;
        const baseName = filename.replace(/\.[^/.]+$/, '').trim().toLowerCase();

        let targetId = matriculeMap.get(baseName);
        if (!targetId && idMap.has(baseName)) targetId = baseName;
        if (!targetId) targetId = nameMap.get(baseName.replace(/\s+/g, '_'));

        if (targetId) {
          const student = allStudents.find((s) => s.id === targetId);
          try {
            await storePhoto(tenantId, targetId, item, context.userId);
            matched.push({ filename, studentId: targetId, studentName: student?.name || targetId });
          } catch {
            unmatched.push(`${filename} (erreur format/taille)`);
          }
        } else {
          unmatched.push(filename);
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          totalFiles: batchFiles.length,
          matchedCount: matched.length,
          unmatchedCount: unmatched.length,
          matched,
          unmatched,
        },
        message: `${matched.length} photo(s) associée(s) et enregistrée(s) avec succès.`,
      });
    }

    // Case 2: Single photo upload
    if (typeof studentId !== 'string' || !studentId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'studentId requis.');
    }
    if (!(singleFile instanceof File)) {
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

    await storePhoto(tenantId, studentId, singleFile, context.userId);

    return NextResponse.json({ success: true, data: { studentId }, message: 'Photo enregistrée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// Promote an existing gallery photo to the student's profile photo.
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);

    const body = await parseJson(request, setProfilePhotoSchema);
    const { studentId, photoId } = body;

    const [photo] = await db
      .select({ url: studentPhotos.url })
      .from(studentPhotos)
      .where(and(
        eq(studentPhotos.id, photoId),
        eq(studentPhotos.studentId, studentId),
        eq(studentPhotos.tenantId, tenantId),
      ))
      .limit(1);
    if (!photo) {
      throw new ApiError(404, 'PHOTO_NOT_FOUND', 'Photo introuvable pour cet élève.');
    }

    await db.update(user).set({ photoUrl: photo.url }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: { studentId, photoId }, message: 'Photo de profil définie.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
