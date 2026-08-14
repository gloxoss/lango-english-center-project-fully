import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse, ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { recordAudit } from '@/libs/api/audit';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { certificateDefinitions, certificateRequests } from '@/features/certificates/models/certificates-schema';

const patchSchema = z.object({
  action: z.enum(['submit', 'review', 'approve', 'reject', 'request_changes', 'cancel']),
  reason: z.string().trim().max(2000).optional().default(''),
}).strict();

// Allowed transitions for the request state machine. Each maps to the
// resulting status; the four-eyes guard applies to approval-side actions.
const TRANSITIONS: Record<string, string[]> = {
  draft: ['submit', 'cancel'],
  submitted: ['review', 'cancel'],
  under_review: ['approve', 'reject', 'request_changes', 'cancel'],
  changes_requested: ['review', 'cancel'],
  approved: ['cancel'],
  issued: [],
  rejected: [],
  cancelled: [],
};

const NEXT_STATUS = {
  submit: 'submitted',
  review: 'under_review',
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
  cancel: 'cancelled',
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');
    await requireCapability(context, 'certificates.issue');

    const [row] = await db.select({
      request: certificateRequests,
      definitionTitle: certificateDefinitions.title,
      requesterName: user.name,
    })
      .from(certificateRequests)
      .innerJoin(certificateDefinitions, and(
        eq(certificateDefinitions.id, certificateRequests.definitionId),
        eq(certificateDefinitions.tenantId, tenantId),
      ))
      .leftJoin(user, eq(user.id, certificateRequests.requesterId))
      .where(and(
        eq(certificateRequests.tenantId, tenantId),
        eq(certificateRequests.id, id),
      ))
      .limit(1);

    if (!row) {
      throw new ApiError(404, 'NOT_FOUND', 'Demande de certificat introuvable pour cet établissement.');
    }

    return NextResponse.json({ success: true, data: { ...row.request, definitionTitle: row.definitionTitle, requesterName: row.requesterName } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await requireRequestContext(request, ['school_admin', 'teacher', 'receptionist']);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'certificate-management');

    const body = await parseJson(request, patchSchema);

    const [existing] = await db.select().from(certificateRequests)
      .where(and(eq(certificateRequests.tenantId, tenantId), eq(certificateRequests.id, id)))
      .limit(1);
    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Demande de certificat introuvable pour cet établissement.');
    }

    // Approval-side actions need the approver capability; the rest need issue.
    if (['approve', 'reject', 'request_changes'].includes(body.action)) {
      await requireCapability(context, 'certificates.approve');
    } else {
      await requireCapability(context, 'certificates.issue');
    }

    const allowed = TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(body.action)) {
      throw new ApiError(400, 'INVALID_TRANSITION',
        `Transition invalide: "${body.action}" depuis le statut "${existing.status}".`);
    }

    // Four-eyes: the requester can never be the final approver/rejecter.
    if (['approve', 'reject'].includes(body.action) && existing.requesterId === context.userId) {
      throw new ApiError(400, 'FOUR_EYES_VIOLATION',
        'Le demandeur ne peut pas approuver sa propre demande (règle des quatre yeux).');
    }

    // Rejection / change request requires an explicit reason.
    if (['reject', 'request_changes'].includes(body.action) && !body.reason) {
      throw new ApiError(400, 'REASON_REQUIRED', 'Un motif est requis pour rejeter ou demander des modifications.');
    }

    const nextStatus = NEXT_STATUS[body.action];

    const [updated] = await db.update(certificateRequests)
      .set({ status: nextStatus, updatedAt: new Date().toISOString() })
      .where(and(eq(certificateRequests.tenantId, tenantId), eq(certificateRequests.id, id)))
      .returning();

    recordAudit(context, 'update', 'certificate_request', id, { action: body.action, reason: body.reason });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Demande ${NEXT_STATUS[body.action]}.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
