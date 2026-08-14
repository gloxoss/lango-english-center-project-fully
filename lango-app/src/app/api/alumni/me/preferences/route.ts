import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson } from '@/libs/api/validation';
import { isEligibleForDirectoryAndMentoring } from '@/libs/services/alumni-safeguarding';
import { db } from '@/libs/DB';
import { alumniDirectoryConsent, user } from '@/models/Schema';

const updateConsentSchema = z.object({
  showName: z.boolean().optional(),
  showCohort: z.boolean().optional(),
  showCurrentEmployer: z.boolean().optional(),
  showContactInfo: z.boolean().optional(),
  currentEmployer: z.string().trim().max(255).optional(),
}).strict();

// Real, self-scoped, per-field directory consent (future-implementation
// /alumni-portal, discovery decision: "opt-in fields only").
export async function GET(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);

    const [row] = await db.select().from(alumniDirectoryConsent).where(and(eq(alumniDirectoryConsent.alumnusId, context.userId), eq(alumniDirectoryConsent.tenantId, tenantId))).limit(1);
    const [me] = await db.select({ dateOfBirth: user.dateOfBirth }).from(user).where(and(eq(user.id, context.userId), eq(user.tenantId, tenantId))).limit(1);

    return NextResponse.json({
      success: true,
      data: {
        showName: row?.showName ?? false,
        showCohort: row?.showCohort ?? false,
        showCurrentEmployer: row?.showCurrentEmployer ?? false,
        showContactInfo: row?.showContactInfo ?? false,
        currentEmployer: row?.currentEmployer ?? null,
        isEligible: isEligibleForDirectoryAndMentoring(me?.dateOfBirth),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(req: Request) {
  try {
    const context = await requireRequestContext(req, ['alumni']);
    const tenantId = requireTenant(context);
    const body = await parseJson(req, updateConsentSchema);

    const [row] = await db
      .insert(alumniDirectoryConsent)
      .values({ tenantId, alumnusId: context.userId, ...body })
      .onConflictDoUpdate({ target: alumniDirectoryConsent.alumnusId, set: { ...body, updatedAt: new Date().toISOString() } })
      .returning();

    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
