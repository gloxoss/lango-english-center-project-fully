import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { isEligibleForDirectoryAndMentoring } from '@/libs/services/alumni-safeguarding';
import { db } from '@/libs/DB';
import { alumniMentorListings, user } from '@/models/Schema';

const updateListingSchema = z.object({
  isActive: z.boolean(),
  offering: z.string().trim().min(1).max(2000),
  contactPreference: z.string().trim().max(50).optional(),
}).strict();

// Real, self-scoped mentor listing (future-implementation/alumni-portal) -
// no automated matching, just a real opt-in list. Safeguarding enforced at
// write time here, and again at read time in the browse route (defense in
// depth for a real child-safety property).
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const [row] = await db.select().from(alumniMentorListings).where(and(eq(alumniMentorListings.alumnusId, context.userId), eq(alumniMentorListings.tenantId, tenantId))).limit(1);
    return NextResponse.json({ success: true, data: row ?? null });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const body = await parseJson(req, updateListingSchema);

    if (body.isActive) {
      const [me] = await db.select({ dateOfBirth: user.dateOfBirth }).from(user).where(eq(user.id, context.userId)).limit(1);
      if (!isEligibleForDirectoryAndMentoring(me?.dateOfBirth)) {
        throw new ApiError(403, 'NOT_ELIGIBLE', 'Le mentorat est réservé aux anciens élèves de 18 ans et plus.');
      }
    }

    const [row] = await db
      .insert(alumniMentorListings)
      .values({ tenantId, alumnusId: context.userId, ...body })
      .onConflictDoUpdate({ target: alumniMentorListings.alumnusId, set: { ...body, updatedAt: new Date().toISOString() } })
      .returning();

    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
