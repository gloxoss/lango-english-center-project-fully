import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { branchWhere, assertBranchScope } from '@/libs/api/portal-scope';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import {
  contentTypeFor,
  deleteUploadedFile,
  inspectImageBuffer,
  readUploadedFile,
  saveUploadedFile,
  uploadedFileExists,
} from '@/libs/api/uploads';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { studentPhotos, user } from '@/models/Schema';

const setProfilePhotoSchema = z.object({
  studentId: z.string().trim().min(1, 'studentId requis.'),
  photoId: z.string().trim().min(1, 'photoId requis.'),
}).strict();

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function normalizeStudentName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function photoBinary(bytes: Buffer, url: string) {
  const ext = url.split('.').pop() ?? 'jpg';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentTypeFor(ext),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// ============================================================================
// GET /api/students/photos
// 1. ?photoId= : Serves specific gallery photo binary
// 2. ?id= : Serves student authoritative profile photo binary
// 3. ?gallery= : Lists historical gallery photos for a student
// 4. Default: Lists student roster with search, filter, pagination, & authoritative KPIs
// ============================================================================
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'accountant']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const photoId = searchParams.get('photoId');
    const galleryStudentId = searchParams.get('gallery');

    // Case 1: Specific gallery photo binary
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
        return NextResponse.json({ success: false, message: 'Fichier photo physique introuvable' }, { status: 404 });
      }
    }

    // Case 2: Authoritative student profile photo binary
    if (id) {
      const [student] = await db
        .select({ id: user.id, photoUrl: user.photoUrl, branchId: user.branchId })
        .from(user)
        .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);

      if (!student) {
        return NextResponse.json({ success: false, message: 'Élève introuvable' }, { status: 404 });
      }

      if (context.branchId && student.branchId && student.branchId !== context.branchId) {
        return NextResponse.json({ success: false, message: 'Accès non autorisé pour cette succursale' }, { status: 403 });
      }

      if (!student.photoUrl) {
        return NextResponse.json({ success: false, message: 'Aucune photo enregistrée pour cet élève' }, { status: 404 });
      }

      try {
        const bytes = await readUploadedFile(tenantId, student.photoUrl);
        return photoBinary(bytes, student.photoUrl);
      } catch {
        return NextResponse.json({ success: false, message: 'Fichier photo physique introuvable' }, { status: 404 });
      }
    }

    // Case 3: Historical gallery for student
    if (galleryStudentId) {
      const [student] = await db
        .select({ id: user.id, photoUrl: user.photoUrl, branchId: user.branchId })
        .from(user)
        .where(and(eq(user.id, galleryStudentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
        .limit(1);

      if (!student) {
        throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable pour cet établissement.');
      }

      assertBranchScope(context, student.branchId);

      const photos = await db
        .select()
        .from(studentPhotos)
        .where(and(eq(studentPhotos.tenantId, tenantId), eq(studentPhotos.studentId, galleryStudentId)))
        .orderBy(desc(studentPhotos.uploadedAt));

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

    // Case 4: Student gallery roster with filters and server KPIs
    const searchTerm = searchParams.get('search')?.trim() || '';
    const photoFilter = searchParams.get('filter') || 'all'; // 'all' | 'with_photo' | 'without_photo'
    const branchFilter = searchParams.get('branchId') || context.branchId || null;

    const baseConditions = [
      eq(user.tenantId, tenantId),
      eq(user.role, 'student'),
    ];
    if (branchFilter) {
      baseConditions.push(eq(user.branchId, branchFilter));
    }

    // 1. Authoritative KPI counts (scoped to current branch / tenant filter)
    const [kpiCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        withPhoto: sql<number>`count(case when ${user.photoUrl} is not null and ${user.photoUrl} != '' then 1 end)`,
        withoutPhoto: sql<number>`count(case when ${user.photoUrl} is null or ${user.photoUrl} = '' then 1 end)`,
      })
      .from(user)
      .where(and(...baseConditions));

    const totalStudents = Number(kpiCounts?.total ?? 0);
    const withPhotoStudents = Number(kpiCounts?.withPhoto ?? 0);
    const withoutPhotoStudents = Number(kpiCounts?.withoutPhoto ?? 0);

    // 2. Filtered list query
    const listConditions = [...baseConditions];
    if (searchTerm) {
      const termPattern = `%${searchTerm}%`;
      listConditions.push(
        or(
          ilike(user.name, termPattern),
          ilike(user.matricule, termPattern),
          ilike(user.nationalId, termPattern),
        )!,
      );
    }

    if (photoFilter === 'with_photo') {
      listConditions.push(sql`${user.photoUrl} is not null and ${user.photoUrl} != ''`);
    } else if (photoFilter === 'without_photo') {
      listConditions.push(sql`${user.photoUrl} is null or ${user.photoUrl} = ''`);
    }

    const rows = await db
      .select({
        id: user.id,
        fullName: user.name,
        matricule: user.matricule,
        nationalId: user.nationalId,
        photoUrl: user.photoUrl,
        branchId: user.branchId,
      })
      .from(user)
      .where(and(...listConditions))
      .orderBy(user.name);

    // Counts stay in step with the with_photo filter (same rows). Photos whose
    // file is gone are reported apart so the page can say so instead of showing
    // a broken image as a real photo (audit S-34). Runs after the list query.
    const photoRows = await db
      .select({ photoUrl: user.photoUrl })
      .from(user)
      .where(and(...baseConditions, sql`${user.photoUrl} is not null and ${user.photoUrl} != ''`));
    const photoChecks = await Promise.all(photoRows.map(r => uploadedFileExists(tenantId, r.photoUrl!).catch(() => false)));
    const missingPhotoFiles = photoChecks.filter(ok => !ok).length;

    return NextResponse.json({
      success: true,
      data: rows,
      total: rows.length,
      kpi: {
        total: totalStudents,
        withPhoto: withPhotoStudents,
        withoutPhoto: withoutPhotoStudents,
        missingFiles: missingPhotoFiles,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// ============================================================================
// Internal Storage & Safe Atomic Replacement
// ============================================================================
async function storeStudentPhoto(
  tenantId: string,
  studentId: string,
  file: File,
  uploadedBy: string | undefined,
  _method: 'single' | 'bulk' = 'single',
) {
  // Validate student belongs to tenant
  const [student] = await db
    .select({ id: user.id, photoUrl: user.photoUrl })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .limit(1);

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable pour cet établissement.');
  }

  const previousPhotoUrl = student.photoUrl;
  const photoId = randomUUID();
  const ext = await saveUploadedFile(
    tenantId,
    `students/${studentId}/${photoId}.{ext}`,
    file,
    ALLOWED_TYPES,
    MAX_SIZE_BYTES,
    { validateImageDimensions: true },
  );

  const newPhotoUrl = `students/${studentId}/${photoId}.${ext}`;

  // Atomic database update: insert gallery photo and update profile pointer
  await db.transaction(async (tx) => {
    await tx.insert(studentPhotos).values({
      tenantId,
      studentId,
      url: newPhotoUrl,
      uploadedBy,
    });
    await tx.update(user).set({ photoUrl: newPhotoUrl }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));
  });

  return { newPhotoUrl, previousPhotoUrl };
}

// ============================================================================
// POST /api/students/photos
// Supports:
// 1. action='preview': Dry-run candidate matching & image inspection for bulk upload
// 2. action='commit': Commits confirmed bulk upload items
// 3. default single-file upload: associates photo to studentId
// ============================================================================
export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');

    const formData = await request.formData();
    const action = formData.get('action');
    const studentId = formData.get('studentId');
    const singleFile = formData.get('file');
    const batchFiles = formData.getAll('files');

    // ------------------------------------------------------------------------
    // CASE A: Bulk Upload PREVIEW Stage (Dry-run reconciliation)
    // ------------------------------------------------------------------------
    if (action === 'preview' || (batchFiles.length > 0 && !studentId && action !== 'commit')) {
      if (batchFiles.length === 0) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Aucun fichier sélectionné pour l\'analyse.');
      }

      // Fetch all candidate students for this tenant (and branch if operator is restricted)
      const studentQueryConditions = [
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
      ];
      const branchCondition = branchWhere(context, user.branchId);

      if (branchCondition) studentQueryConditions.push(branchCondition);

      const allStudents = await db
        .select({
          id: user.id,
          name: user.name,
          matricule: user.matricule,
          nationalId: user.nationalId,
          photoUrl: user.photoUrl,
          branchId: user.branchId,
        })
        .from(user)
        .where(and(...studentQueryConditions));

      // Build deterministic lookup indexes
      const uuidMap = new Map<string, typeof allStudents[0]>();
      const matriculeMap = new Map<string, typeof allStudents[0]>();
      const massarMap = new Map<string, typeof allStudents[0]>();
      const nameMap = new Map<string, Array<typeof allStudents[0]>>();

      for (const s of allStudents) {
        uuidMap.set(s.id.toLowerCase(), s);
        if (s.matricule) {
          matriculeMap.set(s.matricule.trim().toLowerCase(), s);
        }
        if (s.nationalId) {
          massarMap.set(s.nationalId.trim().toLowerCase(), s);
        }
        if (s.name) {
          const norm = normalizeStudentName(s.name);
          const list = nameMap.get(norm) || [];
          list.push(s);
          nameMap.set(norm, list);
        }
      }

      type BulkPreviewItem = {
        fileIndex: number;
        filename: string;
        detectedIdentifier: string;
        matchedStudent: {
          id: string;
          name: string;
          matricule: string | null;
          nationalId: string | null;
          hasExistingPhoto: boolean;
        } | null;
        matricule: string | null;
        matchMethod: 'uuid' | 'matricule' | 'massar' | 'name' | null;
        status:
          | 'READY'
          | 'EXISTING_PHOTO'
          | 'AMBIGUOUS'
          | 'DUPLICATE_FILE_FOR_STUDENT'
          | 'NO_MATCH'
          | 'INVALID_IMAGE'
          | 'TOO_LARGE';
        reason: string;
      };

      const previewItems: BulkPreviewItem[] = [];
      const targetedStudentIds = new Set<string>();

      for (let idx = 0; idx < batchFiles.length; idx++) {
        const item = batchFiles[idx];
        if (!(item instanceof File)) {
          continue;
        }

        const filename = item.name;
        const parsed = path.parse(filename);
        const rawBase = parsed.name.trim();
        const baseLower = rawBase.toLowerCase();

        // 1. Technical file inspection
        if (item.size > MAX_SIZE_BYTES) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: null,
            matricule: null,
            matchMethod: null,
            status: 'TOO_LARGE',
            reason: `Fichier trop volumineux (${(item.size / (1024 * 1024)).toFixed(1)} Mo, maximum 5 Mo).`,
          });
          continue;
        }

        if (item.size === 0) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: null,
            matricule: null,
            matchMethod: null,
            status: 'INVALID_IMAGE',
            reason: 'Le fichier est vide (0 octet).',
          });
          continue;
        }

        const ext = ALLOWED_TYPES[item.type];
        if (!ext) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: null,
            matricule: null,
            matchMethod: null,
            status: 'INVALID_IMAGE',
            reason: `Format non supporté (${item.type || parsed.ext || 'inconnu'}). Formats acceptés : JPG, PNG, WebP.`,
          });
          continue;
        }

        try {
          const bytes = Buffer.from(await item.arrayBuffer());
          inspectImageBuffer(bytes, ext);
        } catch (err: any) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: null,
            matricule: null,
            matchMethod: null,
            status: 'INVALID_IMAGE',
            reason: err.message || 'Image corrompue ou dimensions inadaptées.',
          });
          continue;
        }

        // 2. Deterministic Candidate Matching
        let matched: typeof allStudents[0] | null = null;
        let matchMethod: 'uuid' | 'matricule' | 'massar' | 'name' | null = null;
        let isAmbiguous = false;
        let ambiguousCount = 0;

        // Precedence 1: UUID exact match
        if (uuidMap.has(baseLower)) {
          matched = uuidMap.get(baseLower)!;
          matchMethod = 'uuid';
        } else if (matriculeMap.has(baseLower)) {
          // Precedence 2: Internal matricule exact match
          matched = matriculeMap.get(baseLower)!;
          matchMethod = 'matricule';
        } else if (massarMap.has(baseLower)) {
          // Precedence 3: Massar exact match
          matched = massarMap.get(baseLower)!;
          matchMethod = 'massar';
        } else {
          // Precedence 4: Normalized full name match ONLY when count === 1
          const normalized = normalizeStudentName(rawBase);
          const candidates = nameMap.get(normalized) || [];
          if (candidates.length === 1) {
            matched = candidates[0]!;
            matchMethod = 'name';
          } else if (candidates.length > 1) {
            isAmbiguous = true;
            ambiguousCount = candidates.length;
            matchMethod = 'name';
          }
        }

        // 3. Resolve status
        if (isAmbiguous) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: null,
            matricule: null,
            matchMethod: 'name',
            status: 'AMBIGUOUS',
            reason: `${ambiguousCount} élèves correspondent au nom "${rawBase}". Résolution manuelle requise.`,
          });
          continue;
        }

        if (!matched) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: null,
            matricule: null,
            matchMethod: null,
            status: 'NO_MATCH',
            reason: `Aucun élève trouvé pour l'identifiant ou nom "${rawBase}".`,
          });
          continue;
        }

        // Check duplicate within batch
        if (targetedStudentIds.has(matched.id)) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: {
              id: matched.id,
              name: matched.name,
              matricule: matched.matricule,
              nationalId: matched.nationalId,
              hasExistingPhoto: Boolean(matched.photoUrl),
            },
            matricule: matched.matricule,
            matchMethod,
            status: 'DUPLICATE_FILE_FOR_STUDENT',
            reason: `Plusieurs fichiers du même lot ciblent l'élève ${matched.name} (${matched.matricule || matched.id}).`,
          });
          continue;
        }

        targetedStudentIds.add(matched.id);

        if (matched.photoUrl) {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: {
              id: matched.id,
              name: matched.name,
              matricule: matched.matricule,
              nationalId: matched.nationalId,
              hasExistingPhoto: true,
            },
            matricule: matched.matricule,
            matchMethod,
            status: 'EXISTING_PHOTO',
            reason: 'L\'élève possède déjà une photo de profil (remplacement au choix).',
          });
        } else {
          previewItems.push({
            fileIndex: idx,
            filename,
            detectedIdentifier: rawBase,
            matchedStudent: {
              id: matched.id,
              name: matched.name,
              matricule: matched.matricule,
              nationalId: matched.nationalId,
              hasExistingPhoto: false,
            },
            matricule: matched.matricule,
            matchMethod,
            status: 'READY',
            reason: 'Correspondance exacte trouvée. Prêt pour association.',
          });
        }
      }

      const summary = {
        total: previewItems.length,
        ready: previewItems.filter(p => p.status === 'READY').length,
        existing: previewItems.filter(p => p.status === 'EXISTING_PHOTO').length,
        ambiguous: previewItems.filter(p => p.status === 'AMBIGUOUS').length,
        duplicate: previewItems.filter(p => p.status === 'DUPLICATE_FILE_FOR_STUDENT').length,
        invalid: previewItems.filter(p => p.status === 'INVALID_IMAGE').length,
        tooLarge: previewItems.filter(p => p.status === 'TOO_LARGE').length,
        noMatch: previewItems.filter(p => p.status === 'NO_MATCH').length,
      };

      return NextResponse.json({
        success: true,
        data: {
          items: previewItems,
          summary,
        },
      });
    }

    // ------------------------------------------------------------------------
    // CASE B: Bulk Upload COMMIT Stage
    // ------------------------------------------------------------------------
    if (action === 'commit') {
      const confirmationsRaw = formData.get('confirmations');
      if (typeof confirmationsRaw !== 'string' || !confirmationsRaw) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Données de confirmation de lot requises.');
      }

      type ConfirmationItem = { fileIndex: number; studentId: string };
      let confirmations: ConfirmationItem[] = [];
      try {
        confirmations = JSON.parse(confirmationsRaw);
      } catch {
        throw new ApiError(400, 'INVALID_JSON', 'Format des confirmations invalide.');
      }

      const committed: Array<{ filename: string; studentId: string; studentName: string }> = [];
      const failed: Array<{ filename: string; reason: string }> = [];

      for (const conf of confirmations) {
        const file = batchFiles[conf.fileIndex];
        if (!(file instanceof File)) {
          failed.push({ filename: `Index ${conf.fileIndex}`, reason: 'Fichier absent du lot.' });
          continue;
        }

        try {
          const { newPhotoUrl, previousPhotoUrl } = await storeStudentPhoto(
            tenantId,
            conf.studentId,
            file,
            context.userId,
            'bulk',
          );

          const [student] = await db
            .select({ name: user.name })
            .from(user)
            .where(and(eq(user.id, conf.studentId), eq(user.tenantId, tenantId)))
            .limit(1);

          recordAudit(context, previousPhotoUrl ? 'update' : 'create', 'student_photo', conf.studentId, {
            previousPhotoUrl,
            newPhotoUrl,
            method: 'bulk',
          });

          committed.push({
            filename: file.name,
            studentId: conf.studentId,
            studentName: student?.name || conf.studentId,
          });
        } catch (err: any) {
          failed.push({ filename: file.name, reason: err.message || 'Erreur lors de l\'enregistrement.' });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          committedCount: committed.length,
          failedCount: failed.length,
          committed,
          failed,
        },
        message: `${committed.length} photo(s) enregistrée(s) avec succès.`,
      });
    }

    // ------------------------------------------------------------------------
    // CASE C: Single Photo Upload
    // ------------------------------------------------------------------------
    if (typeof studentId !== 'string' || !studentId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'studentId requis.');
    }
    if (!(singleFile instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const { newPhotoUrl, previousPhotoUrl } = await storeStudentPhoto(
      tenantId,
      studentId,
      singleFile,
      context.userId,
      'single',
    );

    recordAudit(context, previousPhotoUrl ? 'update' : 'create', 'student_photo', studentId, {
      previousPhotoUrl,
      newPhotoUrl,
      method: 'single',
    });

    return NextResponse.json({
      success: true,
      data: { studentId, photoUrl: `/api/students/photos?id=${studentId}` },
      message: 'Photo enregistrée avec succès',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// ============================================================================
// PUT /api/students/photos
// Promotes an existing historical gallery photo to profile photo
// ============================================================================
export async function PUT(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');

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

    const [current] = await db
      .select({ photoUrl: user.photoUrl })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)))
      .limit(1);

    await db.update(user).set({ photoUrl: photo.url }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    recordAudit(context, 'update', 'student_photo', studentId, {
      previousPhotoUrl: current?.photoUrl,
      newPhotoUrl: photo.url,
      action: 'promote_to_profile',
    });

    return NextResponse.json({ success: true, data: { studentId, photoId }, message: 'Photo de profil définie.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

// ============================================================================
// DELETE /api/students/photos?id=${studentId}
// Clears a student's profile photo and falls back to initials
// ============================================================================
export async function DELETE(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'students.update');

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('id');

    if (!studentId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Identifiant de l\'élève (id) requis.');
    }

    const [student] = await db
      .select({ id: user.id, photoUrl: user.photoUrl, branchId: user.branchId })
      .from(user)
      .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
      .limit(1);

    if (!student) {
      throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Élève introuvable pour cet établissement.');
    }

    assertBranchScope(context, student.branchId);

    const previousPhotoUrl = student.photoUrl;

    await db.update(user).set({ photoUrl: null }).where(and(eq(user.id, studentId), eq(user.tenantId, tenantId)));

    if (previousPhotoUrl) {
      await deleteUploadedFile(tenantId, previousPhotoUrl);
    }

    recordAudit(context, 'delete', 'student_photo', studentId, {
      previousPhotoUrl,
      action: 'remove_profile_photo',
    });

    return NextResponse.json({
      success: true,
      data: { studentId },
      message: 'Photo supprimée avec succès. L\'élève utilise désormais ses initiales.',
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
