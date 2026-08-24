import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, planLimitsUpdateSchema } from '@/libs/api/validation';
import { listPlanLimits, updatePlanLimit } from '@/features/subscriptions/services/plan-limits-service';

// GET /api/super-admin/plan-limits - per-plan capacity caps (max students,
// storage). These turn tenants.planTier into a real rule, not just a label.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);
    const data = await listPlanLimits();
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// PUT /api/super-admin/plan-limits - edit one tier's caps.
export async function PUT(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);
    const body = await parseJson(request, planLimitsUpdateSchema);
    const data = await updatePlanLimit(ctx, body);
    return NextResponse.json({ success: true, data, message: 'Limites du plan mises à jour.' });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
