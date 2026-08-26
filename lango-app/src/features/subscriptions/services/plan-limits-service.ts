import { and, eq, sql } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { planLimits, tenants, user } from '@/models/Schema';

export type PlanTier = 'trial' | 'basic' | 'standard' | 'premium';

export type PlanLimit = {
  planTier: PlanTier;
  label: string;
  maxStudents: number | null;
  maxStorageMb: number | null;
};

const TIER_ORDER: PlanTier[] = ['trial', 'basic', 'standard', 'premium'];

// Hard enforcement for the per-plan student cap (§1.3): blocks creating more
// students than the tenant's plan tier allows. No-op when the tier has no cap
// configured (null = unlimited) or the tenant is missing a plan-limit row, so
// existing tenants are never retroactively broken until a super-admin sets a cap.
export async function assertStudentCapacity(tenantId: string, additional: number): Promise<void> {
  const [tenant] = await db
    .select({ planTier: tenants.planTier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (!tenant) return;

  const [limit] = await db
    .select({ maxStudents: planLimits.maxStudents })
    .from(planLimits)
    .where(eq(planLimits.planTier, tenant.planTier))
    .limit(1);
  if (!limit || limit.maxStudents == null) return;

  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.userStatus, 'active')));
  const current = countRow?.n ?? 0;

  if (current + additional > limit.maxStudents) {
    throw new ApiError(
      403,
      'PLAN_STUDENT_LIMIT_REACHED',
      `Limite de ${limit.maxStudents} élèves atteinte pour votre plan (${current} actif(s)). Passez à un plan supérieur pour inscrire davantage d'élèves.`,
    );
  }
}

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
