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

const decideSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decisionNote: z.string().trim().max(2000).optional(),
}).strict();

// Real, type-specific decision effects (future-implementation/alumni-portal):
// - correction: review recorded, the actual field edit is a separate real
//   staff action elsewhere (no auto-apply of arbitrary free-text corrections).
// - reissue: on approval, supersede the related document - the new file
//   itself is a separate, already-real staff action (task 04-01's endpoint).
// - data_access: on approval, no data mutation - authorizes staff to
//   manually compile and send the alumnus their data (a real human process).
// - deletion: on approval, real community-data deletion ONLY - never
//   alumniDocuments or core user/academic fields.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { id: requestId } = await params;
    const body = await parseJson(req, decideSchema);

    const result = await db.transaction(async (tx) => {
      const [item] = await tx.select().from(alumniRequests).where(and(eq(alumniRequests.id, requestId), eq(alumniRequests.tenantId, tenantId))).limit(1);
      if (!item) {
        throw new ApiError(404, 'NOT_FOUND', 'Demande introuvable.');
      }
      if (item.status !== 'pending') {
        throw new ApiError(409, 'ALREADY_DECIDED', 'Cette demande a déjà été traitée.');
      }

      if (body.decision === 'approved' && item.type === 'reissue' && item.relatedDocumentId) {
        await tx.update(alumniDocuments)
          .set({ status: 'superseded', supersededAt: new Date().toISOString() })
          .where(and(eq(alumniDocuments.id, item.relatedDocumentId), eq(alumniDocuments.tenantId, tenantId)));
      }

      if (body.decision === 'approved' && item.type === 'deletion') {
        await tx.delete(alumniDirectoryConsent).where(eq(alumniDirectoryConsent.alumnusId, item.alumnusId));
        await tx.delete(alumniMentorListings).where(eq(alumniMentorListings.alumnusId, item.alumnusId));
      }

      const [updated] = await tx.update(alumniRequests)
        .set({ status: body.decision, decidedBy: context.userId, decidedAt: new Date().toISOString(), decisionNote: body.decisionNote })
        .where(eq(alumniRequests.id, requestId))
        .returning();

      return updated;
    });

    recordAudit(context, 'update', 'alumni_request_decision', requestId, { decision: body.decision });

    return NextResponse.json({ success: true, data: result, message: 'Décision enregistrée avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
