import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { parseJson, planCreateSchema } from '@/libs/api/validation';
import { createPlan, listAllPlans } from '@/features/subscriptions/services/plan-limits-service';
import { listAddonDefinitions } from '@/libs/api/addon-catalog';

// GET /api/super-admin/plans - Returns all subscription plans with pricing,
// quotas, module list and active school counts, plus the complete catalog of addons.
export async function GET(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const [plans, catalog] = await Promise.all([
      listAllPlans(),
      listAddonDefinitions(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        plans,
        catalog: catalog.map(addon => ({
          addonId: addon.id,
          name: addon.name,
          description: addon.description,
          built: addon.enabled,
          requires: addon.requires ?? [],
        })),
      },
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}

// POST /api/super-admin/plans - Creates a new subscription plan.
export async function POST(request: Request) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const body = await parseJson(request, planCreateSchema);
    const plan = await createPlan(ctx, body);

    return NextResponse.json({
      success: true,
      data: plan,
      message: `Formule d'abonnement "${plan.label}" créée avec succès.`,
    }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
