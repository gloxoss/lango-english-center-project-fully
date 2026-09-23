import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { recordAudit } from '@/libs/api/audit';
import type { RequestContext } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { addonDefinitions, addonEntitlements, planLimits, tenants, user } from '@/models/Schema';

export type PlanTier = string;

export type PlanLimit = {
  planTier: string;
  label: string;
  maxStudents: number | null;
  maxStorageMb: number | null;
};

export type PlanRecord = {
  planTier: string;
  label: string;
  description: string | null;
  maxStudents: number | null;
  maxStorageMb: number | null;
  maxBranches: number;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  isTrial: boolean;
  includedAddons: string[];
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  schoolCount: number;
  createdAt: string;
  updatedAt: string;
};

export type PlanCreateInput = {
  planTier: string;
  label: string;
  description?: string | null;
  maxStudents?: number | null;
  maxStorageMb?: number | null;
  maxBranches?: number;
  priceMonthly?: number;
  priceYearly?: number;
  currency?: string;
  trialDays?: number;
  isTrial?: boolean;
  includedAddons?: string[];
  features?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
};

export type PlanUpdateInput = Partial<Omit<PlanCreateInput, 'planTier'>> & {
  syncToExistingSchools?: boolean;
};

const SYSTEM_DEFAULT_TIERS = ['trial', 'basic', 'standard', 'premium'];

// Hard enforcement for the per-plan student cap: blocks creating more
// students than the tenant's plan tier allows. No-op when the tier has no cap
// configured (null = unlimited) or the tenant is missing a plan-limit row.
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
      `Limite de ${limit.maxStudents} élèves atteinte pour votre formule (${current} actif(s)). Contactez l'administrateur pour passer à une formule supérieure.`,
    );
  }
}

