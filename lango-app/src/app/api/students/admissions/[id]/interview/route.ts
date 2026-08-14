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
import { admissionInterviews, applicants, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const setInterviewSchema = z.object({
  scheduledAt: z.string().min(1),
  interviewerId: z.string().min(1).optional().nullable(),
  location: z.string().trim().max(255).optional().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
}).strict();

async function assertApplicantBelongsToTenant(tenantId: string, applicantId: string) {
  const [row] = await db.select({ id: applicants.id }).from(applicants)
    .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
    .limit(1);
  if (!row) {
    throw new ApiError(404, 'APPLICANT_NOT_FOUND', 'Candidat introuvable.');
  }
}

// One real interview per applicant, no notification (both discovery
// decisions) - future-implementation/dropped-features-rebuild.
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.view');

    const { id: applicantId } = await params;
    await assertApplicantBelongsToTenant(tenantId, applicantId);

    const [interview] = await db.select().from(admissionInterviews)
      .where(and(eq(admissionInterviews.applicantId, applicantId), eq(admissionInterviews.tenantId, tenantId)))
      .limit(1);

    return NextResponse.json({ success: true, data: interview ?? null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.manage');

    const { id: applicantId } = await params;
    const body = await parseJson(req, setInterviewSchema);
    await assertApplicantBelongsToTenant(tenantId, applicantId);

    if (body.interviewerId) {
      const [interviewer] = await db.select({ id: user.id }).from(user)
        .where(and(eq(user.id, body.interviewerId), eq(user.tenantId, tenantId)))
        .limit(1);
      if (!interviewer) {
        throw new ApiError(422, 'INVALID_REFERENCE', 'L\'interviewer indiqué n\'existe pas pour cet établissement.');
      }
    }

    const [existing] = await db.select({ id: admissionInterviews.id }).from(admissionInterviews)
      .where(and(eq(admissionInterviews.applicantId, applicantId), eq(admissionInterviews.tenantId, tenantId)))
      .limit(1);

    const values = {
      scheduledAt: body.scheduledAt,
      interviewerId: body.interviewerId,
      location: body.location,
      status: body.status,
      notes: body.notes,
    };

    const result = existing
      ? (await db.update(admissionInterviews).set(values).where(eq(admissionInterviews.id, existing.id)).returning())[0]
      : (await db.insert(admissionInterviews).values({ tenantId, applicantId, ...values }).returning())[0];

    recordAudit(ctx, existing ? 'update' : 'create', 'admission_interview', applicantId);

    return NextResponse.json({ success: true, data: result, message: 'Entretien enregistré avec succès' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
