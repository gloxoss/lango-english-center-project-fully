import { eq } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { planLimits } from '@/models/Schema';

export type PlanTier = 'trial' | 'basic' | 'standard' | 'premium';

export type PlanLimit = {
  planTier: PlanTier;
  label: string;
  maxStudents: number | null;
  maxStorageMb: number | null;
};

const TIER_ORDER: PlanTier[] = ['trial', 'basic', 'standard', 'premium'];

export async function listPlanLimits(): Promise<PlanLimit[]> {
  const rows = await db.select().from(planLimits);
  const byTier = new Map(rows.map(r => [r.planTier, r]));
  // Always return all four tiers in canonical order, even if a row is missing.
  return TIER_ORDER.map(tier => {
    const r = byTier.get(tier);
    return {
      planTier: tier,
      label: r?.label ?? tier,
      maxStudents: r?.maxStudents ?? null,
      maxStorageMb: r?.maxStorageMb ?? null,
    };
  });
}

export async function updatePlanLimit(
  ctx: RequestContext,
  patch: { planTier: PlanTier; label?: string; maxStudents?: number | null; maxStorageMb?: number | null },
): Promise<PlanLimit> {
  const [existing] = await db
    .select()
    .from(planLimits)
    .where(eq(planLimits.planTier, patch.planTier))
    .limit(1);

  const values = {
    planTier: patch.planTier,
    label: patch.label ?? existing?.label ?? patch.planTier,
    maxStudents: patch.maxStudents !== undefined ? patch.maxStudents : (existing?.maxStudents ?? null),
    maxStorageMb: patch.maxStorageMb !== undefined ? patch.maxStorageMb : (existing?.maxStorageMb ?? null),
    updatedAt: new Date().toISOString(),
  };

  const [row] = await db
    .insert(planLimits)
    .values(values)
    .onConflictDoUpdate({
      target: planLimits.planTier,
      set: {
        label: values.label,
        maxStudents: values.maxStudents,
        maxStorageMb: values.maxStorageMb,
        updatedAt: values.updatedAt,
      },
    })
    .returning();

  if (!row) {
    throw new ApiError(500, 'PLAN_LIMIT_SAVE_FAILED', 'Impossible d\'enregistrer les limites du plan.');
  }

  recordAudit(ctx, 'update', 'plan_limit', row.planTier, {
    label: row.label,
    maxStudents: row.maxStudents,
    maxStorageMb: row.maxStorageMb,
  });

  return {
    planTier: row.planTier,
    label: row.label,
    maxStudents: row.maxStudents,
    maxStorageMb: row.maxStorageMb,
  };
}
