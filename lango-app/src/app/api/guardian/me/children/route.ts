import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireParentContext } from '@/features/parent/api/guard';
import { resolveEffectiveChildren } from '@/features/parent/services/relationship-resolver';

// GET /api/guardian/me/children — the server-derived effective children list.
// This is the single source of truth for the child switcher and every
// relationship-scoped query is bounded by it. No client-chosen id is trusted.
export async function GET(request: Request) {
  try {
    const ctx = await requireParentContext(request);
    const tenantId = ctx.tenantId as string;
    const children = await resolveEffectiveChildren(tenantId, ctx.userId);
    return NextResponse.json({ success: true, data: children });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
