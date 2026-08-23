import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile, saveUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

const DOC_TYPES = ['contract', 'cin', 'diploma'] as const;
type DocType = (typeof DOC_TYPES)[number];
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// Teacher compliance documents (Contrat / CIN / Diplôme). Each upload flips the
// matching flag on user.documents and records the file extension so GET can
// serve the bytes back. Mirrors /api/students/documents upload semantics.
export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type || !DOC_TYPES.includes(type as DocType)) {
      return NextResponse.json({ success: false, message: 'id et type (contract|cin|diploma) requis.' }, { status: 400 });
    }

    const [teacher] = await db
      .select({ documents: user.documents })
      .from(user)
      .where(and(eq(user.id, id), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .limit(1);
    if (!teacher) {
      throw new ApiError(404, 'NOT_FOUND', 'Enseignant introuvable.');
    }

    const docs = (teacher.documents ?? {}) as Record<string, unknown>;
    const ext = (docs[`${type}Ext`] as string) || 'pdf';
    try {
      const bytes = await readUploadedFile(tenantId, `teachers/${id}/${type}.${ext}`);
      return new NextResponse(new Uint8Array(bytes), {
        headers: { 'Content-Type': contentTypeFor(ext), 'Cache-Control': 'private, max-age=3600' },
      });
    } catch {
      return NextResponse.json({ success: false, message: 'Document non trouvé' }, { status: 404 });
    }
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireRequestContext(request, ['school_admin']);
    const tenantId = requireTenant(context);

    const formData = await request.formData();
    const teacherId = formData.get('teacherId');
    const type = formData.get('type');
    const file = formData.get('file');

    if (typeof teacherId !== 'string' || !teacherId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'teacherId requis.');
    }
    if (typeof type !== 'string' || !DOC_TYPES.includes(type as DocType)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'type (contract|cin|diploma) requis.');
    }
    if (!(file instanceof File)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Fichier requis.');
    }

    const [teacher] = await db
      .select({ documents: user.documents })
      .from(user)
      .where(and(eq(user.id, teacherId), eq(user.tenantId, tenantId), eq(user.role, 'teacher')))
      .limit(1);
    if (!teacher) {
      throw new ApiError(422, 'INVALID_REFERENCE', 'L\'enseignant indiqué n\'existe pas pour cet établissement.');
    }

    const ext = await saveUploadedFile(tenantId, `teachers/${teacherId}/${type}.{ext}`, file, ALLOWED_TYPES, MAX_SIZE_BYTES);

    const docs = (teacher.documents ?? {}) as Record<string, unknown>;
    await db
      .update(user)
      .set({
        documents: { ...docs, [type]: true, [`${type}Ext`]: ext },
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(user.id, teacherId), eq(user.tenantId, tenantId)));

    return NextResponse.json({ success: true, data: { teacherId, type, ext }, message: 'Document enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
