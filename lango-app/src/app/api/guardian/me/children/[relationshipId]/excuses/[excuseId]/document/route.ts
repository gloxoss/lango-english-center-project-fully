import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { attendanceExcuses } from '@/models/Schema';
import { requireParentContext } from '@/features/parent/api/guard';
import { requireRelationship } from '@/features/parent/services/relationship-resolver';

type RouteParams = { params: Promise<{ relationshipId: string; excuseId: string }> };
const ALLOWED_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

async function requireOwnedExcuse(request: Request, params: RouteParams['params']) {
  const ctx = await requireParentContext(request);
  const { relationshipId, excuseId } = await params;
  const relationship = await requireRelationship(ctx, relationshipId, { attendance: true });
  const [excuse] = await db
    .select({ id: attendanceExcuses.id, documentFileExt: attendanceExcuses.documentFileExt })
    .from(attendanceExcuses)
    .where(and(
      eq(attendanceExcuses.id, excuseId),
      eq(attendanceExcuses.tenantId, ctx.tenantId as string),
      eq(attendanceExcuses.studentId, relationship.studentId),
    ))
    .limit(1);
  if (!excuse) throw new ApiError(404, 'NOT_FOUND', 'Justification introuvable.');
  return { ctx, excuse, excuseId };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { ctx, excuse, excuseId } = await requireOwnedExcuse(request, params);
    if (!excuse.documentFileExt) throw new ApiError(404, 'NOT_FOUND', 'Document introuvable.');
    const bytes = await readUploadedFile(ctx.tenantId as string, `excuses/${excuseId}.${excuse.documentFileExt}`);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': contentTypeFor(excuse.documentFileExt),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { ctx, excuseId } = await requireOwnedExcuse(request, params);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    const tenantId = ctx.tenantId as string;
    const ext = await saveUploadedFile(tenantId, `excuses/${excuseId}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);
    const documentUrl = `/api/guardian/me/children/${(await params).relationshipId}/excuses/${excuseId}/document`;
    await db.update(attendanceExcuses)
      .set({ documentUrl, documentFileExt: ext, updatedAt: new Date().toISOString() })
      .where(and(eq(attendanceExcuses.id, excuseId), eq(attendanceExcuses.tenantId, tenantId)));
    return NextResponse.json({ success: true, data: { documentUrl, documentFileExt: ext } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
