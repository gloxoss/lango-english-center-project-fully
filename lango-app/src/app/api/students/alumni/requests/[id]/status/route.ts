import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniDirectoryConsent, alumniDocuments, alumniMentorListings, alumniRequests } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const statusSchema = z.object({
  status: z.enum(['accepted', 'refused', 'preparing', 'ready', 'taken']),
  decisionNote: z.string().trim().max(2000).optional(),
}).strict();

// Pipeline transition guards — the only legal moves between columns.
const VALID_TRANSITIONS: Record<string, string[]> = {
  received: ['accepted', 'refused'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['taken'],
};

// 5-stage fulfillment pipeline (replaces the binary pending -> approved|rejected).
// - accepted/refused are the staff decision; type-specific effects fire here:
//   reissue -> supersede the related document; deletion -> real community-data
//   deletion only (directory consent + mentor listings), never core records.
// - preparing/ready/taken advance the deliverable to the alumnus.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { id: requestId } = await params;
    const body = await parseJson(req, statusSchema);

    const result = await db.transaction(async (tx) => {
      const [item] = await tx.select().from(alumniRequests).where(and(eq(alumniRequests.id, requestId), eq(alumniRequests.tenantId, tenantId))).limit(1);
      if (!item) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.');
      }

      const allowed = VALID_TRANSITIONS[item.status] ?? [];
      if (!allowed.includes(body.status)) {
        throw new ApiError(409, 'INVALID_TRANSITION', `Transition invalide depuis l'état « ${item.status} ».`);
      }

      if (body.status === 'accepted' && item.type === 'reissue' && item.relatedDocumentId) {
        await tx.update(alumniDocuments)
          .set({ status: 'superseded', supersededAt: new Date().toISOString() })
          .where(and(eq(alumniDocuments.id, item.relatedDocumentId), eq(alumniDocuments.tenantId, tenantId)));
      }

      if (body.status === 'accepted' && item.type === 'deletion') {
        await tx.delete(alumniDirectoryConsent).where(eq(alumniDirectoryConsent.alumnusId, item.alumnusId));
        await tx.delete(alumniMentorListings).where(eq(alumniMentorListings.alumnusId, item.alumnusId));
      }

      const isDecision = body.status === 'accepted' || body.status === 'refused';
      const [updated] = await tx.update(alumniRequests)
        .set({
          status: body.status,
          ...(isDecision ? { decidedBy: context.userId, decidedAt: new Date().toISOString(), decisionNote: body.decisionNote ?? null } : {}),
        })
        .where(eq(alumniRequests.id, requestId))
        .returning();

      return updated;
    });

    recordAudit(context, 'update', 'alumni_request_status', requestId, { status: body.status });

    return NextResponse.json({ success: true, data: result, message: 'Statut mis à jour avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
