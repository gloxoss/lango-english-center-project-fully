import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireRequestContext } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { contentTypeFor, readUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { alumniDocuments } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

// Real, self-scoped, active-only download - never another alumnus's document,
// never a superseded one (future-implementation/alumni-portal).
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const { id: documentId } = await params;

    const [doc] = await db
      .select()
      .from(alumniDocuments)
      .where(and(eq(alumniDocuments.id, documentId), eq(alumniDocuments.alumnusId, context.userId), eq(alumniDocuments.status, 'active')))
      .limit(1);

    if (!doc) {
      throw new ApiError(404, 'NOT_FOUND', 'Document introuvable.');
    }

    const bytes = await readUploadedFile(doc.tenantId, `alumni-documents/${doc.alumnusId}/${doc.id}.${doc.fileExt}`);

    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': contentTypeFor(doc.fileExt), 'Cache-Control': 'private, max-age=3600' },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
