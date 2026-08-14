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

type RouteParams = { params: Promise<{ id: string }> };

const updateChecklistSchema = z.object({
  checklistDocumentsReceived: z.boolean().optional(),
  checklistInterviewDone: z.boolean().optional(),
  checklistFileComplete: z.boolean().optional(),
}).strict().refine(data => Object.keys(data).length > 0, { message: 'Au moins un champ doit être fourni.' });

// Fixed 3-item checklist (discovery decision), deliberately NOT gated by the
// applicant's decision status - unlike the main admissions PATCH, a checklist
// should stay editable regardless (future-implementation/dropped-features-rebuild).
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.manage');

    const { id: applicantId } = await params;
    const body = await parseJson(req, updateChecklistSchema);

    const [updated] = await db.update(applicants)
      .set(body)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .returning();

    if (!updated) {
      throw new ApiError(404, 'APPLICANT_NOT_FOUND', 'Candidat introuvable.');
    }

    recordAudit(ctx, 'update', 'admission_checklist', applicantId, body);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