export async function listAllPlans(): Promise<PlanRecord[]> {
  const [rows, schoolCounts] = await Promise.all([
    db.select().from(planLimits).orderBy(asc(planLimits.sortOrder), asc(planLimits.createdAt)),
    db
      .select({ planTier: tenants.planTier, count: sql<number>`count(*)::int` })
      .from(tenants)
      .groupBy(tenants.planTier),
  ]);

  const countByTier = new Map(schoolCounts.map(c => [c.planTier, c.count]));

  return rows.map(r => ({
    planTier: r.planTier,
    label: r.label,
    description: r.description,
    maxStudents: r.maxStudents,
    maxStorageMb: r.maxStorageMb,
    maxBranches: r.maxBranches,
    priceMonthly: Number(r.priceMonthly ?? 0),
    priceYearly: Number(r.priceYearly ?? 0),
    currency: r.currency,
    trialDays: r.trialDays,
    isTrial: r.isTrial,
    includedAddons: r.includedAddons ?? [],
    features: r.features ?? [],
    isActive: r.isActive,
    isPopular: r.isPopular,
    sortOrder: r.sortOrder,
    schoolCount: countByTier.get(r.planTier) ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getPlan(planTier: string): Promise<PlanRecord | null> {
  const [r] = await db
    .select()
    .from(planLimits)
    .where(eq(planLimits.planTier, planTier))
    .limit(1);
  if (!r) return null;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenants)
    .where(eq(tenants.planTier, planTier));

  return {
    planTier: r.planTier,
    label: r.label,
    description: r.description,
    maxStudents: r.maxStudents,
    maxStorageMb: r.maxStorageMb,
    maxBranches: r.maxBranches,
    priceMonthly: Number(r.priceMonthly ?? 0),
    priceYearly: Number(r.priceYearly ?? 0),
    currency: r.currency,
    trialDays: r.trialDays,
    isTrial: r.isTrial,
    includedAddons: r.includedAddons ?? [],
    features: r.features ?? [],
    isActive: r.isActive,
    isPopular: r.isPopular,
    sortOrder: r.sortOrder,
    schoolCount: countRow?.count ?? 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function createPlan(ctx: RequestContext, input: PlanCreateInput): Promise<PlanRecord> {
  const [existing] = await db
    .select({ planTier: planLimits.planTier })
    .from(planLimits)
    .where(eq(planLimits.planTier, input.planTier))
    .limit(1);

  if (existing) {
    throw new ApiError(409, 'ALREADY_EXISTS', `Une formule avec le code "${input.planTier}" existe déjà.`);
  }

  const [nextSort] = await db
    .select({ max: sql<number>`coalesce(max(${planLimits.sortOrder}), -1)::int` })
    .from(planLimits);

  const now = new Date().toISOString();
  const [created] = await db
    .insert(planLimits)
    .values({
      planTier: input.planTier,
      label: input.label,
      description: input.description ?? null,
      maxStudents: input.maxStudents ?? null,
      maxStorageMb: input.maxStorageMb ?? null,
      maxBranches: input.maxBranches ?? 1,
      priceMonthly: String(input.priceMonthly ?? 0),
      priceYearly: String(input.priceYearly ?? 0),
      currency: input.currency ?? 'MAD',
      trialDays: input.trialDays ?? (input.isTrial ? 14 : 0),
      isTrial: input.isTrial ?? false,
      includedAddons: input.includedAddons ?? [],
      features: input.features ?? [],
      isActive: input.isActive ?? true,
      isPopular: input.isPopular ?? false,
      sortOrder: input.sortOrder ?? (nextSort?.max ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  recordAudit(ctx, 'create', 'subscription_plan', created!.planTier, {
    label: created!.label,
    priceMonthly: created!.priceMonthly,
    includedAddons: created!.includedAddons,
  });

  return {
    planTier: created!.planTier,
    label: created!.label,
    description: created!.description,
    maxStudents: created!.maxStudents,
    maxStorageMb: created!.maxStorageMb,
    maxBranches: created!.maxBranches,
    priceMonthly: Number(created!.priceMonthly),
    priceYearly: Number(created!.priceYearly),
    currency: created!.currency,
    trialDays: created!.trialDays,
    isTrial: created!.isTrial,
    includedAddons: created!.includedAddons,
    features: created!.features,
    isActive: created!.isActive,
    isPopular: created!.isPopular,
    sortOrder: created!.sortOrder,
    schoolCount: 0,
    createdAt: created!.createdAt,
    updatedAt: created!.updatedAt,
  };
}

export async function updatePlan(
  ctx: RequestContext,
  planTier: string,
  patch: PlanUpdateInput,
): Promise<PlanRecord> {
  const [existing] = await db
    .select()
    .from(planLimits)
    .where(eq(planLimits.planTier, planTier))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', `La formule "${planTier}" est introuvable.`);
  }

  const now = new Date().toISOString();
  const updateData: Partial<typeof planLimits.$inferInsert> = {
    updatedAt: now,
  };

  if (patch.label !== undefined) updateData.label = patch.label;
  if (patch.description !== undefined) updateData.description = patch.description;
  if (patch.maxStudents !== undefined) updateData.maxStudents = patch.maxStudents;
  if (patch.maxStorageMb !== undefined) updateData.maxStorageMb = patch.maxStorageMb;
  if (patch.maxBranches !== undefined) updateData.maxBranches = patch.maxBranches;
  if (patch.priceMonthly !== undefined) updateData.priceMonthly = String(patch.priceMonthly);
  if (patch.priceYearly !== undefined) updateData.priceYearly = String(patch.priceYearly);
  if (patch.currency !== undefined) updateData.currency = patch.currency;
  if (patch.trialDays !== undefined) updateData.trialDays = patch.trialDays;
  if (patch.isTrial !== undefined) updateData.isTrial = patch.isTrial;
  if (patch.includedAddons !== undefined) updateData.includedAddons = patch.includedAddons;
  if (patch.features !== undefined) updateData.features = patch.features;
  if (patch.isActive !== undefined) updateData.isActive = patch.isActive;
  if (patch.isPopular !== undefined) updateData.isPopular = patch.isPopular;
  if (patch.sortOrder !== undefined) updateData.sortOrder = patch.sortOrder;

  const [updated] = await db
    .update(planLimits)
    .set(updateData)
    .where(eq(planLimits.planTier, planTier))
    .returning();

  recordAudit(ctx, 'update', 'subscription_plan', planTier, {
    label: updated!.label,
    priceMonthly: updated!.priceMonthly,
    includedAddons: updated!.includedAddons,
  });

  if (patch.syncToExistingSchools && patch.includedAddons) {
    await syncPlanModulesToSchools(ctx, planTier, patch.includedAddons);
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenants)
    .where(eq(tenants.planTier, planTier));

  return {
    planTier: updated!.planTier,
    label: updated!.label,
    description: updated!.description,
    maxStudents: updated!.maxStudents,
    maxStorageMb: updated!.maxStorageMb,
    maxBranches: updated!.maxBranches,
    priceMonthly: Number(updated!.priceMonthly),
    priceYearly: Number(updated!.priceYearly),
    currency: updated!.currency,
    trialDays: updated!.trialDays,
    isTrial: updated!.isTrial,
    includedAddons: updated!.includedAddons,
    features: updated!.features,
    isActive: updated!.isActive,
    isPopular: updated!.isPopular,
    sortOrder: updated!.sortOrder,
    schoolCount: countRow?.count ?? 0,
    createdAt: updated!.createdAt,
    updatedAt: updated!.updatedAt,
  };
}

export async function deletePlan(ctx: RequestContext, planTier: string): Promise<void> {
  if (SYSTEM_DEFAULT_TIERS.includes(planTier)) {
    throw new ApiError(400, 'CANNOT_DELETE_SYSTEM_PLAN', 'Les formules système par défaut (trial, basic, standard, premium) ne peuvent pas être supprimées.');
  }

  const [schoolCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenants)
    .where(eq(tenants.planTier, planTier));

  if ((schoolCount?.count ?? 0) > 0) {
    throw new ApiError(
      400,
      'PLAN_IN_USE',
      `Impossible de supprimer cette formule car ${schoolCount!.count} établissement(s) y sont actuellement rattachés. Réassignez-les d'abord à un autre plan.`,
    );
  }

  await db.delete(planLimits).where(eq(planLimits.planTier, planTier));
  recordAudit(ctx, 'delete', 'subscription_plan', planTier, { planTier });
}

/**
 * Propagates a plan's included addons to all schools that currently have tenants.planTier = planTier.
 * Adds missing addon entitlements without revoking custom grants already given to specific schools.
 */
export async function syncPlanModulesToSchools(
  ctx: RequestContext,
  planTier: string,
  targetAddons?: string[],
): Promise<{ schoolsUpdated: number; modulesGranted: number }> {
  const plan = await getPlan(planTier);
  if (!plan) {
    throw new ApiError(404, 'NOT_FOUND', `Plan "${planTier}" introuvable.`);
  }

  const addonsToGrant = targetAddons ?? plan.includedAddons;
  if (addonsToGrant.length === 0) {
    return { schoolsUpdated: 0, modulesGranted: 0 };
  }

  const targetTenants = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.planTier, planTier));

  if (targetTenants.length === 0) {
    return { schoolsUpdated: 0, modulesGranted: 0 };
  }

  let totalGranted = 0;

  for (const tenant of targetTenants) {
    const existing = await db
      .select({ addonId: addonEntitlements.addonId })
      .from(addonEntitlements)
      .where(eq(addonEntitlements.tenantId, tenant.id));

    const existingSet = new Set(existing.map(e => e.addonId));
    const missing = addonsToGrant.filter(a => !existingSet.has(a));

    if (missing.length > 0) {
      await db.insert(addonEntitlements).values(
        missing.map(addonId => ({
          tenantId: tenant.id,
          addonId,
          isEnabled: true,
          grantedById: ctx.userId,
          note: `Synchronisation automatique avec la formule "${plan.label}"`,
        })),
      );
      totalGranted += missing.length;
    }
  }

  recordAudit(ctx, 'entitlement_change', 'plan_modules', planTier, {
    schoolsCount: targetTenants.length,
    modulesGranted: totalGranted,
    addons: addonsToGrant,
  });

  return {
    schoolsUpdated: targetTenants.length,
    modulesGranted: totalGranted,
  };
}

// Backward compatibility methods for existing callers
export async function listPlanLimits(): Promise<PlanLimit[]> {
  const rows = await db.select().from(planLimits).orderBy(asc(planLimits.sortOrder));
  return rows.map(r => ({
    planTier: r.planTier,
    label: r.label,
    maxStudents: r.maxStudents ?? null,
    maxStorageMb: r.maxStorageMb ?? null,
  }));
}

export async function updatePlanLimit(
  ctx: RequestContext,
  patch: { planTier: string; label?: string; maxStudents?: number | null; maxStorageMb?: number | null } & PlanUpdateInput,
): Promise<PlanLimit> {
  const updated = await updatePlan(ctx, patch.planTier, patch);
  return {
    planTier: updated.planTier,
    label: updated.label,
    maxStudents: updated.maxStudents,
    maxStorageMb: updated.maxStorageMb,
  };
}
