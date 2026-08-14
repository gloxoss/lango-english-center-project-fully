import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { alumniDirectoryConsent, sessionYears, user } from '@/models/Schema';

const updateProfileSchema = z.object({
  email: z.string().email().max(255).optional(),
  phone: z.string().trim().max(50).optional(),
}).strict().refine(data => Object.keys(data).length > 0, { message: 'Au moins un champ doit être fourni.' });

// Real, self-scoped alumni profile - never another alumnus's, no ID param
// by construction (future-implementation/alumni-portal).
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);

    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photoUrl: user.photoUrl,
        graduationCohortSessionYearId: user.graduationCohortSessionYearId,
        alumniTransitionedAt: user.alumniTransitionedAt,
        cohortName: sessionYears.name,
      })
      .from(user)
      .leftJoin(sessionYears, eq(user.graduationCohortSessionYearId, sessionYears.id))
      .where(and(eq(user.id, context.userId), eq(user.tenantId, tenantId)))
      .limit(1);

    const [consent] = await db.select({ currentEmployer: alumniDirectoryConsent.currentEmployer }).from(alumniDirectoryConsent).where(and(eq(alumniDirectoryConsent.alumnusId, context.userId), eq(alumniDirectoryConsent.tenantId, tenantId))).limit(1);

    // Real completeness: photo, phone, current employer - fixed, honest checklist.
    const checks = [!!row?.photoUrl, !!row?.phone, !!consent?.currentEmployer];
    const profileCompleteness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return NextResponse.json({ success: true, data: { ...row, profileCompleteness } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const body = await parseJson(req, updateProfileSchema);

    const [updated] = await db.update(user).set(body).where(and(eq(user.id, context.userId), eq(user.tenantId, tenantId))).returning({ id: user.id, email: user.email, phone: user.phone });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
