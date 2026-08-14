import { and, desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniDocuments, alumniRequests } from '@/models/Schema';

const createRequestSchema = z.object({
  type: z.enum(['correction', 'reissue', 'data_access', 'deletion']),
  note: z.string().trim().min(1).max(2000),
  relatedDocumentId: z.string().uuid().optional(),
}).strict();

// Real, self-scoped request creation + listing (future-implementation
// /alumni-portal) - alumni never self-edit official records, every request
// goes through real staff review.
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const rows = await db.select().from(alumniRequests).where(and(eq(alumniRequests.alumnusId, context.userId), eq(alumniRequests.tenantId, tenantId))).orderBy(desc(alumniRequests.createdAt));
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const body = await parseJson(req, createRequestSchema);

    if (body.relatedDocumentId) {
      const [doc] = await db.select({ id: alumniDocuments.id }).from(alumniDocuments)
        .where(and(eq(alumniDocuments.id, body.relatedDocumentId), eq(alumniDocuments.alumnusId, context.userId)))
        .limit(1);
      if (!doc) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'Ce document ne vous appartient pas.');
      }
    }

    const [inserted] = await db.insert(alumniRequests).values({ tenantId, alumnusId: context.userId, ...body }).returning();
    recordAudit(context, 'create', 'alumni_request', inserted!.id, { type: body.type });

    return NextResponse.json({ success: true, data: inserted, message: 'Demande envoyée avec succès' }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
