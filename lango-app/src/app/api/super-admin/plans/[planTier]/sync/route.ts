import { NextResponse } from 'next/server';
import { requireRequestContext, requireSuperAdmin } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { syncPlanModulesToSchools } from '@/features/subscriptions/services/plan-limits-service';

type Params = { params: Promise<{ planTier: string }> };

// POST /api/super-admin/plans/:planTier/sync - Sync plan's included modules to all schools currently on this plan
export async function POST(request: Request, { params }: Params) {
  try {
    const ctx = await requireRequestContext(request);
    requireSuperAdmin(ctx);

    const { planTier } = await params;
    const result = await syncPlanModulesToSchools(ctx, planTier);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Synchronisation terminée : ${result.schoolsUpdated} établissement(s) mis à jour (${result.modulesGranted} attribution(s) de modules).`,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
