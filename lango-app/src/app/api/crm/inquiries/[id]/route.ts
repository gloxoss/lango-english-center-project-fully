import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { inquiries } from '@/models/Schema';

const patchSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).optional(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional(),
  convertedApplicantId: z.string().uuid().optional(),
}).strict();

// PATCH /api/crm/inquiries/[id]
// Update status, assignedToId, notes. 'converted' requires convertedApplicantId.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRequestContext(request);
    await requireCapability(ctx, 'crm.manage');
    const tenantId = requireTenant(ctx);
    const { id } = await params;
    const body = await parseJson(request, patchSchema);

    if (body.status === 'converted' && !body.convertedApplicantId) {
      throw new ApiError(422, 'MISSING_APPLICANT', 'convertedApplicantId requis pour marquer comme converti.');
    }

    const [existing] = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'NOT_FOUND', 'Prospect introuvable.');
    }

    const [updated] = await db
      .update(inquiries)
      .set({
        ...(body.status !== undefined && { status: body.status }),
        ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.convertedApplicantId !== undefined && { convertedApplicantId: body.convertedApplicantId }),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(inquiries.id, id), eq(inquiries.tenantId, tenantId)))
      .returning();

    recordAudit(ctx, 'update', 'inquiry', id, { status: body.status });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
