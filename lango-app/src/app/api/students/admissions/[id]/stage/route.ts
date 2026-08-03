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
import { applicants } from '@/models/Schema';

// Stage machine — valid transitions
const STAGE_MACHINE: Record<string, string[]> = {
  applied: ['in_review', 'rejected'],
  in_review: ['interview', 'rejected', 'waitlisted'],
  interview: ['approved', 'rejected', 'waitlisted'],
  approved: [], // terminal — use /convert to create student
  rejected: [], // terminal
  waitlisted: ['interview', 'rejected', 'approved'],
} as const;

const stageTransitionSchema = z.object({
  stage: z.enum(['applied', 'in_review', 'interview', 'approved', 'rejected', 'waitlisted']),
  reason: z.string().trim().max(1000).optional(),
}).strict().refine(
  data => !(data.stage === 'rejected') || (data.reason && data.reason.length >= 20),
  { message: 'Un motif de refus d\'au moins 20 caractères est requis.', path: ['reason'] },
);

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.manage');

    const { id } = await params;
    const body = await parseJson(req, stageTransitionSchema);

    const [applicant] = await db
      .select({ id: applicants.id, status: applicants.status, convertedUserId: applicants.convertedUserId })
      .from(applicants)
      .where(and(eq(applicants.id, id), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    // Check conversion lock — approved+converted is frozen
    if (applicant.convertedUserId) {
      throw new ApiError(409, 'ALREADY_CONVERTED', 'Cette demande a déjà été convertie en inscription élève.');
    }

    // Validate stage machine
    const allowedTransitions = STAGE_MACHINE[applicant.status] ?? [];
    if (!allowedTransitions.includes(body.stage)) {
      throw new ApiError(422, 'INVALID_STAGE_TRANSITION', `Transition invalide : ${applicant.status} → ${body.stage}. Transitions autorisées: ${allowedTransitions.join(', ') || 'aucune'}.`);
    }

    const [updated] = await db
      .update(applicants)
      .set({ status: body.stage })
      .where(and(eq(applicants.id, id), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(ctx, 'update', 'admission_stage', id, {
      from: applicant.status,
      to: body.stage,
      reason: body.reason,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Statut mis à jour : ${body.stage}`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
