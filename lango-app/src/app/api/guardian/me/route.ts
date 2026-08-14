import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireParentContext } from '@/features/parent/api/guard';
import { resolveEffectiveChildren, resolveGuardianIdentity } from '@/features/parent/services/relationship-resolver';

// GET /api/guardian/me — the authenticated parent's household identity plus the
// server-derived effective children list. Redacted projection: no guardian
// contact fields other than the actor's own; no child data beyond what the
// effective relationship grants.
export async function GET(request: Request) {
  try {
    const ctx = await requireParentContext(request);
    const tenantId = ctx.tenantId as string;

    const identity = await resolveGuardianIdentity(tenantId, ctx.userId);
    const children = identity ? await resolveEffectiveChildren(tenantId, ctx.userId) : [];

    return NextResponse.json({
      success: true,
      data: {
        userId: ctx.userId,
        name: ctx.name,
        email: ctx.email,
        tenantId,
        guardianId: identity?.guardianId ?? null,
        linked: Boolean(identity),
        children,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
