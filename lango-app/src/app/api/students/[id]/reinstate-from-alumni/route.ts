import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

type RouteParams = { params: Promise<{ id: string }> };

// Re-admission edge case (future-implementation/alumni-portal, discovery
// decision): role flips back to student, alumni-only access is naturally
// suspended by role everywhere else, no separate suspension flag needed.
// Alumni history (documents, directory consent, mentor listing) is left
// untouched - only role and the transition markers are reversed.
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const context = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const { id: alumnusId } = await params;

    const [updated] = await db
      .update(user)
      .set({ role: 'student', alumniTransitionedAt: null, alumniTransitionedBy: null })
      .where(and(eq(user.id, alumnusId), eq(user.tenantId, tenantId), eq(user.role, 'alumni')))
      .returning({ id: user.id });

    if (!updated) {
      throw new ApiError(409, 'NOT_ALUMNI', 'Cet utilisateur n\'est pas un(e) ancien(ne) élève pour cet établissement.');
    }

    recordAudit(context, 'update', 'student_alumni_reinstate', alumnusId);

    return NextResponse.json({ success: true, message: 'Ancien(ne) élève réintégré(e) comme élève avec succès.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
