import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { parseJson, planUpdateSchema } from '@/libs/api/validation';
import { deletePlan, getPlan, updatePlan } from '@/features/subscriptions/services/plan-limits-service';

type Params = { params: Promise<{ planTier: string }> };

// GET /api/super-admin/plans/:planTier - Get one plan detail
export async function GET(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { planTier } = await params;
    const plan = await getPlan(planTier);
    if (!plan) {
      throw new ApiError(404, 'NOT_FOUND', `Formule "${planTier}" introuvable.`);
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// PUT /api/super-admin/plans/:planTier - Update plan configuration, included modules, and limits
export async function PUT(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { planTier } = await params;
    const body = await parseJson(request, planUpdateSchema);
    const updated = await updatePlan(ctx, planTier, body);

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Formule "${updated.label}" mise à jour avec succès.`,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// DELETE /api/super-admin/plans/:planTier - Delete a custom plan (blocked if schools assigned or system tier)
export async function DELETE(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { planTier } = await params;
    await deletePlan(ctx, planTier);

    return NextResponse.json({
      success: true,
      message: `Formule "${planTier}" supprimée avec succès.`,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
