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
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
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
        .select({
          id: user.id,
          name: user.name,
          matricule: user.matricule,
        })
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

        // 1. Try match by matricule
        let targetId = matriculeMap.get(baseName);

        // 2. Try match by user UUID
        if (!targetId && idMap.has(baseName)) {
          targetId = baseName;
        }

        // 3. Try match by slugified name
        if (!targetId) {
          targetId = nameMap.get(baseName.replace(/\s+/g, '_'));
        }

        if (targetId) {
          const student = allStudents.find((s) => s.id === targetId);
          try {
            const ext = await saveUploadedFile(tenantId, `${targetId}.{ext}`, item, ALLOWED_TYPES, MAX_SIZE_BYTES);
            await db
              .update(user)
              .set({ photoUrl: `${targetId}.${ext}` })
              .where(and(eq(user.id, targetId), eq(user.tenantId, tenantId)));
            matched.push({
              filename,
              studentId: targetId,
              studentName: student?.name || targetId,
            });
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

    const ext = await saveUploadedFile(tenantId, `${studentId}.{ext}`, singleFile, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const photoUrl = `/api/students/photos?id=${studentId}`;
    await db.update(user).set({ photoUrl: `${studentId}.${ext}` }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: { studentId, photoUrl }, message: 'Photo enregistrée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
