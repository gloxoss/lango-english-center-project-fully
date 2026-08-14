import { and, asc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { admissionComments, applicants, user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

const addCommentSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();

// Staff-only, append-only notes thread - never shown to the applicant/
// guardian (discovery decision) - future-implementation/dropped-features-rebuild.
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.view');

    const { id: applicantId } = await params;

    const comments = await db
      .select({
        id: admissionComments.id,
        body: admissionComments.body,
        createdAt: admissionComments.createdAt,
        authorId: admissionComments.authorId,
        authorName: user.name,
      })
      .from(admissionComments)
      .leftJoin(user, eq(admissionComments.authorId, user.id))
      .where(and(eq(admissionComments.applicantId, applicantId), eq(admissionComments.tenantId, tenantId)))
      .orderBy(asc(admissionComments.createdAt));

    return NextResponse.json({ success: true, data: comments });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'admissions.manage');

    const { id: applicantId } = await params;
    const body = await parseJson(req, addCommentSchema);

    const [applicant] = await db.select({ id: applicants.id }).from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);
    if (!applicant) {
      throw new ApiError(404, 'APPLICANT_NOT_FOUND', 'Candidat introuvable.');
    }

    const [inserted] = await db.insert(admissionComments).values({
      tenantId,
      applicantId,
      authorId: ctx.userId,
      body: body.body,
    }).returning();

    recordAudit(ctx, 'create', 'admission_comment', inserted!.id);

    return NextResponse.json({ success: true, data: inserted, message: 'Note ajoutée avec succès' }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
