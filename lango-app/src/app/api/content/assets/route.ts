import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { attachmentTypes, digitalAssets, digitalAssetTargets } from '@/features/attachments/models/attachments-schema';
import { AssetService } from '@/features/attachments/services/asset-service';
import { isAssetVisibleToUser } from '@/features/attachments/services/targeting-service';
import { recordAudit } from '@/libs/api/audit';
import { resolveStudentAudienceContext } from '@/libs/academics/audience-context';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { getTeacherClassSectionIds } from '@/libs/api/teacher-scope';
import { classSections, classSubjects, user } from '@/models/Schema';
import { db } from '@/libs/DB';

type TargetInput = { targetKind: 'school' | 'role' | 'class_offering' | 'class_section' | 'class_subject' | 'user'; targetRoleValue?: string; targetRefId?: string };

async function assertTeacherCanTarget(tenantId: string, teacherId: string, targets: TargetInput[]) {
  if (targets.length === 0) return;
  const mySectionIds = new Set(await getTeacherClassSectionIds(tenantId, teacherId));
  const mySections = mySectionIds.size > 0
    ? await db.select({ classId: classSections.classId }).from(classSections).where(inArray(classSections.id, Array.from(mySectionIds)))
    : [];
  const myClassIds = new Set(mySections.map(s => s.classId));
  const mySubjects = myClassIds.size > 0
    ? await db.select({ id: classSubjects.id, offeringId: classSubjects.offeringId }).from(classSubjects).where(inArray(classSubjects.classId, Array.from(myClassIds)))
    : [];
  const mySubjectIds = new Set(mySubjects.map(s => s.id));
  const myOfferingIds = new Set(mySubjects.map(s => s.offeringId).filter((id): id is string => id !== null));

  for (const t of targets) {
    if (t.targetKind === 'school' || t.targetKind === 'role') {
      throw new ApiError(403, 'FORBIDDEN', 'Seul un administrateur peut cibler toute l\'école ou un rôle entier.');
    }
    if (t.targetKind === 'class_section' && (!t.targetRefId || !mySectionIds.has(t.targetRefId))) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez cibler que vos propres classes.');
    }
    if (t.targetKind === 'class_subject' && (!t.targetRefId || !mySubjectIds.has(t.targetRefId))) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez cibler que vos propres matières.');
    }
    if (t.targetKind === 'class_offering' && (!t.targetRefId || !myOfferingIds.has(t.targetRefId))) {
      throw new ApiError(403, 'FORBIDDEN', 'Vous ne pouvez cibler que vos propres classes.');
    }
    if (t.targetKind === 'user' && t.targetRefId) {
      const [targetUser] = await db.select({ id: user.id }).from(user).where(and(eq(user.id, t.targetRefId), eq(user.tenantId, tenantId))).limit(1);
      if (!targetUser) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Élève introuvable dans cet établissement.');
      }
    }
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin', 'teacher']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'content.manage');

    const contentLength = Number(request.headers.get('content-length') || 0);
    const [maxCap] = await db.select({ maxSizeBytes: attachmentTypes.maxSizeBytes }).from(attachmentTypes).where(eq(attachmentTypes.tenantId, tenantId)).orderBy(desc(attachmentTypes.maxSizeBytes)).limit(1);
    if (maxCap && contentLength > maxCap.maxSizeBytes + 1024 * 1024) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Fichier trop volumineux.');
    }

    const formData = await request.formData();
    const title = String(formData.get('title') || '').trim();
    const description = formData.get('description') ? String(formData.get('description')) : undefined;
    const attachmentTypeId = String(formData.get('attachmentTypeId') || '');
    const language = formData.get('language') ? String(formData.get('language')) : undefined;
    const targets: TargetInput[] = JSON.parse(String(formData.get('targets') || '[]'));
    const file = formData.get('file');

    if (!title || !attachmentTypeId || !(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Titre, type et fichier sont requis.');
    }

    if (context.role === 'teacher') {
      await assertTeacherCanTarget(tenantId, context.userId, targets);
    }

    const result = await AssetService.createAsset({
      tenantId,
      title,
      description,
      attachmentTypeId,
      ownerId: context.userId,
      language,
      file,
    });

    if (result.outcome === 'rejected') {
      const reason = 'reason' in result ? result.reason : 'ingestResult' in result && result.ingestResult.outcome === 'rejected' ? result.ingestResult.reason : 'Échec du traitement.';
      return NextResponse.json({ success: false, error: { code: 'INGEST_REJECTED', message: reason } }, { status: 422 });
    }

    await AssetService.setTargets(tenantId, result.asset.id, targets);

    recordAudit(context, 'create', 'digital_asset', result.asset.id, { title });

    return NextResponse.json({ success: true, data: { ...result.asset, status: result.ingestResult.outcome === 'ready' ? 'ready' : result.asset.status } }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const isAdmin = context.role === 'school_admin' || context.role === 'super_admin';

    // Admin preview of a specific student's audience-filtered view - same
    // pattern already used by the homework route, useful both for support
    // ("what does this student see?") and for verification.
    const asStudentId = isAdmin ? searchParams.get('asStudentId') : null;

    if (isAdmin && !asStudentId) {
      const conditions = [eq(digitalAssets.tenantId, tenantId)];
      if (!includeArchived) conditions.push(ne(digitalAssets.status, 'archived'));
      const assets = await db.select().from(digitalAssets).where(and(...conditions)).orderBy(desc(digitalAssets.createdAt));
      return NextResponse.json({ success: true, data: search ? assets.filter(a => a.title.toLowerCase().includes(search.toLowerCase())) : assets });
    }

    if (context.role === 'teacher') {
      const owned = await db.select().from(digitalAssets).where(and(eq(digitalAssets.tenantId, tenantId), eq(digitalAssets.ownerId, context.userId))).orderBy(desc(digitalAssets.createdAt));
      const published = await db.select().from(digitalAssets).where(and(eq(digitalAssets.tenantId, tenantId), eq(digitalAssets.status, 'published'))).orderBy(desc(digitalAssets.createdAt));
      const merged = [...owned, ...published.filter(p => !owned.some(o => o.id === p.id))];
      return NextResponse.json({ success: true, data: search ? merged.filter(a => a.title.toLowerCase().includes(search.toLowerCase())) : merged });
    }

    // student / parent (or admin previewing via asStudentId): published only, audience-filtered
    const effectiveStudentId = asStudentId ?? context.userId;
    const audience = await resolveStudentAudienceContext(effectiveStudentId);
    const published = await db.select().from(digitalAssets).where(and(eq(digitalAssets.tenantId, tenantId), eq(digitalAssets.status, 'published'))).orderBy(desc(digitalAssets.createdAt));
    if (published.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }
    const types = await db.select().from(attachmentTypes).where(inArray(attachmentTypes.id, published.map(p => p.attachmentTypeId)));
    const typeById = new Map(types.map(t => [t.id, t]));
    const targets = await db.select().from(digitalAssetTargets).where(inArray(digitalAssetTargets.assetId, published.map(p => p.id)));
    const targetsByAsset = new Map<string, typeof targets>();
    for (const t of targets) {
      const list = targetsByAsset.get(t.assetId) ?? [];
      list.push(t);
      targetsByAsset.set(t.assetId, list);
    }
    const viewer = { userId: effectiveStudentId, role: 'student', sectionId: audience.sectionId, offeringIds: audience.offeringIds, classSubjectIds: audience.classSubjectIds };
    const visible = published.filter((a) => {
      const type = typeById.get(a.attachmentTypeId);
      return isAssetVisibleToUser(targetsByAsset.get(a.id) ?? [], type?.studentVisible ?? true, viewer);
    });

    return NextResponse.json({ success: true, data: search ? visible.filter(a => a.title.toLowerCase().includes(search.toLowerCase())) : visible });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
